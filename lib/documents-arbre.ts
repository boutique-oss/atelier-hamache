// Lecture du module Documents pour l'affichage : compteurs des rubriques,
// liste des dossiers clients, arborescence d'un dossier (catégories puis
// sous-dossiers libres) et ses fichiers. Les fichiers déjà présents ailleurs
// (devis signés, PDF fournisseurs importés, PDF joints aux fiches atelier)
// sont lus là où ils sont, sans recopie : ils apparaissent en lecture seule.
import { sql } from "@/lib/raw-sql";
import { ensureImports } from "@/lib/commande-imports-db";
import { ensurePiecesJointes } from "@/lib/fiche-pieces-db";
import {
  CATEGORIES_DOCUMENT,
  ensureDocuments,
  type CategorieDocument,
  type DocDossier,
} from "@/lib/documents-db";

// D'où vient un fichier affiché dans l'arbre : la table `documents` (module
// Documents) ou une table existante (lecture seule ici).
export type SourceFichier = "document" | "devis" | "commande" | "fiche";

export type FichierListe = {
  /** Clé unique toutes sources confondues, ex. « devis-12 ». */
  cle: string;
  id: number;
  source: SourceFichier;
  categorie: CategorieDocument;
  docDossierId: number | null;
  nom: string;
  contentType: string | null;
  origine: string;
  auteur: string | null;
  createdAt: string;
  href: string;
  hrefTelechargement: string;
  lectureSeule: boolean;
};

export type ArbreDossier = {
  dossierId: number;
  sousDossiers: DocDossier[];
  fichiers: FichierListe[];
};

export type DossierDocs = {
  id: number;
  nom: string;
  client: string;
  statut: string;
  nbFichiers: number;
};

export type CompteursRubriques = {
  clients: number;
  commandes: number;
  heures: number;
  pointages: number;
};

const CLES = new Set<string>(CATEGORIES_DOCUMENT.map((c) => c.cle));
const categorieSure = (v: unknown): CategorieDocument =>
  CLES.has(String(v)) ? (String(v) as CategorieDocument) : "autre";

const ORIGINES: Record<string, string> = {
  depose: "Déposé",
  genere: "Généré",
  scan: "Scan",
};

// Toutes les tables lues ici existent (créées à la volée si besoin).
async function pret() {
  await Promise.all([ensureDocuments(), ensureImports(), ensurePiecesJointes()]);
}

export async function compteursRubriques(): Promise<CompteursRubriques> {
  await pret();
  const [r] = await sql`SELECT
      (SELECT count(*) FROM documents WHERE dossier_id IS NOT NULL)
        + (SELECT count(*) FROM devis_signes WHERE dossier_id IS NOT NULL)
        + (SELECT count(DISTINCT import_id) FROM commandes
            WHERE import_id IS NOT NULL AND dossier_id IS NOT NULL)
        + (SELECT count(*) FROM fiche_pieces_jointes p
            JOIN fiches_atelier f ON f.id = p.fiche_id
            WHERE f.dossier_id IS NOT NULL) AS clients,
      (SELECT count(*) FROM documents WHERE categorie = 'commande')
        + (SELECT count(*) FROM commande_imports) AS commandes,
      (SELECT count(*) FROM documents WHERE categorie = 'heures') AS heures,
      (SELECT count(*) FROM fiches_navettes) AS pointages`;
  return {
    clients: Number(r?.clients) || 0,
    commandes: Number(r?.commandes) || 0,
    heures: Number(r?.heures) || 0,
    pointages: Number(r?.pointages) || 0,
  };
}

// Dossiers clients (les plus récents d'abord) avec leur nombre de fichiers,
// toutes sources confondues. `q` filtre sur le nom du dossier ou du client.
export async function listerDossiersDocs(q: string): Promise<DossierDocs[]> {
  await pret();
  const motif = `%${q.trim()}%`;
  const rows = await sql`SELECT d.id, d.nom_dossier, d.client_nom, d.statut,
      (SELECT count(*) FROM documents x
          WHERE x.dossier_id = d.id
             OR x.commande_id IN (SELECT id FROM commandes WHERE dossier_id = d.id))
        + (SELECT count(*) FROM devis_signes v WHERE v.dossier_id = d.id)
        + (SELECT count(DISTINCT c.import_id) FROM commandes c
            WHERE c.dossier_id = d.id AND c.import_id IS NOT NULL)
        + (SELECT count(*) FROM fiche_pieces_jointes p
            JOIN fiches_atelier f ON f.id = p.fiche_id
            WHERE f.dossier_id = d.id) AS nb
    FROM dossiers d
    WHERE ${q.trim() === ""}
       OR d.nom_dossier ILIKE ${motif} OR d.client_nom ILIKE ${motif}
    ORDER BY d.id DESC
    LIMIT 300`;
  return rows.map((r) => ({
    id: Number(r.id),
    nom: String(r.nom_dossier ?? ""),
    client: String(r.client_nom ?? ""),
    statut: String(r.statut ?? "Nouveau"),
    nbFichiers: Number(r.nb) || 0,
  }));
}

export async function lireDossierDocs(id: number): Promise<DossierDocs | null> {
  const [r] = await sql`SELECT id, nom_dossier, client_nom, statut
    FROM dossiers WHERE id = ${id}`;
  if (!r) return null;
  return {
    id: Number(r.id),
    nom: String(r.nom_dossier ?? ""),
    client: String(r.client_nom ?? ""),
    statut: String(r.statut ?? "Nouveau"),
    nbFichiers: 0,
  };
}

