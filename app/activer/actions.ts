"use server";

import { redirect } from "next/navigation";

import { sql } from "@/lib/raw-sql";
import { invaliderCacheSecurite } from "@/lib/securite";
import { poserSession } from "@/lib/auth-cookies";
import { hacherMotDePasse, sha256Hex, type Role } from "@/lib/auth";

// Active un compte invité : valide le jeton du lien, enregistre le mot de passe
// choisi, marque l'invitation comme utilisée et connecte la personne.
export async function activerCompte(fd: FormData) {
  const token = ((fd.get("token") as string) || "").trim();
  const mdp = (fd.get("motdepasse") as string) || "";
  const conf = (fd.get("motdepasse_confirm") as string) || "";

  if (!token) redirect("/login?error=1");
  if (mdp.length < 6) redirect(`/activer?token=${encodeURIComponent(token)}&err=court`);
  if (mdp !== conf) redirect(`/activer?token=${encodeURIComponent(token)}&err=diff`);

  const jetonHash = await sha256Hex(token);
  const rows = (await sql`
    SELECT i.id AS invite_id, u.id AS uid, u.nom, u.role
    FROM invitations i
    JOIN utilisateurs u ON u.id = i.utilisateur_id
    WHERE i.jeton_hash = ${jetonHash} AND i.utilise_at IS NULL AND i.expire_at > now()
    LIMIT 1
  `) as { invite_id: number | string; uid: number | string; nom: string; role: string }[];
  const inv = rows[0];
  if (!inv) redirect("/activer?err=invalide");

  const { sel, hash } = await hacherMotDePasse(mdp);
  await sql`
    UPDATE utilisateurs SET mdp_sel = ${sel}, mdp_hash = ${hash}, actif = true
    WHERE id = ${inv.uid}
  `;
  await sql`UPDATE invitations SET utilise_at = now() WHERE id = ${inv.invite_id}`;

  invaliderCacheSecurite();
  await poserSession({
    uid: Number(inv.uid),
    role: (inv.role === "admin" ? "admin" : "operateur") as Role,
    nom: inv.nom,
  });
  redirect("/");
}
