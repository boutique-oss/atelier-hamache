// Rubrique Commandes du module Documents : les commandes fournisseur
// existantes avec leurs pièces jointes. Deux sources de PDF, sans recopie :
// le PDF fournisseur importé (commande_imports via commandes.import_id) et
// les fichiers déposés dans `documents` avec commande_id renseigné (ils
// apparaissent aussi dans le dossier client, catégorie « Commandes »).
import { sql } from "@/lib/raw-sql";
import { ensureImports } from "@/lib/commande-imports-db";
import { ensureDocuments } from "@/lib/documents-db";

// Même découpage que la page Commandes : « Reçu » = commandé ET reçu.
export const STATUTS_COMMANDE = [
  { cle: "a_commander", libelle: "À commander", cls: "bg-amber-100 text-amber-800" },
  { cle: "a_recevoir", libelle: "À recevoir", cls: "bg-sky-100 text-sky-800" },
  { cle: "recu", libelle: "Reçu", cls: "bg-emerald-100 text-emerald-800" },
] as const;

export type StatutCommande = (typeof STATUTS_COMMANDE)[number]["cle"];

export function statutCommande(estCommande: boolean, estRecu: boolean): StatutCommande {
  if (!estCommande) return "a_commander";
  return estRecu ? "recu" : "a_recevoir";
}

export type PieceCommande = { cle: string; nom: string; href: string };

export type CommandeDocs = {
  id: number;
  dossierId: number | null;
  dossierNom: string | null;
  fournisseur: string;
  article: string;
  dateCde: string | null;
  statut: StatutCommande;
  pieces: PieceCommande[];
};

export type FiltresCommandes = {
  statut: StatutCommande | "";
  fournisseur: string;
  dossierId: number | null;
};

const LIMITE = 300;

// Fournisseur tel qu'il est regroupé ailleurs (espaces normalisés).
const nomFournisseur = (v: unknown) => String(v ?? "").trim().replace(/\s+/g, " ");

export async function listerCommandesDocs(
  f: FiltresCommandes
): Promise<{ commandes: CommandeDocs[]; tronque: boolean }> {
  await Promise.all([ensureDocuments(), ensureImports()]);
  const rows = await sql`SELECT c.id, c.dossier_id, d.nom_dossier, c.fournisseur,
      c.designation, c.reference, c.coloris, c.date_cde,
      coalesce(c.est_commande, false) AS est_commande,
      coalesce(c.est_recu, false) AS est_recu,
      c.import_id, i.nom_fichier AS import_nom
    FROM commandes c
    LEFT JOIN dossiers d ON d.id = c.dossier_id
    LEFT JOIN commande_imports i ON i.id = c.import_id
    WHERE (${f.statut} = ''
        OR (${f.statut} = 'a_commander' AND NOT coalesce(c.est_commande, false))
        OR (${f.statut} = 'a_recevoir' AND coalesce(c.est_commande, false)
            AND NOT coalesce(c.est_recu, false))
        OR (${f.statut} = 'recu' AND coalesce(c.est_commande, false)
            AND coalesce(c.est_recu, false)))
      AND (${f.fournisseur} = ''
        OR lower(regexp_replace(trim(coalesce(c.fournisseur, '')), '[[:space:]]+', ' ', 'g'))
           = lower(${f.fournisseur}))
      AND (${f.dossierId}::bigint IS NULL OR c.dossier_id = ${f.dossierId}::bigint)
    ORDER BY c.id DESC
    LIMIT ${LIMITE + 1}`;

  const tronque = rows.length > LIMITE;
  const lignes = rows.slice(0, LIMITE);
  const ids = lignes.map((r) => Number(r.id));

  // Fichiers déposés sur ces commandes (module Documents).
  const deposes = ids.length
    ? await sql`SELECT id, commande_id, nom FROM documents
        WHERE commande_id = ANY(${ids}) ORDER BY id`
    : [];
  const parCommande = new Map<number, PieceCommande[]>();
  for (const r of deposes) {
    const k = Number(r.commande_id);
    const id = Number(r.id);
    parCommande.set(k, [
      ...(parCommande.get(k) ?? []),
      { cle: `document-${id}`, nom: String(r.nom ?? "Fichier"), href: `/api/documents/${id}` },
    ]);
  }

  return {
    tronque,
    commandes: lignes.map((r) => {
      const id = Number(r.id);
      const pieces: PieceCommande[] = [];
      if (r.import_id != null) {
        const imp = Number(r.import_id);
        pieces.push({
          cle: `commande-${imp}`,
          nom: String(r.import_nom || "PDF fournisseur"),
          href: `/api/commandes-import/${imp}`,
        });
      }
      pieces.push(...(parCommande.get(id) ?? []));
      const article = [r.designation, r.reference, r.coloris]
        .map((v) => String(v ?? "").trim())
        .filter(Boolean)
        .join(" · ");
      return {
        id,
        dossierId: r.dossier_id == null ? null : Number(r.dossier_id),
        dossierNom: r.nom_dossier == null ? null : String(r.nom_dossier),
        fournisseur: nomFournisseur(r.fournisseur),
        article,
        dateCde: r.date_cde == null ? null : String(r.date_cde),
        statut: statutCommande(Boolean(r.est_commande), Boolean(r.est_recu)),
        pieces,
      };
    }),
  };
}

// Valeurs proposées dans les filtres : fournisseurs et dossiers qui ont au
// moins une commande.
export async function optionsFiltresCommandes(): Promise<{
  fournisseurs: string[];
  dossiers: { id: number; nom: string }[];
}> {
  const [fourn, doss] = await Promise.all([
    sql`SELECT DISTINCT regexp_replace(trim(fournisseur), '[[:space:]]+', ' ', 'g') AS f
      FROM commandes WHERE trim(coalesce(fournisseur, '')) <> ''`,
    sql`SELECT DISTINCT d.id, d.nom_dossier FROM dossiers d
      JOIN commandes c ON c.dossier_id = d.id`,
  ]);
  // Dédoublonnage insensible à la casse (« Casal » / « CASAL »).
  const vus = new Map<string, string>();
  for (const r of fourn) {
    const n = String(r.f ?? "");
    if (n && !vus.has(n.toLowerCase())) vus.set(n.toLowerCase(), n);
  }
  return {
    fournisseurs: [...vus.values()].sort((a, b) => a.localeCompare(b, "fr")),
    dossiers: doss
      .map((r) => ({ id: Number(r.id), nom: String(r.nom_dossier ?? "") }))
      .sort((a, b) => a.nom.localeCompare(b.nom, "fr")),
  };
}
