// Prise de cotes RIDEAUX saisie sur tablette chez le client : même grille que
// la feuille papier « RIDEAUX PRISE DE COTES » de l'atelier, une ligne par
// pièce / fenêtre. Fichier sans dépendance serveur (importable côté client).

export type PieceCotes = {
  piece: string;
  longueurTringle: string;
  nbCrochets: string;
  hauteurTringleSol: string;
  typeTete: string;
  typeBas: string;
  uniquePaire: "" | "Unique" | "Paire";
  uniqueG: string; // si unique : largeur côté gauche
  uniqueD: string;
  retourG: string;
  retourD: string;
  doublure: "" | "Satinette" | "Occultant";
  note: string;
};

export const PIECE_VIDE: PieceCotes = {
  piece: "",
  longueurTringle: "",
  nbCrochets: "",
  hauteurTringleSol: "",
  typeTete: "",
  typeBas: "",
  uniquePaire: "",
  uniqueG: "",
  uniqueD: "",
  retourG: "",
  retourD: "",
  doublure: "",
  note: "",
};

// Pièce réellement remplie (au moins une cote ou un nom).
export const pieceRemplie = (p: PieceCotes) =>
  Object.entries(p).some(([, v]) => String(v ?? "").trim() !== "");

// Relecture tolérante (JSON en base, champs manquants complétés).
export function lirePieces(raw: unknown): PieceCotes[] {
  const arr = Array.isArray(raw) ? raw : [];
  return arr.map((p) => ({ ...PIECE_VIDE, ...(p as Partial<PieceCotes>) }));
}
