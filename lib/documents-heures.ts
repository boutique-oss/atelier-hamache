// Rubrique « Rapports d'heures » du module Documents. Tous les totaux sont
// calculés en SQL sur `heures` (dates en texte ISO AAAA-MM-JJ, donc
// comparables comme des chaînes). Prévu = dossiers.heures_a_realiser.
import { ensureDocuments } from "@/lib/documents-db";
import { sql } from "@/lib/raw-sql";
import { isoDate, mondayIsoOf, sundayOfWeek } from "@/lib/weeks";

export type TypePeriode = "semaine" | "mois";

export type Periode = {
  type: TypePeriode;
  ref: string; // lundi AAAA-MM-JJ (semaine) ou AAAA-MM (mois)
  debut: string;
  fin: string;
  libelle: string;
  precedente: string;
  suivante: string;
};

const MOIS = [
  "janvier", "février", "mars", "avril", "mai", "juin",
  "juillet", "août", "septembre", "octobre", "novembre", "décembre",
];

const jjmm = (iso: string) => iso.slice(8, 10) + "/" + iso.slice(5, 7);

// Période demandée (?periode=semaine|mois&ref=…), mois en cours par défaut.
export function lirePeriode(type?: string, ref?: string): Periode {
  const auj = isoDate(new Date());
  if (type === "semaine") {
    const lundi = mondayIsoOf(/^\d{4}-\d{2}-\d{2}$/.test(ref ?? "") ? ref : auj) || mondayIsoOf(auj);
    const decale = (j: number) => {
      const d = new Date(lundi);
      d.setUTCDate(d.getUTCDate() + j);
      return isoDate(d);
    };
    const fin = sundayOfWeek(lundi);
    return {
      type: "semaine",
      ref: lundi,
      debut: lundi,
      fin,
      libelle: `Semaine du ${jjmm(lundi)} au ${jjmm(fin)}/${fin.slice(0, 4)}`,
      precedente: decale(-7),
      suivante: decale(7),
    };
  }
  const m = /^(\d{4})-(\d{2})$/.exec(ref ?? "") ?? /^(\d{4})-(\d{2})/.exec(auj)!;
  const an = Number(m[1]);
  const mo = Math.min(12, Math.max(1, Number(m[2])));
  const cle = (a: number, n: number) => {
    const d = new Date(Date.UTC(a, n - 1, 1));
    return `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, "0")}`;
  };
  const debut = `${cle(an, mo)}-01`;
  const fin = isoDate(new Date(Date.UTC(an, mo, 0)));
  return {
    type: "mois",
    ref: cle(an, mo),
    debut,
    fin,
    libelle: `${MOIS[mo - 1]} ${an}`,
    precedente: cle(an, mo - 1),
    suivante: cle(an, mo + 1),
  };
}

export type IndicateursHeures = {
  pointees: number;
  prevues: number;
  realisees: number; // cumul réel des dossiers qui ont un prévu
  ecart: number; // realisees - prevues
  fichesASaisir: number;
};

export type HeuresOperateur = { operateur: string; heures: number };

export type HeuresDossier = {
  id: number;
  nom: string;
  client: string;
  statut: string;
  prevu: number;
  periode: number;
  cumul: number;
};

export type RapportHeures = {
  indicateurs: IndicateursHeures;
  operateurs: HeuresOperateur[];
  dossiers: HeuresDossier[];
};

