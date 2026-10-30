"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";

import { sql } from "@/lib/raw-sql";
import { invaliderCacheSecurite } from "@/lib/securite";
import { estAdmin } from "@/lib/session";
import { hacherMotDePasse, genererJetonUrl, sha256Hex } from "@/lib/auth";
import { envoyerInvitation, mailConfigure, lienBase } from "@/lib/mail";

// Toutes les actions de ce panneau sont réservées à l'administrateur.
async function exigerAdmin() {
  if (!(await estAdmin())) redirect("/login");
}

// Reste-t-il un autre admin actif que celui-ci ? (garde anti-verrouillage)
async function autreAdminActifExiste(saufId: number): Promise<boolean> {
  const rows = (await sql`
    SELECT 1 FROM utilisateurs
    WHERE actif AND role = 'admin' AND id <> ${saufId}
    LIMIT 1
  `) as unknown[];
  return rows.length > 0;
}

/* ============================ Code & réseau ============================ */

// Écrit le code d'accès partagé. Deux garde-fous : confirmation identique, et
// réémission du cookie de session côté login non nécessaire ici (le code ne
// sert plus qu'au bootstrap / secours une fois les comptes créés).
export async function mettreAJourCode(fd: FormData) {
  await exigerAdmin();
  const code = ((fd.get("code") as string) || "").trim();
  const conf = ((fd.get("code_confirm") as string) || "").trim();

  if (!code) redirect("/admin/securite?err=code_vide");
  if (code !== conf) redirect("/admin/securite?err=code_diff");

  try {
    await sql`
      INSERT INTO parametres_securite (id, code_acces, updated_at)
      VALUES (1, ${code}, now())
      ON CONFLICT (id) DO UPDATE
        SET code_acces = EXCLUDED.code_acces, updated_at = now()
    `;
  } catch {
    redirect("/admin/securite?err=db");
  }

  invaliderCacheSecurite();
  revalidatePath("/admin/securite");
  redirect("/admin/securite?ok=code");
}

// Écrit la liste d'IP autorisées (séparées par des virgules en base). Accepte
// une saisie par virgules OU retours à la ligne. Liste vide = aucune restriction.
export async function mettreAJourIps(fd: FormData) {
  await exigerAdmin();
  const brut = (fd.get("ips") as string) || "";
  const norm = brut
    .split(/[\n,]/)
    .map((s) => s.trim())
    .filter(Boolean)
    .join(",");

  try {
    await sql`
      INSERT INTO parametres_securite (id, ips_autorisees, updated_at)
      VALUES (1, ${norm}, now())
      ON CONFLICT (id) DO UPDATE
        SET ips_autorisees = EXCLUDED.ips_autorisees, updated_at = now()
    `;
  } catch {
    redirect("/admin/securite?err=db");
  }

  invaliderCacheSecurite();
  revalidatePath("/admin/securite");
  redirect("/admin/securite?ok=ips");
}

/* ============================ Comptes & rôles ============================ */

// Création directe avec mot de passe défini par l'admin (voie de secours,
// notamment pour amorcer le premier compte admin sans e-mail). L'e-mail est
// facultatif ici mais recommandé pour permettre la 2FA ensuite.
export async function creerUtilisateur(fd: FormData) {
  await exigerAdmin();
  const nom = ((fd.get("nom") as string) || "").trim();
  const identifiant = ((fd.get("identifiant") as string) || "").trim();
  const email = ((fd.get("email") as string) || "").trim();
  const role = (fd.get("role") as string) === "admin" ? "admin" : "operateur";
  const motdepasse = (fd.get("motdepasse") as string) || "";

  if (!nom || !identifiant || motdepasse.length < 4) {
    redirect("/admin/securite?err=compte_invalide");
  }

  const { sel, hash } = await hacherMotDePasse(motdepasse);
  try {
    await sql`
      INSERT INTO utilisateurs (nom, identifiant, email, mdp_sel, mdp_hash, role, actif)
      VALUES (${nom}, ${identifiant}, ${email || null}, ${sel}, ${hash}, ${role}, true)
    `;
  } catch {
    // Violation d'unicité de l'identifiant, le plus souvent.
    redirect("/admin/securite?err=identifiant_pris");
  }

  invaliderCacheSecurite();
  revalidatePath("/admin/securite");
  redirect("/admin/securite?ok=compte");
}

// Crée et envoie une invitation pour l'utilisateur donné (jeton aléatoire de 7
// jours, seule l'empreinte est stockée). Invalide les invitations précédentes
// encore en attente pour ce compte.
async function creerEtEnvoyerInvitation(
  utilisateurId: number,
  email: string,
  nom: string
): Promise<boolean> {
  const jeton = genererJetonUrl();
  const jetonHash = await sha256Hex(jeton);
  await sql`UPDATE invitations SET utilise_at = now()
            WHERE utilisateur_id = ${utilisateurId} AND utilise_at IS NULL`;
  await sql`INSERT INTO invitations (utilisateur_id, email, jeton_hash, expire_at)
            VALUES (${utilisateurId}, ${email}, ${jetonHash}, now() + interval '7 days')`;
  const lien = `${lienBase()}/activer?token=${jeton}`;
  return envoyerInvitation(email, lien, nom);
}

