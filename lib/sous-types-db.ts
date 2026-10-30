// Accès base du sous-type de dossier + nombre de places assises.
// Colonnes hors schéma Drizzle (SQL brut) : les écrans existants qui font
// db.select().from(dossiers) ne dépendent pas de la migration. Les colonnes et
// la table sont créées à la volée (idempotent), comme pour /rideaux.
import { sql } from "@/lib/raw-sql";
import { SOUS_TYPES_BASE, propreSousType } from "@/lib/sous-types";

let pret: Promise<void> | null = null;

export function ensureSousTypes(): Promise<void> {
  if (!pret) {
    pret = (async () => {
      await sql`ALTER TABLE dossiers ADD COLUMN IF NOT EXISTS sous_type text`;
      await sql`ALTER TABLE dossiers ADD COLUMN IF NOT EXISTS places_assises integer`;
      await sql`CREATE TABLE IF NOT EXISTS sous_types_realisation (
        id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
        libelle text NOT NULL,
        created_at timestamptz DEFAULT now()
      )`;
      await sql`CREATE UNIQUE INDEX IF NOT EXISTS sous_types_realisation_libelle_key
        ON sous_types_realisation (lower(libelle))`;
    })().catch((e) => {
      pret = null;
      throw e;
    });
  }
  return pret;
}

// Liste complète : base + ajouts (ordre d'ajout), sans doublon (casse ignorée).
export async function listerSousTypes(): Promise<string[]> {
  await ensureSousTypes();
  const rows = await sql`SELECT libelle FROM sous_types_realisation ORDER BY id`;
  const vus = new Set(SOUS_TYPES_BASE.map((s) => s.toLowerCase()));
  const out = [...SOUS_TYPES_BASE];
  for (const r of rows) {
    const l = String(r.libelle);
    if (!vus.has(l.toLowerCase())) {
      vus.add(l.toLowerCase());
      out.push(l);
    }
  }
  return out;
}

// Ajoute un libellé à la liste (sans effet s'il existe déjà). Renvoie le
// libellé tel qu'il figure dans la liste (casse existante conservée).
export async function ajouterSousTypeDb(brut: string): Promise<string> {
  const libelle = propreSousType(brut);
  if (!libelle) return "";
  const base = SOUS_TYPES_BASE.find((s) => s.toLowerCase() === libelle.toLowerCase());
  if (base) return base;
  await ensureSousTypes();
  await sql`INSERT INTO sous_types_realisation (libelle) VALUES (${libelle})
    ON CONFLICT DO NOTHING`;
  const [r] = await sql`SELECT libelle FROM sous_types_realisation
    WHERE lower(libelle) = lower(${libelle}) LIMIT 1`;
  return r ? String(r.libelle) : libelle;
}

export async function lireSousType(
  id: number
): Promise<{ sousType: string | null; placesAssises: number | null }> {
  await ensureSousTypes();
  const [r] = await sql`SELECT sous_type, places_assises FROM dossiers WHERE id = ${id}`;
  return {
    sousType: r?.sous_type ?? null,
    placesAssises: r?.places_assises ?? null,
  };
}

// Enregistre sous-type + places d'un dossier ; un sous-type inconnu est
// ajouté à la liste au passage.
export async function ecrireSousType(
  id: number,
  sousType: string,
  places: number | null
): Promise<void> {
  const st = sousType ? await ajouterSousTypeDb(sousType) : "";
  await ensureSousTypes();
  await sql`UPDATE dossiers SET sous_type = ${st || null}, places_assises = ${places}
    WHERE id = ${id}`;
}