// Rapport d'une période, éventuellement restreint à un dossier.
export async function rapportHeures(p: Periode, dossierId: number | null): Promise<RapportHeures> {
  await ensureDocuments();
  const [ops, dos, ind] = await Promise.all([
    sql`SELECT operateur, sum(heures_passees)::float8 AS heures
      FROM heures
      WHERE date >= ${p.debut} AND date <= ${p.fin}
        AND (${dossierId}::bigint IS NULL OR dossier_id = ${dossierId})
      GROUP BY operateur
      HAVING sum(heures_passees) > 0
      ORDER BY heures DESC, operateur`,
    // Dossiers travaillés sur la période : heures de la période, cumul depuis
    // l'ouverture et prévu.
    sql`SELECT d.id, d.nom_dossier, d.client_nom, d.statut,
        coalesce(d.heures_a_realiser, 0)::float8 AS prevu,
        coalesce(sum(h.heures_passees) FILTER (
          WHERE h.date >= ${p.debut} AND h.date <= ${p.fin}), 0)::float8 AS periode,
        coalesce(sum(h.heures_passees), 0)::float8 AS cumul
      FROM dossiers d
      JOIN heures h ON h.dossier_id = d.id
      WHERE ${dossierId}::bigint IS NULL OR d.id = ${dossierId}
      GROUP BY d.id
      HAVING sum(h.heures_passees) FILTER (
        WHERE h.date >= ${p.debut} AND h.date <= ${p.fin}) > 0
      ORDER BY periode DESC, d.nom_dossier`,
    sql`WITH par_dossier AS (
        SELECT d.id, coalesce(d.heures_a_realiser, 0) AS prevu,
          sum(h.heures_passees) AS cumul
        FROM dossiers d
        JOIN heures h ON h.dossier_id = d.id
        WHERE ${dossierId}::bigint IS NULL OR d.id = ${dossierId}
        GROUP BY d.id
        HAVING sum(h.heures_passees) FILTER (
          WHERE h.date >= ${p.debut} AND h.date <= ${p.fin}) > 0
      )
      SELECT
        (SELECT coalesce(sum(heures_passees), 0) FROM heures
          WHERE date >= ${p.debut} AND date <= ${p.fin}
            AND (${dossierId}::bigint IS NULL OR dossier_id = ${dossierId}))::float8 AS pointees,
        (SELECT coalesce(sum(prevu), 0) FROM par_dossier WHERE prevu > 0)::float8 AS prevues,
        (SELECT coalesce(sum(cumul), 0) FROM par_dossier WHERE prevu > 0)::float8 AS realisees,
        (SELECT count(*) FROM fiches_navettes WHERE statut = 'a_saisir')::int AS a_saisir`,
  ]);
  const i = ind[0] ?? {};
  const prevues = Number(i.prevues) || 0;
  const realisees = Number(i.realisees) || 0;
  return {
    indicateurs: {
      pointees: Number(i.pointees) || 0,
      prevues,
      realisees,
      ecart: realisees - prevues,
      fichesASaisir: Number(i.a_saisir) || 0,
    },
    operateurs: ops.map((r) => ({ operateur: String(r.operateur), heures: Number(r.heures) })),
    dossiers: dos.map((r) => ({
      id: Number(r.id),
      nom: String(r.nom_dossier),
      client: String(r.client_nom ?? ""),
      statut: String(r.statut ?? ""),
      prevu: Number(r.prevu),
      periode: Number(r.periode),
      cumul: Number(r.cumul),
    })),
  };
}

// Dossiers qui ont au moins une heure saisie (filtre « par dossier »).
export async function dossiersAvecHeures(): Promise<{ id: number; nom: string }[]> {
  const rows = await sql`SELECT d.id, d.nom_dossier FROM dossiers d
    WHERE EXISTS (SELECT 1 FROM heures h WHERE h.dossier_id = d.id)
    ORDER BY lower(d.nom_dossier)`;
  return rows.map((r) => ({ id: Number(r.id), nom: String(r.nom_dossier) }));
}

export type LigneHeures = {
  date: string;
  operateur: string;
  typeTravail: string;
  typeRealisation: string;
  nombre: number | null;
  heures: number;
  description: string;
};

export type RapportDossier = {
  id: number;
  nom: string;
  client: string;
  statut: string;
  prevu: number;
  total: number;
  parOperateur: HeuresOperateur[];
  parType: { type: string; heures: number }[];
  lignes: LigneHeures[];
};

// Tout le temps passé sur un dossier, pour l'export PDF.
export async function rapportDossier(id: number): Promise<RapportDossier | null> {
  const [d] = await sql`SELECT id, nom_dossier, client_nom, statut,
      coalesce(heures_a_realiser, 0)::float8 AS prevu
    FROM dossiers WHERE id = ${id}`;
  if (!d) return null;
  const [ops, types, lignes] = await Promise.all([
    sql`SELECT operateur, sum(heures_passees)::float8 AS heures FROM heures
      WHERE dossier_id = ${id} GROUP BY operateur ORDER BY heures DESC, operateur`,
    sql`SELECT coalesce(nullif(type_travail, ''), 'Autre') AS type,
        sum(heures_passees)::float8 AS heures
      FROM heures WHERE dossier_id = ${id} GROUP BY 1 ORDER BY heures DESC`,
    sql`SELECT date, operateur, coalesce(type_travail, '') AS type_travail,
        coalesce(type_realisation, '') AS type_realisation, nombre,
        heures_passees::float8 AS heures, coalesce(description, '') AS description
      FROM heures WHERE dossier_id = ${id} ORDER BY date, id`,
  ]);
  const parOperateur = ops.map((r) => ({ operateur: String(r.operateur), heures: Number(r.heures) }));
  return {
    id: Number(d.id),
    nom: String(d.nom_dossier),
    client: String(d.client_nom ?? ""),
    statut: String(d.statut ?? ""),
    prevu: Number(d.prevu),
    total: parOperateur.reduce((s, o) => s + o.heures, 0),
    parOperateur,
    parType: types.map((r) => ({ type: String(r.type), heures: Number(r.heures) })),
    lignes: lignes.map((r) => ({
      date: String(r.date),
      operateur: String(r.operateur),
      typeTravail: String(r.type_travail),
      typeRealisation: String(r.type_realisation),
      nombre: r.nombre == null ? null : Number(r.nombre),
      heures: Number(r.heures),
      description: String(r.description),
    })),
  };
}
