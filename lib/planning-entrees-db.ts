// Types d'intervention ajoutés + entrées de planning de ces types.
// Tables hors schéma Drizzle (SQL brut), créées à la volée (idempotent),
// comme pour les sous-types : aucune migration à lancer.
import { sql } from "@/lib/raw-sql";
import {
  calendarConfigured,
  createEvent,
  deleteEvent,
  updateEvent,
} from "@/lib/google-calendar";
import { couleurType, type TypeIntervention } from "@/lib/types-intervention";

let pret: Promise<void> | null = null;

export function ensurePlanningEntrees(): Promise<void> {
  if (!pret) {
    pret = (async () => {
      await sql`CREATE TABLE IF NOT EXISTS types_intervention (
        id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
        libelle text NOT NULL,
        couleur text NOT NULL DEFAULT 'violet',
        created_at timestamptz DEFAULT now()
      )`;
      await sql`CREATE UNIQUE INDEX IF NOT EXISTS types_intervention_libelle_key
        ON types_intervention (lower(libelle))`;
      await sql`CREATE TABLE IF NOT EXISTS planning_entrees (
        id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
        dossier_id bigint NOT NULL,
        type_id bigint NOT NULL,
        date date NOT NULL,
        heure text,
        rappels text,
        commentaire text NOT NULL DEFAULT '',
        google_event_id text,
        created_at timestamptz DEFAULT now()
      )`;
      await sql`CREATE INDEX IF NOT EXISTS planning_entrees_date_idx ON planning_entrees (date)`;
    })().catch((e) => {
      pret = null;
      throw e;
    });
  }
  return pret;
}

export async function listerTypesIntervention(): Promise<TypeIntervention[]> {
  await ensurePlanningEntrees();
  const rows = await sql`SELECT id, libelle, couleur FROM types_intervention ORDER BY id`;
  return rows.map((r) => ({
    id: Number(r.id),
    libelle: String(r.libelle),
    couleur: String(r.couleur),
  }));
}

// Ajoute un type (ou renvoie l'existant de même libellé, casse ignorée).
export async function ajouterTypeIntervention(
  brut: string,
  couleur: string
): Promise<TypeIntervention | null> {
  const libelle = brut.trim().replace(/\s+/g, " ").slice(0, 60);
  if (!libelle) return null;
  await ensurePlanningEntrees();
  await sql`INSERT INTO types_intervention (libelle, couleur)
    VALUES (${libelle}, ${couleurType(couleur).value}) ON CONFLICT DO NOTHING`;
  const [r] = await sql`SELECT id, libelle, couleur FROM types_intervention
    WHERE lower(libelle) = lower(${libelle}) LIMIT 1`;
  return r ? { id: Number(r.id), libelle: String(r.libelle), couleur: String(r.couleur) } : null;
}

// Supprime un type et toutes ses entrées (et leurs événements Google).
export async function supprimerTypeIntervention(id: number): Promise<void> {
  await ensurePlanningEntrees();
  const entrees = await sql`SELECT id FROM planning_entrees WHERE type_id = ${id}`;
  for (const e of entrees) await supprimerEntree(Number(e.id));
  await sql`DELETE FROM types_intervention WHERE id = ${id}`;
}

export type EntreePerso = {
  id: number;
  dossierId: number;
  nom: string;
  typeId: number;
  libelle: string;
  couleur: string;
  date: string;
  heure: string;
  rappels: string;
  comment: string;
};

// Entrées entre deux dates (incluses), avec dossier et type.
export async function listerEntrees(debut: string, fin: string): Promise<EntreePerso[]> {
  await ensurePlanningEntrees();
  const rows = await sql`
    SELECT e.id, e.dossier_id, d.nom_dossier, e.type_id, t.libelle, t.couleur,
           to_char(e.date, 'YYYY-MM-DD') AS date, e.heure, e.rappels, e.commentaire
    FROM planning_entrees e
    JOIN types_intervention t ON t.id = e.type_id
    JOIN dossiers d ON d.id = e.dossier_id
    WHERE e.date BETWEEN ${debut} AND ${fin}
    ORDER BY e.date, e.heure NULLS FIRST`;
  return rows.map((r) => ({
    id: Number(r.id),
    dossierId: Number(r.dossier_id),
    nom: String(r.nom_dossier),
    typeId: Number(r.type_id),
    libelle: String(r.libelle),
    couleur: String(r.couleur),
    date: String(r.date),
    heure: r.heure ? String(r.heure) : "",
    rappels: r.rappels ? String(r.rappels) : "",
    comment: String(r.commentaire ?? ""),
  }));
}

