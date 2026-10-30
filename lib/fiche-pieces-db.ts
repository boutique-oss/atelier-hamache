// PDF joints à une fiche de travail RIDEAUX : la « prise de cotes » remplie à
// la main chez le client puis scannée. Le fichier est gardé sur Vercel Blob
// (store privé, servi par /api/fiche-pdf/[id]) et s'imprime à la suite de la
// fiche. Table hors schéma Drizzle (SQL brut), créée à la volée.
import { sql } from "@/lib/raw-sql";

export type PieceJointe = { id: number; nom: string };

let pret: Promise<void> | null = null;

export function ensurePiecesJointes(): Promise<void> {
  if (!pret) {
    pret = (async () => {
      await sql`CREATE TABLE IF NOT EXISTS fiche_pieces_jointes (
        id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
        fiche_id bigint NOT NULL REFERENCES fiches_atelier(id) ON DELETE CASCADE,
        nom_fichier text NOT NULL DEFAULT '',
        pathname text NOT NULL,
        taille integer,
        created_at timestamptz DEFAULT now()
      )`;
      await sql`CREATE INDEX IF NOT EXISTS fiche_pieces_jointes_fiche_idx
        ON fiche_pieces_jointes (fiche_id)`;
    })().catch((e) => {
      pret = null;
      throw e;
    });
  }
  return pret;
}

export async function listerPiecesJointes(ficheId: number): Promise<PieceJointe[]> {
  await ensurePiecesJointes();
  const rows = await sql`SELECT id, nom_fichier FROM fiche_pieces_jointes
    WHERE fiche_id = ${ficheId} ORDER BY id`;
  return rows.map((r) => ({ id: Number(r.id), nom: String(r.nom_fichier ?? "") }));
}

// fiche id → ses PDF (pour la liste des fiches d'un dossier).
export async function piecesParFiche(ficheIds: number[]): Promise<Map<number, PieceJointe[]>> {
  const out = new Map<number, PieceJointe[]>();
  if (ficheIds.length === 0) return out;
  await ensurePiecesJointes();
  const rows = await sql`SELECT id, fiche_id, nom_fichier FROM fiche_pieces_jointes
    WHERE fiche_id = ANY(${ficheIds}) ORDER BY id`;
  for (const r of rows) {
    const k = Number(r.fiche_id);
    out.set(k, [...(out.get(k) ?? []), { id: Number(r.id), nom: String(r.nom_fichier ?? "") }]);
  }
  return out;
}
