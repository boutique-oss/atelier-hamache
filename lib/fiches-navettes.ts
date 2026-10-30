// Pointages : fiches navettes papier, photographiées en atelier puis saisies
// au bureau. Une fiche = un opérateur × une semaine ISO. Elle sert UNIQUEMENT
// au pointage de PRÉSENCE (table `pointage`, paie) : rien n'est écrit dans
// `heures` (temps par dossier). Le scan est un document (catégorie
// fiche_navette, origine scan) servi par /api/documents/[id].
import { ensureDocuments, type StatutFicheNavette } from "@/lib/documents-db";
import { JOURS_FICHE } from "@/lib/fiches-navettes-const";
import { ajouterJours, feriesFR, lundiDe } from "@/lib/pointage";
import { sql } from "@/lib/raw-sql";

export { JOURS_FICHE, SEUIL_JOUR, STATUTS_FICHE, TYPES_JOUR, TYPES_NEUTRES } from "@/lib/fiches-navettes-const";

// « 2026-W44 » à partir du lundi AAAA-MM-JJ (norme ISO 8601 : la semaine 1
// contient le 4 janvier ; l'année est celle du jeudi de la semaine).
export function semaineIsoDe(lundi: string): string {
  const jeudi = ajouterJours(lundi, 3);
  const annee = Number(jeudi.slice(0, 4));
  const jours = (Date.parse(jeudi) - Date.UTC(annee, 0, 1)) / 86400000;
  return `${annee}-W${String(Math.floor(jours / 7) + 1).padStart(2, "0")}`;
}

// Lundi AAAA-MM-JJ d'une semaine « 2026-W44 » (null si invalide).
export function lundiDeSemaineIso(s: string): string | null {
  const m = /^(\d{4})-W(\d{2})$/.exec(s);
  if (!m) return null;
  const semaine = Number(m[2]);
  if (semaine < 1 || semaine > 53) return null;
  const lundiS1 = lundiDe(new Date(Date.UTC(Number(m[1]), 0, 4)));
  return ajouterJours(lundiS1, (semaine - 1) * 7);
}

const jjmm = (iso: string) => `${iso.slice(8)}/${iso.slice(5, 7)}`;

export function libelleSemaine(semaineIso: string): string {
  const lundi = lundiDeSemaineIso(semaineIso);
  if (!lundi) return semaineIso;
  return `Semaine ${semaineIso.slice(6)} · ${jjmm(lundi)} → ${jjmm(ajouterJours(lundi, 5))}/${ajouterJours(lundi, 5).slice(0, 4)}`;
}

export type FicheNavetteListe = {
  id: number;
  operateur: string;
  semaineIso: string;
  statut: StatutFicheNavette;
  documentId: number | null;
  createdAt: string;
};

export async function listerFiches(statut: StatutFicheNavette | ""): Promise<FicheNavetteListe[]> {
  await ensureDocuments();
  const rows = await sql`SELECT id, operateur, semaine_iso, statut, document_id, created_at
    FROM fiches_navettes
    WHERE ${statut} = '' OR statut = ${statut}
    ORDER BY (statut = 'integree'), semaine_iso DESC, operateur, id DESC
    LIMIT 200`;
  return rows.map((r) => ({
    id: Number(r.id),
    operateur: String(r.operateur),
    semaineIso: String(r.semaine_iso),
    statut: r.statut as StatutFicheNavette,
    documentId: r.document_id == null ? null : Number(r.document_id),
    createdAt: String(r.created_at),
  }));
}

export type JourFiche = {
  date: string;
  libelle: string;
  ferie: string | null;
  // Ce qui est déjà dans `pointage` pour ce jour (null = case vide).
  existant: { type: string; heures: number } | null;
};

export type FicheNavetteDetail = FicheNavetteListe & {
  lundi: string;
  hJour: number; // heures d'une journée du contrat (h/semaine ÷ 5)
  document: { id: number; nom: string; contentType: string } | null;
  jours: JourFiche[];
  autresIntegrees: number; // autres fiches déjà intégrées, même opérateur + semaine
};

export async function lireFiche(id: number): Promise<FicheNavetteDetail | null> {
  await ensureDocuments();
  const [f] = await sql`SELECT f.id, f.operateur, f.semaine_iso, f.statut, f.document_id, f.created_at,
      d.nom AS doc_nom, d.content_type AS doc_type,
      (SELECT heures_semaine FROM operateurs o WHERE o.nom = f.operateur) AS heures_semaine,
      (SELECT count(*) FROM fiches_navettes x WHERE x.operateur = f.operateur
        AND x.semaine_iso = f.semaine_iso AND x.statut = 'integree' AND x.id <> f.id)::int AS autres
    FROM fiches_navettes f
    LEFT JOIN documents d ON d.id = f.document_id
    WHERE f.id = ${id}`;
  if (!f) return null;
  const lundi = lundiDeSemaineIso(String(f.semaine_iso));
  if (!lundi) return null;
  const samedi = ajouterJours(lundi, 5);
  const existants = await sql`SELECT date, type, heures FROM pointage
    WHERE operateur = ${f.operateur} AND date >= ${lundi} AND date <= ${samedi}`;
  const parDate = new Map(existants.map((r) => [String(r.date), r]));
  const feries = new Map([...feriesFR(Number(lundi.slice(0, 4))), ...feriesFR(Number(samedi.slice(0, 4)))]);
  return {
    id: Number(f.id),
    operateur: String(f.operateur),
    semaineIso: String(f.semaine_iso),
    statut: f.statut as StatutFicheNavette,
    documentId: f.document_id == null ? null : Number(f.document_id),
    createdAt: String(f.created_at),
    lundi,
    hJour: (Number(f.heures_semaine) || 35) / 5,
    document:
      f.document_id == null
        ? null
        : { id: Number(f.document_id), nom: String(f.doc_nom ?? "Scan"), contentType: String(f.doc_type ?? "") },
    jours: JOURS_FICHE.map((libelle, i) => {
      const date = ajouterJours(lundi, i);
      const e = parDate.get(date);
      return {
        date,
        libelle,
        ferie: feries.get(date) ?? null,
        existant: e ? { type: String(e.type ?? "Travail"), heures: Number(e.heures ?? 0) } : null,
      };
    }),
    autresIntegrees: Number(f.autres) || 0,
  };
}

// Opérateurs qui remplissent une fiche navette : actifs, hors dirigeant
// (le dirigeant n'est pas au pointage de présence).
export async function operateursPointage(): Promise<string[]> {
  const rows = await sql`SELECT nom FROM operateurs
    WHERE actif = true AND coalesce(est_dirigeant, false) = false ORDER BY lower(nom)`;
  return rows.map((r) => String(r.nom));
}
