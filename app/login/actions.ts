"use server";

import { cookies } from "next/headers";
import { redirect } from "next/navigation";

import { sql } from "@/lib/raw-sql";
import { getParamsSecurite } from "@/lib/securite";
import { poserSession } from "@/lib/auth-cookies";
import { envoyerCode2FA, mailConfigure } from "@/lib/mail";
import {
  COOKIE_PREAUTH,
  COOKIE_TRUST,
  DUREE_PREAUTH_MS,
  DUREE_TRUST_MS,
  egaliteConstante,
  genererCode6,
  sha256Hex,
  signerEnveloppe,
  verifierEnveloppe,
  verifierMotDePasse,
  type Role,
} from "@/lib/auth";

type PreAuth = { uid: number; role: Role; nom: string; exp: number };

// Envoie un nouveau code 2FA (invalide les précédents non utilisés) et pose le
// cookie pré-auth. Renvoie true si le mail est parti.
async function lancer2FA(base: { uid: number; role: Role; nom: string }, email: string): Promise<boolean> {
  const code = genererCode6();
  const codeHash = await sha256Hex(code);
  // Un seul code valide à la fois.
  await sql`UPDATE codes_2fa SET utilise_at = now()
            WHERE utilisateur_id = ${base.uid} AND utilise_at IS NULL`;
  await sql`INSERT INTO codes_2fa (utilisateur_id, code_hash, expire_at)
            VALUES (${base.uid}, ${codeHash}, now() + interval '10 minutes')`;

  const token = await signerEnveloppe({ ...base, exp: Date.now() + DUREE_PREAUTH_MS });
  cookies().set(COOKIE_PREAUTH, token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge: Math.floor(DUREE_PREAUTH_MS / 1000),
  });
  return envoyerCode2FA(email, code, base.nom);
}

// Connexion. Deux modes selon l'état des comptes :
//  - Bootstrap (aucun admin actif) : le code d'accès partagé connecte en admin,
//    le temps de créer les comptes. Pas de 2FA (aucun e-mail encore).
//  - Normal : identifiant + mot de passe, puis double authentification par
//    e-mail — sauf appareil déjà de confiance ou 2FA non disponible.
export async function login(fd: FormData) {
  const etat = await getParamsSecurite();

  // --- Mode bootstrap : par code d'accès ---
  if (!etat.aAdminActif) {
    const code = ((fd.get("code") as string) || (fd.get("motdepasse") as string) || "").trim();
    if (!etat.codeAcces || code !== etat.codeAcces) {
      redirect("/login?error=1");
    }
    await poserSession({ uid: 0, role: "admin", nom: "Admin (code)" });
    redirect("/");
  }

  // --- Mode normal : identifiant + mot de passe ---
  const identifiant = ((fd.get("identifiant") as string) || "").trim();
  const motdepasse = (fd.get("motdepasse") as string) || "";
  if (!identifiant || !motdepasse) redirect("/login?error=1");

  type LigneUtilisateur = {
    id: number | string;
    nom: string;
    role: string;
    actif: boolean;
    email: string | null;
    mdp_sel: string | null;
    mdp_hash: string | null;
  };
  let u: LigneUtilisateur | undefined;
  try {
    const rows = (await sql`
      SELECT id, nom, role, actif, email, mdp_sel, mdp_hash
      FROM utilisateurs
      WHERE lower(identifiant) = lower(${identifiant})
      LIMIT 1
    `) as LigneUtilisateur[];
    u = rows[0];
  } catch {
    redirect("/login?error=1");
  }

  if (!u || !u.actif) redirect("/login?error=1");
  const ok = await verifierMotDePasse(motdepasse, u.mdp_sel || "", u.mdp_hash || "");
  if (!ok) redirect("/login?error=1");

  const base = {
    uid: Number(u.id),
    role: (u.role === "admin" ? "admin" : "operateur") as Role,
    nom: u.nom,
  };

  // --- Double authentification par e-mail ---
  // Contournée si : pas d'e-mail sur le compte, Resend non configuré, ou
  // appareil déjà de confiance (cookie signé de moins de 30 jours).
  const email = (u.email || "").trim();
  const trust = await verifierEnveloppe<{ uid: number; exp: number }>(
    cookies().get(COOKIE_TRUST)?.value
  );
  const appareilConnu = trust?.uid === base.uid;

  if (email && mailConfigure() && !appareilConnu) {
    await lancer2FA(base, email);
    redirect("/login/verification");
  }

  await poserSession(base);
  redirect("/");
}

// Vérifie le code 2FA saisi (page /login/verification). En cas de succès, pose
// la session complète et, si demandé, mémorise l'appareil 30 jours.
export async function verifierCode(fd: FormData) {
  const pre = await verifierEnveloppe<PreAuth>(cookies().get(COOKIE_PREAUTH)?.value);
  if (!pre) redirect("/login?error=1");

  const saisi = ((fd.get("code") as string) || "").replace(/\s+/g, "");
  const souvenir = fd.get("souvenir") === "on";
  const codeHash = await sha256Hex(saisi);

  const rows = (await sql`
    SELECT id, code_hash, essais
    FROM codes_2fa
    WHERE utilisateur_id = ${pre.uid} AND utilise_at IS NULL AND expire_at > now()
    ORDER BY id DESC
    LIMIT 1
  `) as { id: number | string; code_hash: string; essais: number }[];
  const row = rows[0];
  if (!row) redirect("/login/verification?error=expire");

  if (Number(row.essais) >= 5) {
    await sql`UPDATE codes_2fa SET utilise_at = now() WHERE id = ${row.id}`;
    redirect("/login/verification?error=trop");
  }
  if (!egaliteConstante(codeHash, row.code_hash)) {
    await sql`UPDATE codes_2fa SET essais = essais + 1 WHERE id = ${row.id}`;
    redirect("/login/verification?error=code");
  }

  await sql`UPDATE codes_2fa SET utilise_at = now() WHERE id = ${row.id}`;
  await poserSession({ uid: pre.uid, role: pre.role, nom: pre.nom });
  cookies().delete(COOKIE_PREAUTH);

  if (souvenir) {
    const tok = await signerEnveloppe({ uid: pre.uid, exp: Date.now() + DUREE_TRUST_MS });
    cookies().set(COOKIE_TRUST, tok, {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "lax",
      path: "/",
      maxAge: Math.floor(DUREE_TRUST_MS / 1000),
    });
  }
  redirect("/");
}

// Renvoie un nouveau code (bouton « renvoyer » sur la page de vérification).
export async function renvoyerCode() {
  const pre = await verifierEnveloppe<PreAuth>(cookies().get(COOKIE_PREAUTH)?.value);
  if (!pre) redirect("/login?error=1");

  const rows = (await sql`SELECT email FROM utilisateurs WHERE id = ${pre.uid} LIMIT 1`) as {
    email: string | null;
  }[];
  const email = (rows[0]?.email || "").trim();
  if (!email) redirect("/login?error=1");

  await lancer2FA({ uid: pre.uid, role: pre.role, nom: pre.nom }, email);
  redirect("/login/verification?ok=renvoye");
}

// Déconnexion : efface la session (et les cookies pré-auth / ancien code).
// L'appareil de confiance est conservé (déconnexion volontaire ≠ appareil non
// fiable) ; il expire seul au bout de 30 jours.
export async function logout() {
  cookies().delete("ash_session");
  cookies().delete(COOKIE_PREAUTH);
  cookies().delete("ash_auth");
  redirect("/login");
}
