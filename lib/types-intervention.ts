// Types d'intervention ajoutés par l'utilisateur (en plus des 4 de base :
// enlèvement/dépôt, livraison, prise de cote, chantier). Partagé client/serveur.

export type TypeIntervention = { id: number; libelle: string; couleur: string };

// Couleurs proposées : classe de pastille du planning + colorId Google Agenda.
export const COULEURS_TYPE: { value: string; pastille: string; googleColorId: string }[] = [
  { value: "violet", pastille: "bg-violet-500", googleColorId: "3" },
  { value: "bleu", pastille: "bg-sky-500", googleColorId: "7" },
  { value: "orange", pastille: "bg-orange-500", googleColorId: "6" },
  { value: "rose", pastille: "bg-pink-500", googleColorId: "4" },
  { value: "vert", pastille: "bg-teal-600", googleColorId: "2" },
  { value: "marine", pastille: "bg-blue-700", googleColorId: "9" },
  { value: "gris", pastille: "bg-slate-500", googleColorId: "8" },
  { value: "lavande", pastille: "bg-indigo-300", googleColorId: "1" },
];

export const couleurType = (c: string) =>
  COULEURS_TYPE.find((x) => x.value === c) ?? COULEURS_TYPE[0];

// Clé de type dans le widget pour un type ajouté : « perso:<id> ».
export const clePerso = (id: number) => `perso:${id}` as const;
export const idPerso = (t: string): number | null =>
  t.startsWith("perso:") ? Number(t.slice(6)) || null : null;
