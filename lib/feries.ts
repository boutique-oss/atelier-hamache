// Jours fériés français (métropole), sans dépendance serveur : importable
// côté client (rétroplanning) comme côté serveur (pointage).

const plusJours = (iso: string, n: number) => {
  const [y, m, j] = iso.split("-").map(Number);
  return new Date(Date.UTC(y, m - 1, j + n)).toISOString().slice(0, 10);
};

// Jours fériés d'une année : date AAAA-MM-JJ → libellé.
// Pâques par l'algorithme de Meeus/Jones/Butcher.
export function feriesFR(annee: number): Map<string, string> {
  const a = annee % 19, b = Math.floor(annee / 100), c = annee % 100;
  const d = Math.floor(b / 4), e = b % 4, f = Math.floor((b + 8) / 25);
  const g = Math.floor((b - f + 1) / 3), h = (19 * a + b - d - g + 15) % 30;
  const i = Math.floor(c / 4), k = c % 4, l = (32 + 2 * e + 2 * i - h - k) % 7;
  const m = Math.floor((a + 11 * h + 22 * l) / 451);
  const mois = Math.floor((h + l - 7 * m + 114) / 31), jour = ((h + l - 7 * m + 114) % 31) + 1;
  const paques = `${annee}-${String(mois).padStart(2, "0")}-${String(jour).padStart(2, "0")}`;
  return new Map([
    [`${annee}-01-01`, "Jour de l'an"],
    [plusJours(paques, 1), "Lundi de Pâques"],
    [`${annee}-05-01`, "Fête du Travail"],
    [`${annee}-05-08`, "Victoire 1945"],
    [plusJours(paques, 39), "Ascension"],
    [plusJours(paques, 50), "Lundi de Pentecôte"],
    [`${annee}-07-14`, "Fête nationale"],
    [`${annee}-08-15`, "Assomption"],
    [`${annee}-11-01`, "Toussaint"],
    [`${annee}-11-11`, "Armistice 1918"],
    [`${annee}-12-25`, "Noël"],
  ]);
}
