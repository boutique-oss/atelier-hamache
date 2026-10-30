// Helpers d'affichage pour les dossiers (couleurs de statut, flags JSON).

// Valeurs possibles (statut = colonnes du tableau, type = labels usuels)
export const STATUTS_DOSSIER = [
  "Nouveau",
  "Opportunité",
  "Devis",
  "Relance",
  "Négociation",
  "Devis signé / Validé",
  "En atelier",
  "Prêt à poser",
  "Clos",
  "Perdu",
  "SAV",
];
// « Mixte » : dossier qui regroupe des travaux de plusieurs métiers (ex.
// rideaux + fauteuil) — posé automatiquement depuis les lignes « Travaux ».
export const TYPES_INTERVENTION = ["Autre", "Tapisserie", "Rideaux", "Atelier", "Mixte"];

// Étiquettes (flags) proposées partout (formulaire, liste, fiche). Rideaux /
// Atelier ont été retirés : ils doublonnaient le type d'intervention et les
// lignes Travaux. Les anciens flags restent affichés là où ils sont posés.
export const FLAGS_PREDEF = [
  "Urgent",
  "À relancer",
  "Standby",
  "Acompte versé",
  "Payé",
  "Attente tissu",
  "Attente client",
  "Pose à prévoir",
  "À livrer",
];

// Teinte des chips d'étiquette selon leur sens (défaut : gris neutre lisible).
export const FLAG_TINT: Record<string, string> = {
  Urgent: "bg-red-100 text-red-800",
  "À relancer": "bg-amber-100 text-amber-800",
  "Acompte versé": "bg-emerald-100 text-emerald-800",
  Payé: "bg-emerald-100 text-emerald-800",
  Standby: "bg-slate-100 text-slate-600",
  "Attente tissu": "bg-orange-100 text-orange-800",
  "Attente client": "bg-orange-100 text-orange-800",
  "Pose à prévoir": "bg-sky-100 text-sky-800",
  "À livrer": "bg-sky-100 text-sky-800",
  "Pas intéressant": "bg-slate-100 text-slate-600",
  Rideaux: "bg-blue-100 text-blue-800",
  Atelier: "bg-violet-100 text-violet-800",
};
export const flagChipCls = (f: string) =>
  FLAG_TINT[f] || "bg-secondary text-secondary-foreground";

// Statut fusionné : les anciens « Devis signé » et « Validé » sont regroupés
// dans une seule colonne du tableau, sans migration en base (normalisé à
// l'affichage). Toute lecture de statut doit passer par cette fonction.
export const STATUT_DEVIS_VALIDE = "Devis signé / Validé";

// Statuts en base regroupés sous un même libellé (« Lead » est fondu dans
// « Opportunité »).
export const STATUTS_ALIAS: Record<string, string[]> = {
  [STATUT_DEVIS_VALIDE]: [STATUT_DEVIS_VALIDE, "Devis signé", "Validé"],
  Opportunité: ["Opportunité", "Lead"],
};

export function normalizeStatut(statut: string): string {
  if (statut === "Devis signé" || statut === "Validé") {
    return STATUT_DEVIS_VALIDE;
  }
  if (statut === "Lead") return "Opportunité";
  return statut;
}

// Valeurs en base correspondant à un statut affiché (pour filtrer).
export function statutsEnBase(statut: string): string[] {
  return STATUTS_ALIAS[statut] ?? [statut];
}

// Couleur du badge selon le statut réel utilisé en base.
export function statutClasses(statut: string): string {
  switch (statut) {
    case "Devis signé / Validé":
    case "Devis signé":
      return "bg-teal-100 text-teal-800";
    case "Perdu":
      return "bg-rose-100 text-rose-700";
    case "Validé":
      return "bg-blue-100 text-blue-800";
    case "En atelier":
      return "bg-amber-100 text-amber-800";
    case "Prêt à poser":
      return "bg-violet-100 text-violet-800";
    case "Clos":
      return "bg-emerald-100 text-emerald-800";
    case "Nouveau":
      return "bg-zinc-100 text-zinc-700";
    default:
      return "bg-zinc-100 text-zinc-700";
  }
}

