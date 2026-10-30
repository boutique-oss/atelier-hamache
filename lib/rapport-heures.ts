// Rapports d'heures (module Documents, phase 6). Tous les totaux sont calculés
// en SQL, sur `heures` (heures saisies par dossier) et `pointage` (présence,
// alimentée aussi par les fiches navettes). Filtres optionnels : période
// (dates ISO, comparaison texte = chronologique) et opérateur.
import { ensureDocuments } from "@/lib/documents-db";
import { sql } from "@/lib/raw-sql";

export type FiltreRapport = { from?: string; to?: string; operateur?: string };

const n = (v: unknown) => Number(v ?? 0) || 0;
const vide = (s?: string) => (s && s.trim() ? s.trim() : null);

// ── Raccourcis de période (semaine / mois) ─────────────────────────────────

const iso = (d: Date) =>
  `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;

export function raccourcisPeriode(aujourdhui = new Date()): { libelle: string; from: string; to: string }[] {
  const j = new Date(aujourdhui.getFullYear(), aujourdhui.getMonth(), aujourdhui.getDate());
  const lundi = new Date(j);
  lundi.setDate(j.getDate() - ((j.getDay() + 6) % 7));
  const dim = new Date(lundi);
  dim.setDate(lundi.getDate() + 6);
  const lundiPrec = new Date(lundi);
  lundiPrec.setDate(lundi.getDate() - 7);
  const dimPrec = new Date(lundi);
  dimPrec.setDate(lundi.getDate() - 1);
  const debMois = new Date(j.getFullYear(), j.getMonth(), 1);
  const finMois = new Date(j.getFullYear(), j.getMonth() + 1, 0);
  const debPrec = new Date(j.getFullYear(), j.getMonth() - 1, 1);
  const finPrec = new Date(j.getFullYear(), j.getMonth(), 0);
  return [
    { libelle: "Cette semaine", from: iso(lundi), to: iso(dim) },
    { libelle: "Semaine dernière", from: iso(lundiPrec), to: iso(dimPrec) },
    { libelle: "Ce mois", from: iso(debMois), to: iso(finMois) },
    { libelle: "Mois dernier", from: iso(debPrec), to: iso(finPrec) },
  ];
}

// ── Indicateurs de la période ──────────────────────────────────────────────

export type IndicateursPeriode = {
  /** Présence pointée (jours « Travail »), null si la table pointage n'existe pas. */
  pointees: number | null;
  /** Heures saisies sur les dossiers pendant la période. */
  saisies: number;
  /** Heures prévues des dossiers travaillés pendant la période (avec prévu > 0). */
  prevues: number;
  /** Réel cumulé (toutes périodes) de ces mêmes dossiers. */
  reelles: number;
  /** reelles − prevues. */
  ecart: number;
  /** Fiches navettes au statut « à saisir ». */
  fichesASaisir: number;
};

export async function indicateursPeriode(f: FiltreRapport): Promise<IndicateursPeriode> {
  const from = vide(f.from);
  const to = vide(f.to);
  const op = vide(f.operateur);
  await ensureDocuments();

  const [saisi] = await sql`SELECT coalesce(sum(heures_passees), 0) AS h
    FROM heures
    WHERE (${from}::text IS NULL OR date >= ${from})
      AND (${to}::text IS NULL OR date <= ${to})
      AND (${op}::text IS NULL OR operateur = ${op})`;

  // Dossiers travaillés sur la période : prévu vs réel cumulé.
  const [pr] = await sql`WITH travailles AS (
      SELECT DISTINCT dossier_id FROM heures
      WHERE dossier_id IS NOT NULL
        AND (${from}::text IS NULL OR date >= ${from})
        AND (${to}::text IS NULL OR date <= ${to})
        AND (${op}::text IS NULL OR operateur = ${op})
    ), reel AS (
      SELECT h.dossier_id, sum(h.heures_passees) AS h
      FROM heures h JOIN travailles t ON t.dossier_id = h.dossier_id
      GROUP BY h.dossier_id
    )
    SELECT coalesce(sum(d.heures_a_realiser), 0) AS prevues,
           coalesce(sum(r.h), 0) AS reelles
    FROM dossiers d JOIN reel r ON r.dossier_id = d.id
    WHERE coalesce(d.heures_a_realiser, 0) > 0`;

  const [fiches] = await sql`SELECT count(*) AS nb FROM fiches_navettes
    WHERE statut = 'a_saisir' AND (${op}::text IS NULL OR operateur = ${op})`;

  let pointees: number | null = null;
  try {
    const [p] = await sql`SELECT coalesce(sum(heures), 0) AS h FROM pointage
      WHERE coalesce(type, 'Travail') = 'Travail'
        AND (${from}::text IS NULL OR date >= ${from})
        AND (${to}::text IS NULL OR date <= ${to})
        AND (${op}::text IS NULL OR operateur = ${op})`;
    pointees = n(p.h);
  } catch {
    pointees = null; // table pointage pas encore créée
  }

  const prevues = n(pr.prevues);
  const reelles = n(pr.reelles);
  return {
    pointees,
    saisies: n(saisi.h),
    prevues,
    reelles,
    ecart: reelles - prevues,
    fichesASaisir: n(fiches.nb),
  };
}

// ── Par opérateur : présence pointée vs heures saisies sur dossiers ────────

export type LigneOperateur = { operateur: string; pointees: number; saisies: number };

export async function heuresParOperateur(f: FiltreRapport): Promise<LigneOperateur[]> {
  const from = vide(f.from);
  const to = vide(f.to);
  const op = vide(f.operateur);
  const saisies = await sql`SELECT operateur, sum(heures_passees) AS h FROM heures
    WHERE (${from}::text IS NULL OR date >= ${from})
      AND (${to}::text IS NULL OR date <= ${to})
      AND (${op}::text IS NULL OR operateur = ${op})
    GROUP BY operateur`;
  let pointees: Record<string, unknown>[] = [];
  try {
    pointees = await sql`SELECT operateur, sum(heures) AS h FROM pointage
      WHERE coalesce(type, 'Travail') = 'Travail'
        AND (${from}::text IS NULL OR date >= ${from})
        AND (${to}::text IS NULL OR date <= ${to})
        AND (${op}::text IS NULL OR operateur = ${op})
      GROUP BY operateur`;
  } catch {
    pointees = [];
  }
  const parOp = new Map<string, LigneOperateur>();
  const ligne = (nom: string) => {
    const l = parOp.get(nom) ?? { operateur: nom, pointees: 0, saisies: 0 };
    parOp.set(nom, l);
    return l;
  };
  for (const r of saisies) ligne(String(r.operateur ?? "—")).saisies = n(r.h);
  for (const r of pointees) ligne(String(r.operateur ?? "—")).pointees = n(r.h);
  return [...parOp.values()]
    .filter((l) => l.pointees > 0 || l.saisies > 0)
    .sort((a, b) => Math.max(b.pointees, b.saisies) - Math.max(a.pointees, a.saisies));
}

// ── Réel vs prévu par dossier ──────────────────────────────────────────────

export type LigneReelPrevu = {
  id: number;
  nom: string;
  client: string;
  statut: string;
  prevu: number;
  /** Heures saisies pendant la période filtrée. */
  periode: number;
  /** Heures saisies au total (toutes périodes). */
  reel: number;
};

// Dossiers ayant des heures sur la période, avec leur prévu et leur réel
// cumulé. Les plus chargés sur la période en premier.
export async function reelVsPrevuParDossier(f: FiltreRapport, limite = 40): Promise<LigneReelPrevu[]> {
  const from = vide(f.from);
  const to = vide(f.to);
  const op = vide(f.operateur);
  const rows = await sql`WITH periode AS (
      SELECT dossier_id, sum(heures_passees) AS h FROM heures
      WHERE dossier_id IS NOT NULL
        AND (${from}::text IS NULL OR date >= ${from})
        AND (${to}::text IS NULL OR date <= ${to})
        AND (${op}::text IS NULL OR operateur = ${op})
      GROUP BY dossier_id
    ), total AS (
      SELECT h.dossier_id, sum(h.heures_passees) AS h
      FROM heures h JOIN periode p ON p.dossier_id = h.dossier_id
      GROUP BY h.dossier_id
    )
    SELECT d.id, d.nom_dossier, d.client_nom, d.statut,
           coalesce(d.heures_a_realiser, 0) AS prevu,
           p.h AS periode, t.h AS reel
    FROM periode p
    JOIN total t ON t.dossier_id = p.dossier_id
    JOIN dossiers d ON d.id = p.dossier_id
    ORDER BY p.h DESC, d.id DESC
    LIMIT ${limite}`;
  return rows.map((r) => ({
    id: n(r.id),
    nom: String(r.nom_dossier ?? `#${r.id}`),
    client: String(r.client_nom ?? ""),
    statut: String(r.statut ?? ""),
    prevu: n(r.prevu),
    periode: n(r.periode),
    reel: n(r.reel),
  }));
}

