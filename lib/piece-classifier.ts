// Classification du type de pièce d'un dossier pour « heures par pièce ».
// Priorité : flag manuel « piece: » > type de réalisation saisi > champ meuble
// de la fiche > détection sémantique dans le texte (nom/description/étapes) > null.

export const PIECES_CANONIQUES = [
  "Fauteuil",
  "Canapé",
  "Chaise",
  "Banquette",
  "Chauffeuse",
  "Tabouret / pouf",
  "Tête de lit",
  "Rideaux",
  "Store",
  "Voilage",
  "Coussin",
  "Galette",
  "Tenture murale",
  "Amphithéâtre",
  "Salon",
  "Autre",
];

// Détection sémantique par mots-clés (ordre = priorité).
const RULES: [string, RegExp][] = [
  ["Galette", /galette/i],
  ["Fauteuil", /fauteuil|berg[eè]re|voltaire|crapaud|cabriolet|\bclub\b/i],
  ["Chaise", /chaise/i],
  ["Canapé", /canap|m[ée]ridienne|\bsofa\b/i],
  ["Banquette", /banquette/i],
  ["Chauffeuse", /chau[f]?feuse/i],
  ["Tabouret / pouf", /tabouret|\bpouf\b|repose-?pied/i],
  ["Tête de lit", /t[êe]te de lit/i],
  ["Coussin", /coussin/i],
  ["Rideaux", /rideau|voilage|tringle|embrasse|fronc/i],
  ["Store", /\bstore/i],
  ["Tenture murale", /tenture|mur tendu|tissu mural/i],
  ["Amphithéâtre", /amphith/i],
  ["Salon", /\bsalon\b/i],
];

export function classerTexte(texte: string): string | null {
  const s = texte || "";
  for (const [label, re] of RULES) if (re.test(s)) return label;
  return null;
}

function num(v: unknown): number {
  const n = Number(String(v ?? "").replace(/[^\d.,]/g, "").replace(",", "."));
  return Number.isFinite(n) && n > 0 ? n : 0;
}

// Quantité de pièces : champ nb_* de la fiche, sinon nombre en tête du texte.
export function decodeQuantite(
  contenu: Record<string, any>,
  texte: string
): number {
  const q =
    num(contenu.nb_galettes) ||
    num(contenu.nb_coussins) ||
    num(contenu.nb_panneaux) ||
    num(contenu.nb_stores);
  if (q > 0) return q;
  const m = String(texte || "").match(
    /(\d+)\s*(?:x\s*)?(?:fauteuil|chaise|canap|banquette|galette|coussin|store|rideau|assise|berg[eè]re|lin[ée]aire|panneau)/i
  );
  if (m) return Number(m[1]);
  return 1;
}

// Normalise le champ meuble/type de la fiche vers une pièce canonique.
export function normalizeMeuble(raw: string, type: string): string | null {
  const s = classerTexte(raw);
  if (s) return s;
  const t = (type || "").trim();
  const parMetier: Record<string, string> = {
    Rideaux: "Rideaux",
    Coussins: "Coussin",
    Galettes: "Galette",
    "Tête de lit": "Tête de lit",
    "Tenture murale": "Tenture murale",
    "Pose seule": "Pose",
  };
  if (parMetier[t]) return parMetier[t];
  const r = (raw || "").trim();
  return r || (t && t !== "Autre" ? t : null);
}

// ── Flags manuels « piece: » (écriveur de flag) ───────────────────────────
export const PIECE_PREFIX = "piece:";

export function isPieceFlag(f: string): boolean {
  return typeof f === "string" && f.startsWith(PIECE_PREFIX);
}

export function parsePieceFlag(
  flags: string[]
): { piece: string; quantite: number } | null {
  const f = (flags || []).find(isPieceFlag);
  if (!f) return null;
  const [piece, qte] = f.slice(PIECE_PREFIX.length).split("|");
  const q = Number(qte);
  return {
    piece: (piece || "").trim(),
    quantite: Number.isFinite(q) && q > 0 ? q : 1,
  };
}

export function makePieceFlag(piece: string, quantite: number): string {
  const q = Number.isFinite(quantite) && quantite > 0 ? quantite : 1;
  return `${PIECE_PREFIX}${piece.trim()}|${q}`;
}

// Remplace l'éventuel flag piece existant. piece vide = retire la classification.
export function withPieceFlag(
  flags: string[],
  piece: string,
  quantite: number
): string[] {
  const base = (flags || []).filter((f) => !isPieceFlag(f));
  if (!piece.trim()) return base;
  return [...base, makePieceFlag(piece, quantite)];
}
