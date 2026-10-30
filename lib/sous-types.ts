// Sous-type (« type de réalisation ») d'un dossier : liste de base, complétée
// par les libellés ajoutés en direct depuis le formulaire (table
// sous_types_realisation, voir lib/sous-types-db). Fichier sans dépendance
// serveur : importable côté client.
export const SOUS_TYPES_BASE = [
  "Fauteuil",
  "Banquette",
  "Canapé",
  "Salon",
  "Chaise",
  "Tenture murale",
  "Galette",
  "Rideaux",
  "Tête de lit",
  "Coussin",
  "Tabouret / pouf",
];

// Nettoie un libellé saisi (espaces, longueur, majuscule initiale).
export function propreSousType(v: unknown): string {
  const s = String(v ?? "").replace(/[\r\n|]+/g, " ").replace(/\s+/g, " ").trim().slice(0, 60);
  return s ? s.charAt(0).toUpperCase() + s.slice(1) : "";
}

// Nombre de places assises : entier positif, sinon null.
export function parsePlaces(v: unknown): number | null {
  const n = Math.round(Number(String(v ?? "").replace(",", ".").trim()));
  return Number.isFinite(n) && n > 0 && n < 1000 ? n : null;
}