// ── Rapport complet d'un dossier (pour l'export PDF) ───────────────────────

export type RapportDossier = {
  id: number;
  nom: string;
  client: string;
  statut: string;
  prevu: number;
  reel: number;
  parOperateur: { libelle: string; h: number }[];
  parType: { libelle: string; h: number }[];
  parMois: { libelle: string; h: number }[];
  lignes: {
    date: string;
    operateur: string;
    type: string;
    realisation: string;
    heures: number;
    description: string;
  }[];
};

export async function rapportDossier(id: number): Promise<RapportDossier | null> {
  const [d] = await sql`SELECT id, nom_dossier, client_nom, statut,
      coalesce(heures_a_realiser, 0) AS prevu,
      (SELECT coalesce(sum(heures_passees), 0) FROM heures WHERE dossier_id = ${id}) AS reel
    FROM dossiers WHERE id = ${id}`;
  if (!d) return null;
  const [parOp, parType, parMois, lignes] = await Promise.all([
    sql`SELECT operateur AS l, sum(heures_passees) AS h FROM heures
      WHERE dossier_id = ${id} GROUP BY operateur ORDER BY h DESC`,
    sql`SELECT coalesce(nullif(type_travail, ''), 'Atelier') AS l, sum(heures_passees) AS h
      FROM heures WHERE dossier_id = ${id} GROUP BY 1 ORDER BY h DESC`,
    sql`SELECT substr(date, 1, 7) AS l, sum(heures_passees) AS h FROM heures
      WHERE dossier_id = ${id} GROUP BY 1 ORDER BY 1`,
    sql`SELECT date, operateur, coalesce(type_travail, '') AS type,
        coalesce(type_realisation, '') AS realisation, heures_passees,
        coalesce(description, '') AS description
      FROM heures WHERE dossier_id = ${id} ORDER BY date, id`,
  ]);
  const agg = (rows: Record<string, unknown>[]) =>
    rows.map((r) => ({ libelle: String(r.l ?? "—"), h: n(r.h) }));
  return {
    id: n(d.id),
    nom: String(d.nom_dossier ?? `#${id}`),
    client: String(d.client_nom ?? ""),
    statut: String(d.statut ?? ""),
    prevu: n(d.prevu),
    reel: n(d.reel),
    parOperateur: agg(parOp),
    parType: agg(parType),
    parMois: agg(parMois),
    lignes: lignes.map((r) => ({
      date: String(r.date ?? ""),
      operateur: String(r.operateur ?? ""),
      type: String(r.type ?? ""),
      realisation: String(r.realisation ?? ""),
      heures: n(r.heures_passees),
      description: String(r.description ?? ""),
    })),
  };
}