// Invitation par e-mail : crée un compte INACTIF (sans mot de passe) et envoie
// un lien d'activation. La personne choisit elle-même son mot de passe.
export async function inviterUtilisateur(fd: FormData) {
  await exigerAdmin();
  const nom = ((fd.get("nom") as string) || "").trim();
  const identifiant = ((fd.get("identifiant") as string) || "").trim();
  const email = ((fd.get("email") as string) || "").trim();
  const role = (fd.get("role") as string) === "admin" ? "admin" : "operateur";

  if (!nom || !identifiant || !email || !email.includes("@")) {
    redirect("/admin/securite?err=invite_invalide");
  }
  if (!mailConfigure()) {
    redirect("/admin/securite?err=mail_indispo");
  }

  let uid: number;
  try {
    const rows = (await sql`
      INSERT INTO utilisateurs (nom, identifiant, email, role, actif)
      VALUES (${nom}, ${identifiant}, ${email}, ${role}, false)
      RETURNING id
    `) as { id: number | string }[];
    uid = Number(rows[0].id);
  } catch {
    redirect("/admin/securite?err=identifiant_pris");
  }

  const envoye = await creerEtEnvoyerInvitation(uid, email, nom);
  invaliderCacheSecurite();
  revalidatePath("/admin/securite");
  redirect(envoye ? "/admin/securite?ok=invite" : "/admin/securite?err=mail_echec");
}

// Renvoie une invitation à un compte existant (nouveau lien).
export async function renvoyerInvitation(fd: FormData) {
  await exigerAdmin();
  const id = Number(fd.get("id"));
  if (!id) redirect("/admin/securite");
  if (!mailConfigure()) redirect("/admin/securite?err=mail_indispo");

  const rows = (await sql`
    SELECT nom, email FROM utilisateurs WHERE id = ${id} LIMIT 1
  `) as { nom: string; email: string | null }[];
  const u = rows[0];
  if (!u || !u.email) redirect("/admin/securite?err=sans_email");

  const envoye = await creerEtEnvoyerInvitation(id, u.email, u.nom);
  revalidatePath("/admin/securite");
  redirect(envoye ? "/admin/securite?ok=invite" : "/admin/securite?err=mail_echec");
}

export async function reinitMotDePasse(fd: FormData) {
  await exigerAdmin();
  const id = Number(fd.get("id"));
  const motdepasse = (fd.get("motdepasse") as string) || "";
  if (!id || motdepasse.length < 4) redirect("/admin/securite?err=mdp_court");

  const { sel, hash } = await hacherMotDePasse(motdepasse);
  await sql`
    UPDATE utilisateurs SET mdp_sel = ${sel}, mdp_hash = ${hash} WHERE id = ${id}
  `;

  revalidatePath("/admin/securite");
  redirect("/admin/securite?ok=mdp");
}

export async function changerRole(fd: FormData) {
  await exigerAdmin();
  const id = Number(fd.get("id"));
  const role = (fd.get("role") as string) === "admin" ? "admin" : "operateur";
  if (!id) redirect("/admin/securite");

  // Ne pas rétrograder le dernier admin actif.
  if (role === "operateur" && !(await autreAdminActifExiste(id))) {
    redirect("/admin/securite?err=dernier_admin");
  }

  await sql`UPDATE utilisateurs SET role = ${role} WHERE id = ${id}`;
  invaliderCacheSecurite();
  revalidatePath("/admin/securite");
  redirect("/admin/securite?ok=role");
}

export async function basculerActif(fd: FormData) {
  await exigerAdmin();
  const id = Number(fd.get("id"));
  const actif = fd.get("actif") === "true";
  if (!id) redirect("/admin/securite");

  // Ne pas désactiver le dernier admin actif.
  if (!actif) {
    const rows = (await sql`SELECT role FROM utilisateurs WHERE id = ${id}`) as { role: string }[];
    if (rows[0]?.role === "admin" && !(await autreAdminActifExiste(id))) {
      redirect("/admin/securite?err=dernier_admin");
    }
  }

  await sql`UPDATE utilisateurs SET actif = ${actif} WHERE id = ${id}`;
  invaliderCacheSecurite();
  revalidatePath("/admin/securite");
  redirect("/admin/securite?ok=actif");
}

export async function supprimerUtilisateur(fd: FormData) {
  await exigerAdmin();
  const id = Number(fd.get("id"));
  if (!id) redirect("/admin/securite");

  const rows = (await sql`SELECT role, actif FROM utilisateurs WHERE id = ${id}`) as {
    role: string;
    actif: boolean;
  }[];
  if (rows[0]?.role === "admin" && rows[0]?.actif && !(await autreAdminActifExiste(id))) {
    redirect("/admin/securite?err=dernier_admin");
  }

  await sql`DELETE FROM utilisateurs WHERE id = ${id}`;
  invaliderCacheSecurite();
  revalidatePath("/admin/securite");
  redirect("/admin/securite?ok=suppr");
}