// Crée (id absent) ou met à jour une entrée, puis la synchronise en agenda.
export async function ecrireEntree(e: {
  id?: number | null;
  dossierId: number;
  typeId: number;
  date: string;
  heure: string;
  rappels: number[];
  comment: string;
}): Promise<number> {
  await ensurePlanningEntrees();
  const rappels = e.rappels.length ? e.rappels.join(",") : null;
  const heure = e.heure || null;
  let id = e.id ?? null;
  if (id) {
    await sql`UPDATE planning_entrees SET dossier_id = ${e.dossierId}, type_id = ${e.typeId},
      date = ${e.date}, heure = ${heure}, rappels = ${rappels}, commentaire = ${e.comment}
      WHERE id = ${id}`;
  } else {
    const [r] = await sql`INSERT INTO planning_entrees
      (dossier_id, type_id, date, heure, rappels, commentaire)
      VALUES (${e.dossierId}, ${e.typeId}, ${e.date}, ${heure}, ${rappels}, ${e.comment})
      RETURNING id`;
    id = Number(r.id);
  }
  await syncEntree(id);
  return id;
}

// Déplace une entrée (glisser-déposer) : nouvelle date, et heure si fournie.
export async function deplacerEntree(id: number, date: string, heure?: string | null) {
  await ensurePlanningEntrees();
  if (heure === undefined) await sql`UPDATE planning_entrees SET date = ${date} WHERE id = ${id}`;
  else await sql`UPDATE planning_entrees SET date = ${date}, heure = ${heure || null} WHERE id = ${id}`;
  await syncEntree(id);
}

export async function supprimerEntree(id: number): Promise<void> {
  await ensurePlanningEntrees();
  const [r] = await sql`DELETE FROM planning_entrees WHERE id = ${id} RETURNING google_event_id`;
  if (r?.google_event_id && calendarConfigured()) {
    try {
      await deleteEvent(String(r.google_event_id));
    } catch (err) {
      console.error("Suppression événement planning échouée:", (err as Error).message);
    }
  }
}

// Événement Google Agenda de l'entrée (même logique que les dates du dossier).
async function syncEntree(id: number) {
  if (!calendarConfigured()) return;
  try {
    const [r] = await sql`
      SELECT e.google_event_id, to_char(e.date, 'YYYY-MM-DD') AS date, e.heure,
             e.rappels, e.commentaire, t.libelle, t.couleur,
             d.nom_dossier, d.client_nom, d.adresse, d.telephone
      FROM planning_entrees e
      JOIN types_intervention t ON t.id = e.type_id
      JOIN dossiers d ON d.id = e.dossier_id
      WHERE e.id = ${id}`;
    if (!r) return;
    const rappels = r.rappels
      ? String(r.rappels).split(",").map(Number).filter((n) => Number.isFinite(n) && n >= 0)
      : [1440, 0];
    const ev = {
      summary: `${r.libelle} — ${r.nom_dossier}`,
      description: [r.client_nom, r.adresse, r.telephone, r.commentaire]
        .filter(Boolean)
        .join(" · "),
      startDate: String(r.date),
      endDate: String(r.date),
      heure: r.heure ? String(r.heure) : null,
      atSeven: true,
      rappels,
      colorId: couleurType(String(r.couleur)).googleColorId,
    };
    if (r.google_event_id) {
      await updateEvent(String(r.google_event_id), ev);
    } else {
      const eventId = await createEvent(ev);
      await sql`UPDATE planning_entrees SET google_event_id = ${eventId} WHERE id = ${id}`;
    }
  } catch (err) {
    console.error("Sync Google Calendar (entrée planning) échouée:", (err as Error).message);
  }
}