// Arborescence complète d'un dossier client : sous-dossiers libres (requête
// récursive depuis les racines, triés par chemin) + tous ses fichiers.
export async function arbreDossier(dossierId: number): Promise<ArbreDossier> {
  await pret();
  const [sd, docs, devis, imports, pieces] = await Promise.all([
    sql`WITH RECURSIVE arbre AS (
        SELECT id, parent_id, dossier_id, categorie, nom, created_at,
               ARRAY[lower(nom)] AS chemin
          FROM doc_dossiers
          WHERE dossier_id = ${dossierId} AND parent_id IS NULL
        UNION ALL
        SELECT e.id, e.parent_id, e.dossier_id, e.categorie, e.nom, e.created_at,
               a.chemin || lower(e.nom)
          FROM doc_dossiers e JOIN arbre a ON e.parent_id = a.id
      )
      SELECT id, parent_id, dossier_id, categorie, nom, created_at
        FROM arbre ORDER BY categorie, chemin`,
    sql`SELECT id, dossier_id, doc_dossier_id, categorie, origine, nom,
          content_type, cree_par, created_at
        FROM documents
        WHERE dossier_id = ${dossierId}
           OR commande_id IN (SELECT id FROM commandes WHERE dossier_id = ${dossierId})
        ORDER BY created_at DESC, id DESC`,
    sql`SELECT id, nom_fichier, content_type, created_at FROM devis_signes
        WHERE dossier_id = ${dossierId} ORDER BY id DESC`,
    sql`SELECT i.id, i.nom_fichier, i.fournisseur, i.content_type, i.created_at
        FROM commande_imports i
        WHERE i.id IN (SELECT import_id FROM commandes
                        WHERE dossier_id = ${dossierId} AND import_id IS NOT NULL)
        ORDER BY i.id DESC`,
    sql`SELECT p.id, p.nom_fichier, p.created_at, f.type_intervention
        FROM fiche_pieces_jointes p JOIN fiches_atelier f ON f.id = p.fiche_id
        WHERE f.dossier_id = ${dossierId}
        ORDER BY p.id DESC`,
  ]);

  const fichiers: FichierListe[] = [
    ...docs.map((r) => {
      const id = Number(r.id);
      return {
        cle: `document-${id}`,
        id,
        source: "document" as const,
        categorie: categorieSure(r.categorie),
        docDossierId: r.doc_dossier_id == null ? null : Number(r.doc_dossier_id),
        nom: String(r.nom ?? ""),
        contentType: r.content_type == null ? null : String(r.content_type),
        origine: ORIGINES[String(r.origine)] ?? "Déposé",
        auteur: r.cree_par == null ? null : String(r.cree_par),
        createdAt: String(r.created_at ?? ""),
        href: `/api/documents/${id}`,
        hrefTelechargement: `/api/documents/${id}?download=1`,
        lectureSeule: false,
      };
    }),
    ...devis.map((r) => {
      const id = Number(r.id);
      return {
        cle: `devis-${id}`,
        id,
        source: "devis" as const,
        categorie: "devis_facture" as const,
        docDossierId: null,
        nom: String(r.nom_fichier ?? "Devis signé"),
        contentType: r.content_type == null ? "application/pdf" : String(r.content_type),
        origine: "Devis signé",
        auteur: null,
        createdAt: String(r.created_at ?? ""),
        href: `/api/devis/${id}`,
        hrefTelechargement: `/api/devis/${id}?download=1`,
        lectureSeule: true,
      };
    }),
    ...imports.map((r) => {
      const id = Number(r.id);
      const fournisseur = String(r.fournisseur ?? "").trim();
      return {
        cle: `commande-${id}`,
        id,
        source: "commande" as const,
        categorie: "commande" as const,
        docDossierId: null,
        nom: String(r.nom_fichier || `PDF ${fournisseur || "fournisseur"}`),
        contentType: r.content_type == null ? "application/pdf" : String(r.content_type),
        origine: fournisseur ? `Import ${fournisseur}` : "Import commande",
        auteur: null,
        createdAt: String(r.created_at ?? ""),
        href: `/api/commandes-import/${id}`,
        hrefTelechargement: `/api/commandes-import/${id}?download=1`,
        lectureSeule: true,
      };
    }),
    ...pieces.map((r) => {
      const id = Number(r.id);
      return {
        cle: `fiche-${id}`,
        id,
        source: "fiche" as const,
        categorie: "plan_dessin" as const,
        docDossierId: null,
        nom: String(r.nom_fichier || "Prise de cotes"),
        contentType: "application/pdf",
        origine: `Fiche ${String(r.type_intervention ?? "atelier").toLowerCase()}`,
        auteur: null,
        createdAt: String(r.created_at ?? ""),
        href: `/api/fiche-pdf/${id}`,
        hrefTelechargement: `/api/fiche-pdf/${id}?download=1`,
        lectureSeule: true,
      };
    }),
  ].sort((a, b) => b.createdAt.localeCompare(a.createdAt));

  return {
    dossierId,
    sousDossiers: sd.map((r) => ({
      id: Number(r.id),
      parentId: r.parent_id == null ? null : Number(r.parent_id),
      dossierId: r.dossier_id == null ? null : Number(r.dossier_id),
      categorie: categorieSure(r.categorie),
      nom: String(r.nom ?? ""),
      createdAt: String(r.created_at ?? ""),
    })),
    fichiers,
  };
}
