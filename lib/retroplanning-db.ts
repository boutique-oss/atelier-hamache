// Étapes du rétroplanning enregistrées (après déplacement, étirement, édition
// ou ajout sur le Gantt). Table hors schéma Drizzle, créée à la volée
// (idempotent) comme planning_entrees : aucune migration à lancer.
//
// Tant qu'un dossier n'a aucune ligne ici, ses étapes sont PROPOSÉES par le
// calcul à rebours (lib/retroplanning.ts). Dès la première modification, toutes
// les étapes du dossier sont enregistrées et deviennent la référence.
import { sql } from "@/lib/raw-sql";
import { CODES_ETAPE, estIso, type CodeEtape, type Etape } from "@/lib/retroplanning";

let pret: Promise<void> | null = null;

export function ensureRetroEtapes(): Promise<void> {
  if (!pret) {
    pret = (async () => {
      await sql`CREATE TABLE IF NOT EXISTS retro_etapes (
        id text PRIMARY KEY,
        dossier_id bigint NOT NULL,
        code text NOT NULL,
        libelle text NOT NULL DEFAULT '',
        operateur_id bigint,
        date_debut date NOT NULL,
        date_fin date NOT NULL,
        heures real NOT NULL DEFAULT 0,
        fait boolean NOT NULL DEFAULT false,
        ordre integer NOT NULL DEFAULT 0,
        updated_at timestamptz DEFAULT now()
      )`;
      await sql`CREATE INDEX IF NOT EXISTS retro_etapes_dossier_idx ON retro_etapes (dossier_id)`;
    })().catch((e) => {
      pret = null;
      throw e;
    });
  }
  return pret;
}

const versEtape = (r: Record<string, unknown>): Etape => ({
  id: String(r.id),
  dossierId: Number(r.dossier_id),
  code: (CODES_ETAPE as readonly string[]).includes(String(r.code)) ? (r.code as CodeEtape) : "AU",
  libelle: String(r.libelle ?? ""),
  operateurId: r.operateur_id == null ? null : Number(r.operateur_id),
  debut: String(r.debut),
  fin: String(r.fin),
  heures: Number(r.heures) || 0,
  fait: Boolean(r.fait),
  ordre: Number(r.ordre) || 0,
  propose: false,
});

export async function listerEtapes(dossierIds: number[]): Promise<Etape[]> {
  if (dossierIds.length === 0) return [];
  await ensureRetroEtapes();
  const rows = await sql`
    SELECT id, dossier_id, code, libelle, operateur_id, heures, fait, ordre,
           to_char(date_debut, 'YYYY-MM-DD') AS debut,
           to_char(date_fin, 'YYYY-MM-DD') AS fin
    FROM retro_etapes
    WHERE dossier_id = ANY(${dossierIds})
    ORDER BY dossier_id, ordre, date_debut`;
  return rows.map(versEtape);
}

// Nettoie une étape reçue du navigateur (ne jamais faire confiance au client).
export function etapeValide(e: Partial<Etape>, dossierId: number): Etape | null {
  if (!e || typeof e.id !== "string" || !e.id || e.id.length > 80) return null;
  if (!estIso(e.debut) || !estIso(e.fin)) return null;
  const code = (CODES_ETAPE as readonly string[]).includes(String(e.code)) ? (e.code as CodeEtape) : "AU";
  const heures = Number(e.heures);
  const op = e.operateurId == null ? null : Number(e.operateurId);
  return {
    id: e.id,
    dossierId,
    code,
    libelle: String(e.libelle ?? "").trim().slice(0, 120),
    operateurId: op != null && Number.isFinite(op) && op > 0 ? op : null,
    debut: e.debut,
    fin: e.fin < e.debut ? e.debut : e.fin,
    heures: Number.isFinite(heures) && heures > 0 ? Math.min(heures, 2000) : 0,
    fait: Boolean(e.fait),
    ordre: Number.isFinite(Number(e.ordre)) ? Math.trunc(Number(e.ordre)) : 0,
    propose: false,
  };
}

// Remplace TOUTES les étapes d'un dossier (atomique).
export async function remplacerEtapesDossier(dossierId: number, etapes: Etape[]): Promise<void> {
  await ensureRetroEtapes();
  await sql.transaction([
    sql`DELETE FROM retro_etapes WHERE dossier_id = ${dossierId}`,
    ...etapes.map(
      (e) => sql`INSERT INTO retro_etapes
        (id, dossier_id, code, libelle, operateur_id, date_debut, date_fin, heures, fait, ordre, updated_at)
        VALUES (${e.id}, ${dossierId}, ${e.code}, ${e.libelle}, ${e.operateurId},
                ${e.debut}, ${e.fin}, ${e.heures}, ${e.fait}, ${e.ordre}, now())
        ON CONFLICT (id) DO UPDATE SET
          dossier_id = EXCLUDED.dossier_id, code = EXCLUDED.code, libelle = EXCLUDED.libelle,
          operateur_id = EXCLUDED.operateur_id, date_debut = EXCLUDED.date_debut,
          date_fin = EXCLUDED.date_fin, heures = EXCLUDED.heures, fait = EXCLUDED.fait,
          ordre = EXCLUDED.ordre, updated_at = now()`
    ),
  ]);
}

// Efface les ajustements d'un dossier : il revient au calcul à rebours.
export async function effacerEtapesDossier(dossierId: number): Promise<void> {
  await ensureRetroEtapes();
  await sql`DELETE FROM retro_etapes WHERE dossier_id = ${dossierId}`;
}
