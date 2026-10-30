// Source UNIQUE des « types de réalisation » (par métier) + des « phases ».
// Partagée entre la saisie d'heures (components/heures-form.tsx) et la fiche
// atelier, pour lier fiche ↔ heures sur un vocabulaire commun. Le comptage se
// fait par type de réalisation × nombre (ex. Fauteuil ×2), pas par étape.

// Phase transverse d'une saisie (garde la sémantique de l'ancien typeTravail).
export const PHASES = ["Atelier", "Pose", "Bureau", "Déplacement", "SAV"] as const;

// Types de réalisation proposés selon le type d'intervention du DOSSIER.
// Les clés correspondent à dossiers.type_intervention (Tapisserie / Rideaux /
// Atelier / Autre). Liste dérivée des métiers des fiches (lib/fiches-schemas).
export const TYPES_REALISATION: Record<string, string[]> = {
  Tapisserie: [
    "Fauteuil",
    "Chaise",
    "Canapé",
    "Bergère",
    "Pouf",
    "Banquette",
    "Tabouret",
    "Tête de lit",
    "Coussin",
    "Galette",
    "Autre",
  ],
  Rideaux: [
    "Double rideaux",
    "Rideau (pan)",
    "Voilage",
    "Store bateau",
    "Store enrouleur",
    "Embrasse",
    "Coussin",
    "Autre",
  ],
  // Métiers « génériques » du dossier : on propose l'union raisonnable.
  Atelier: [
    "Fauteuil",
    "Chaise",
    "Canapé",
    "Tête de lit",
    "Double rideaux",
    "Rideau (pan)",
    "Store bateau",
    "Coussin",
    "Galette",
    "Tenture murale",
    "Pose seule",
    "Autre",
  ],
  // Dossier multi-métiers (lignes Travaux) : tapisserie + rideaux.
  Mixte: [
    "Fauteuil",
    "Chaise",
    "Canapé",
    "Bergère",
    "Banquette",
    "Tête de lit",
    "Double rideaux",
    "Rideau (pan)",
    "Voilage",
    "Store bateau",
    "Coussin",
    "Autre",
  ],
  Autre: [
    "Fauteuil",
    "Chaise",
    "Canapé",
    "Double rideaux",
    "Rideau (pan)",
    "Store bateau",
    "Coussin",
    "Autre",
  ],
};

// Liste des types de réalisation pour un type d'intervention donné.
// Repli sur « Autre » si le métier est inconnu / vide.
export function typesRealisationPour(typeIntervention?: string | null): string[] {
  const key = (typeIntervention || "").trim();
  return TYPES_REALISATION[key] || TYPES_REALISATION["Autre"];
}