// Teinte de marque (variable CSS --brand-*) associée à chaque colonne/statut du
// tableau. Sert à colorer le bandeau de colonne et le liseré des cartes, dans la
// palette de la refonte visuelle (voir app/globals.css).
const STATUT_TINTS: Record<string, string> = {
  Nouveau: "--brand-purple",
  Lead: "--brand-blue",
  Opportunité: "--brand-violet",
  Devis: "--brand-purple",
  Relance: "--brand-orange",
  Négociation: "--brand-pink",
  "Devis signé / Validé": "--brand-green",
  "Devis signé": "--brand-green",
  Validé: "--brand-green",
  "En atelier": "--brand-orange",
  "Prêt à poser": "--brand-violet",
  Clos: "--brand-green",
  Perdu: "--brand-pink",
  SAV: "--brand-blue",
};

// Renvoie une teinte utilisable en CSS (« hsl(var(--brand-x)) ») pour un statut.
export function statutTint(statut: string): string {
  return `hsl(var(${STATUT_TINTS[statut] ?? "--brand-purple"}))`;
}

// Couleur de fond (pastel) et de bordure par étiquette, pour teinter les
// cartes du tableau.
// Palette « poudrée » cohérente : même clarté et faible saturation pour toutes
// les teintes (une seule famille), avec des complémentaires choisies —
//   corail (Urgent) ↔ sauge/teal (Payé/Acompte) ; ocre (À relancer) ↔ lavande
//   (Rideaux) ; bleu ardoise (Atelier) ; deux gris neutres (Standby / Pas int.).
// Fond très clair (~L95 %), bordure assortie plus soutenue (~L72 %).
// Fonds plus intenses (pastels soutenus, teintés vers la bordure), bordures
// inchangées pour garder le repère couleur.
const FLAG_COLORS: Record<string, { bg: string; border: string }> = {
  Urgent: { bg: "#f2d3cf", border: "#e0a49c" }, // corail
  "À relancer": { bg: "#eedfc2", border: "#d9bd87" }, // ocre
  Standby: { bg: "#e0dcd4", border: "#c2baac" }, // greige
  Payé: { bg: "#d2e0d1", border: "#a4c0a2" }, // sauge
  "Acompte versé": { bg: "#c8dfdc", border: "#8fbeb8" }, // teal doux
  Rideaux: { bg: "#d6d3e6", border: "#aca7cd" }, // lavande
  Atelier: { bg: "#ced9e7", border: "#9bb2cd" }, // bleu ardoise
  "Pas intéressant": { bg: "#d7dbde", border: "#b0b7bd" }, // gris froid
  "Attente tissu": { bg: "#f0dccb", border: "#dcb08c" }, // abricot
  "Attente client": { bg: "#f0dccb", border: "#dcb08c" }, // abricot
  "Pose à prévoir": { bg: "#cfe0ea", border: "#98bdd2" }, // bleu ciel
  "À livrer": { bg: "#cfe0ea", border: "#98bdd2" }, // bleu ciel
};

// Ordre de priorité : la première étiquette présente donne la bordure, et les
// (jusqu'à 3) premières composent le dégradé.
const FLAG_PRIORITY = [
  "Urgent",
  "À relancer",
  "Attente tissu",
  "Attente client",
  "À livrer",
  "Pose à prévoir",
  "Payé",
  "Acompte versé",
  "Standby",
  "Rideaux",
  "Atelier",
  "Pas intéressant",
];

// Style de la carte (tableau) selon ses étiquettes : fond laissé BLANC (le
// reflet « glass » est géré par les pseudo-éléments de la carte), on ne teinte
// plus que la bordure à la couleur de la première étiquette connue.
export function flagCardStyle(flags: string[]): {
  backgroundColor?: string;
  backgroundImage?: string;
  borderColor?: string;
} {
  const known = FLAG_PRIORITY.filter((f) => flags.includes(f));
  if (known.length === 0) return {};
  return { borderColor: FLAG_COLORS[known[0]].border };
}

// flags est stocké en texte JSON (ex: '["Standby"]'). Parse tolérant.
export function parseFlags(raw: string | null | undefined): string[] {
  if (!raw) return [];
  try {
    const arr = JSON.parse(raw);
    return Array.isArray(arr) ? arr.map(String) : [];
  } catch {
    return [];
  }
}
