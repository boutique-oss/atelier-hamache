// Constantes des fiches navettes, sans accès base : importables côté client.
import type { StatutFicheNavette } from "@/lib/documents-db";

// Types de journée proposés à la saisie (mêmes règles que /pointage).
export const TYPES_JOUR = ["Travail", "Congé", "Maladie", "Férié", "Récup", "Repos"] as const;
export const TYPES_NEUTRES = ["Congé", "Maladie", "Férié"]; // = h/jour du contrat
export const SEUIL_JOUR = 10; // au-delà : avertissement

export const JOURS_FICHE = ["Lundi", "Mardi", "Mercredi", "Jeudi", "Vendredi", "Samedi"];

export const STATUTS_FICHE: { cle: StatutFicheNavette; libelle: string }[] = [
  { cle: "a_saisir", libelle: "À saisir" },
  { cle: "verifiee", libelle: "Vérifiée" },
  { cle: "integree", libelle: "Intégrée" },
];
