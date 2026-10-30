// Catégories du module Documents (2e niveau de l'arborescence, sous le dossier
// client). La catégorie « Planning » a été retirée (phase 7 annulée) : un
// éventuel fichier encore classé « planning » s'affiche dans « Autres ». Module sans dépendance serveur : importable depuis un composant
// client. Réexporté par lib/documents-db.ts.
export const CATEGORIES_DOCUMENT = [
  { cle: "devis_facture", libelle: "Devis & factures" },
  { cle: "commande", libelle: "Commandes" },
  { cle: "plan_dessin", libelle: "Plans & dessins" },
  { cle: "photo", libelle: "Photos" },
  { cle: "heures", libelle: "Heures" },
  { cle: "fiche_navette", libelle: "Fiches navettes" },
  { cle: "autre", libelle: "Autres" },
] as const;

export type CategorieDocument = (typeof CATEGORIES_DOCUMENT)[number]["cle"];
