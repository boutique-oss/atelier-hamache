// Accès base de la prise de cotes rideaux (une par dossier, plusieurs pièces
// en JSON). Hors schéma Drizzle (SQL brut), table créée à la volée.
import { lirePieces, type PieceCotes } from "@/lib/prise-cotes";
import { sql } from "@/lib/raw-sql";

let pret: Promise<void> | null = null;

export function ensurePrisesCotes(): Promise<void> {
  if (!pret) {
    pret = (async () => {
      await sql`CREATE TABLE IF NOT EXISTS prises_cotes (
        dossier_id bigint PRIMARY KEY REFERENCES dossiers(id) ON DELETE CASCADE,
        pieces jsonb NOT NULL DEFAULT '[]',
        date_prise date,
        updated_at timestamptz DEFAULT now()
      )`;
    })().catch((e) => {
      pret = null;
      throw e;
    });
  }
  return pret;
}

export async function lirePriseCotes(
  dossierId: number
): Promise<{ pieces: PieceCotes[]; datePrise: string | null; majLe: string | null }> {
  await ensurePrisesCotes();
  const [r] = await sql`SELECT pieces, date_prise, updated_at FROM prises_cotes
    WHERE dossier_id = ${dossierId}`;
  return {
    pieces: lirePieces(r?.pieces),
    datePrise: r?.date_prise ? String(r.date_prise).slice(0, 10) : null,
    majLe: r?.updated_at ? String(r.updated_at) : null,
  };
}

export async function ecrirePriseCotes(
  dossierId: number,
  pieces: PieceCotes[],
  datePrise: string | null
) {
  await ensurePrisesCotes();
  await sql`INSERT INTO prises_cotes (dossier_id, pieces, date_prise, updated_at)
    VALUES (${dossierId}, ${JSON.stringify(pieces)}::jsonb, ${datePrise}, now())
    ON CONFLICT (dossier_id) DO UPDATE
      SET pieces = EXCLUDED.pieces, date_prise = EXCLUDED.date_prise, updated_at = now()`;
}
