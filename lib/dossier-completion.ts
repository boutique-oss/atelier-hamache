// Calcule le taux de « remplissage » d'un dossier à partir d'une liste de
// champs importants. Sert à la barre de progression + au détail des champs
// manquants (clic droit) dans la liste des dossiers.

export type DossierCompletionInput = {
  clientNom: string | null;
  telephone: string | null;
  email: string | null;
  adresse: string | null;
  typeIntervention: string | null;
  dateOuverture: string | null;
  dateDevis: string | null;
  dateDebutChantier: string | null;
  heuresARealiser: number | null;
  operateurId: number | null;
};

export type CompletionItem = { label: string; filled: boolean };

export type DossierCompletion = {
  items: CompletionItem[];
  filledCount: number;
  total: number;
  pct: number;
};

export function dossierCompletion(d: DossierCompletionInput): DossierCompletion {
  const has = (v: unknown) =>
    v != null && String(v).trim() !== "";

  const items: CompletionItem[] = [
    { label: "Client", filled: has(d.clientNom) },
    { label: "Téléphone", filled: has(d.telephone) },
    { label: "Email", filled: has(d.email) },
    { label: "Adresse", filled: has(d.adresse) },
    { label: "Type d'intervention", filled: has(d.typeIntervention) },
    { label: "Date d'ouverture", filled: has(d.dateOuverture) },
    { label: "Date de devis", filled: has(d.dateDevis) },
    { label: "Semaine de chantier", filled: has(d.dateDebutChantier) },
    { label: "Heures à réaliser", filled: (d.heuresARealiser ?? 0) > 0 },
    { label: "Opérateur affecté", filled: d.operateurId != null },
  ];

  const filledCount = items.filter((i) => i.filled).length;
  const total = items.length;
  const pct = total ? Math.round((filledCount / total) * 100) : 0;
  return { items, filledCount, total, pct };
}
