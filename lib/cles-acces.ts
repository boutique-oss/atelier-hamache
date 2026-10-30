// Clés d'accès (passkeys, WebAuthn) : connexion sans mot de passe. Sur un PC,
// le navigateur affiche un QR code ; on le scanne avec son téléphone, qui
// déverrouille la clé (empreinte, visage ou code du téléphone). La clé privée
// ne quitte jamais le téléphone : la base ne garde que la clé publique.
// utilisateur_id NULL = clé de l'admin « par code » (mode sans comptes).
// Hors schéma Drizzle (SQL brut), créé à la volée.
import { headers } from "next/headers";

import { sql } from "@/lib/raw-sql";

export const COOKIE_WEBAUTHN = "ash_webauthn";
export const DUREE_DEFI_MS = 5 * 60 * 1000;

let pret: Promise<void> | null = null;

export function ensureClesAcces(): Promise<void> {
  if (!pret) {
    pret = (async () => {
      await sql`CREATE TABLE IF NOT EXISTS cles_acces (
        id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
        utilisateur_id bigint,
        credential_id text NOT NULL UNIQUE,
        cle_publique text NOT NULL,
        compteur bigint NOT NULL DEFAULT 0,
        transports text NOT NULL DEFAULT '',
        nom text NOT NULL DEFAULT '',
        created_at timestamptz DEFAULT now(),
        derniere_utilisation timestamptz
      )`;
      await sql`CREATE INDEX IF NOT EXISTS cles_acces_utilisateur_idx
        ON cles_acces (utilisateur_id)`;
    })().catch((e) => {
      pret = null;
      throw e;
    });
  }
  return pret;
}

// Site qui « possède » les clés : le domaine courant (atelier-hamache.vercel.app
// en prod). Une clé créée sur un domaine ne marche que sur ce domaine.
export function partieConfiance(): { rpID: string; origin: string } {
  const h = headers();
  const host = (h.get("x-forwarded-host") || h.get("host") || "localhost:3000").split(",")[0].trim();
  const proto = h.get("x-forwarded-proto") || (host.startsWith("localhost") ? "http" : "https");
  return { rpID: host.split(":")[0], origin: `${proto}://${host}` };
}

export type CleAcces = {
  id: number;
  nom: string;
  createdAt: string;
  derniereUtilisation: string | null;
};

export async function listerClesAcces(uid: number): Promise<CleAcces[]> {
  await ensureClesAcces();
  const rows = await sql`SELECT id, nom, created_at, derniere_utilisation FROM cles_acces
    WHERE utilisateur_id IS NOT DISTINCT FROM ${uid > 0 ? uid : null}
    ORDER BY created_at DESC`;
  return rows.map((r) => ({
    id: Number(r.id),
    nom: String(r.nom || "Clé d'accès"),
    createdAt: String(r.created_at),
    derniereUtilisation: r.derniere_utilisation == null ? null : String(r.derniere_utilisation),
  }));
}
