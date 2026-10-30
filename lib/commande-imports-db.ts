// PDF fournisseurs importés (accusés de réception, bons de commande) : le
// fichier est gardé sur Vercel Blob (store privé, servi par
// /api/commandes-import/[id]) et chaque commande créée pointe vers son PDF
// (commandes.import_id). Hors schéma Drizzle (SQL brut), créé à la volée.
import { sql } from "@/lib/raw-sql";

export type ImportPdf = {
  id: number;
  fournisseur: string;
  nomFichier: string;
  taille: number | null;
  createdAt: string;
  nbLignes: number;
};

let pret: Promise<void> | null = null;

export function ensureImports(): Promise<void> {
  if (!pret) {
    pret = (async () => {
      await sql`CREATE TABLE IF NOT EXISTS commande_imports (
        id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
        fournisseur text NOT NULL DEFAULT '',
        nom_fichier text NOT NULL DEFAULT '',
        pathname text NOT NULL,
        url text NOT NULL,
        taille integer,
        content_type text,
        created_at timestamptz DEFAULT now()
      )`;
      await sql`ALTER TABLE commandes ADD COLUMN IF NOT EXISTS import_id bigint
        REFERENCES commande_imports(id) ON DELETE SET NULL`;
    })().catch((e) => {
      pret = null;
      throw e;
    });
  }
  return pret;
}

// Tous les imports, du plus récent au plus ancien, avec leur nombre de lignes.
export async function listerImports(): Promise<ImportPdf[]> {
  await ensureImports();
  const rows = await sql`SELECT i.id, i.fournisseur, i.nom_fichier, i.taille,
      i.created_at, count(c.id)::int AS nb
    FROM commande_imports i LEFT JOIN commandes c ON c.import_id = i.id
    GROUP BY i.id ORDER BY i.id DESC`;
  return rows.map((r) => ({
    id: Number(r.id),
    fournisseur: String(r.fournisseur ?? ""),
    nomFichier: String(r.nom_fichier ?? ""),
    taille: r.taille == null ? null : Number(r.taille),
    createdAt: String(r.created_at ?? ""),
    nbLignes: Number(r.nb) || 0,
  }));
}

// commande id → import id (pour afficher l'icône PDF sur les lignes).
export async function importsParCommande(): Promise<Map<number, number>> {
  await ensureImports();
  const rows = await sql`SELECT id, import_id FROM commandes WHERE import_id IS NOT NULL`;
  return new Map(rows.map((r) => [Number(r.id), Number(r.import_id)]));
}
