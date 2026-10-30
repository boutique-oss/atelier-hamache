// Module Documents : classement des fichiers par dossier client, en
// arborescence. Les 2 premiers niveaux sont virtuels (Dossier client →
// Catégorie) ; à partir du 3e, des sous-dossiers libres (doc_dossiers,
// récursif via parent_id). Les fichiers sont sur Vercel Blob (store PRIVÉ),
// la table `documents` n'en garde que le pathname et les métadonnées.
// Planning (bons_atelier) et Pointages (fiches_navettes) vivent ici aussi.
// Hors schéma Drizzle (SQL brut), créé à la volée. Migrations additives
// uniquement : aucune suppression ni renommage.
import { sql } from "@/lib/raw-sql";

export const CATEGORIES_DOCUMENT = [
  { cle: "devis_facture", libelle: "Devis & factures" },
  { cle: "commande", libelle: "Commandes" },
  { cle: "plan_dessin", libelle: "Plans & dessins" },
  { cle: "photo", libelle: "Photos" },
  { cle: "planning", libelle: "Planning" },
  { cle: "heures", libelle: "Heures" },
  { cle: "fiche_navette", libelle: "Fiches navettes" },
  { cle: "autre", libelle: "Autres" },
] as const;

export type CategorieDocument = (typeof CATEGORIES_DOCUMENT)[number]["cle"];
export type OrigineDocument = "depose" | "genere" | "scan";
export type StatutFicheNavette = "a_saisir" | "verifiee" | "integree";
export type StatutBonAtelier = "planifie" | "en_cours" | "termine";

export type DocDossier = {
  id: number;
  parentId: number | null;
  dossierId: number | null;
  categorie: CategorieDocument;
  nom: string;
  createdAt: string;
};

export type DocumentFichier = {
  id: number;
  dossierId: number | null;
  docDossierId: number | null;
  categorie: CategorieDocument;
  origine: OrigineDocument;
  nom: string;
  pathname: string;
  contentType: string | null;
  taille: number | null;
  commandeId: number | null;
  creePar: string | null;
  createdAt: string;
};

export type FicheNavette = {
  id: number;
  operateur: string;
  semaineIso: string;
  documentId: number | null;
  statut: StatutFicheNavette;
  createdAt: string;
};

export type BonAtelier = {
  id: number;
  dossierId: number;
  commandeId: number | null;
  operateur: string;
  libelle: string;
  dateDebut: string;
  dateFin: string;
  heuresPrevues: number | null;
  statut: StatutBonAtelier;
};

let pret: Promise<void> | null = null;

export function ensureDocuments(): Promise<void> {
  if (!pret) {
    pret = (async () => {
      // Sous-dossiers libres. parent_id NULL = directement sous la catégorie
      // du dossier client. RESTRICT : on ne supprime pas un sous-dossier qui
      // en contient d'autres.
      await sql`CREATE TABLE IF NOT EXISTS doc_dossiers (
        id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
        parent_id bigint REFERENCES doc_dossiers(id) ON DELETE RESTRICT,
        dossier_id bigint REFERENCES dossiers(id) ON DELETE CASCADE,
        categorie text NOT NULL DEFAULT 'autre',
        nom text NOT NULL,
        created_at timestamptz DEFAULT now()
      )`;
      await sql`CREATE INDEX IF NOT EXISTS doc_dossiers_parent_idx
        ON doc_dossiers (parent_id)`;
      await sql`CREATE INDEX IF NOT EXISTS doc_dossiers_dossier_idx
        ON doc_dossiers (dossier_id, categorie)`;
      // Pas deux sous-dossiers du même nom au même endroit.
      await sql`CREATE UNIQUE INDEX IF NOT EXISTS doc_dossiers_nom_key
        ON doc_dossiers (coalesce(dossier_id, 0), categorie,
          coalesce(parent_id, 0), lower(nom))`;

      // Tous les fichiers, quelle que soit la rubrique. dossier_id SET NULL :
      // supprimer un dossier client ne fait pas disparaître ses fichiers, ils
      // passent dans « Non classés ».
      await sql`CREATE TABLE IF NOT EXISTS documents (
        id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
        dossier_id bigint REFERENCES dossiers(id) ON DELETE SET NULL,
        doc_dossier_id bigint REFERENCES doc_dossiers(id) ON DELETE SET NULL,
        categorie text NOT NULL DEFAULT 'autre',
        origine text NOT NULL DEFAULT 'depose',
        nom text NOT NULL,
        pathname text NOT NULL,
        url text NOT NULL,
        content_type text,
        taille integer,
        commande_id bigint REFERENCES commandes(id) ON DELETE SET NULL,
        cree_par text,
        created_at timestamptz DEFAULT now()
      )`;
      await sql`CREATE INDEX IF NOT EXISTS documents_dossier_cat_idx
        ON documents (dossier_id, categorie)`;
      await sql`CREATE INDEX IF NOT EXISTS documents_doc_dossier_idx
        ON documents (doc_dossier_id)`;
      await sql`CREATE INDEX IF NOT EXISTS documents_commande_idx
        ON documents (commande_id)`;

      // Pointages : une fiche navette papier scannée = une ligne.
      await sql`CREATE TABLE IF NOT EXISTS fiches_navettes (
        id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
        operateur text NOT NULL,
        semaine_iso text NOT NULL,
        document_id bigint REFERENCES documents(id) ON DELETE SET NULL,
        statut text NOT NULL DEFAULT 'a_saisir',
        created_at timestamptz DEFAULT now()
      )`;
      await sql`CREATE INDEX IF NOT EXISTS fiches_navettes_op_semaine_idx
        ON fiches_navettes (operateur, semaine_iso)`;

      // Planning : un bon atelier = une tâche planifiée pour un opérateur.
      await sql`CREATE TABLE IF NOT EXISTS bons_atelier (
        id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
        dossier_id bigint NOT NULL REFERENCES dossiers(id) ON DELETE CASCADE,
        commande_id bigint REFERENCES commandes(id) ON DELETE SET NULL,
        operateur text NOT NULL,
        libelle text NOT NULL,
        date_debut date NOT NULL,
        date_fin date NOT NULL,
        heures_prevues real,
        statut text NOT NULL DEFAULT 'planifie',
        created_at timestamptz DEFAULT now()
      )`;
      await sql`CREATE INDEX IF NOT EXISTS bons_atelier_dates_idx
        ON bons_atelier (date_debut, date_fin)`;
      await sql`CREATE INDEX IF NOT EXISTS bons_atelier_dossier_idx
        ON bons_atelier (dossier_id)`;

      // Lignes d'heures saisies depuis une fiche navette. Les heures prévues
      // restent dossiers.heures_a_realiser (rien à ajouter).
      await sql`ALTER TABLE heures ADD COLUMN IF NOT EXISTS fiche_navette_id bigint
        REFERENCES fiches_navettes(id) ON DELETE SET NULL`;
      await sql`CREATE INDEX IF NOT EXISTS heures_dossier_idx ON heures (dossier_id)`;
      await sql`CREATE INDEX IF NOT EXISTS heures_op_date_idx ON heures (operateur, date)`;
    })().catch((e) => {
      pret = null;
      throw e;
    });
  }
  return pret;
}
