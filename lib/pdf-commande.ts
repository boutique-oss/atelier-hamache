// Lecture d'un PDF fournisseur (accusé de réception, bon de commande) SANS IA :
// on extrait le texte avec ses positions (unpdf / pdf.js), on reconstitue les
// lignes du tableau, puis on repère dans chaque ligne référence, désignation,
// coloris, métrage et montant par règles simples. Ne marche que sur les PDF
// « texte » (pas les scans). Le résultat est toujours relu par l'utilisateur
// avant création des commandes : les règles proposent, l'atelier dispose.
import { getDocumentProxy } from "unpdf";

export type LigneLue = {
  // Texte brut de la ligne (cellules séparées par « | »), pour contrôle.
  brut: string;
  reference: string;
  designation: string;
  coloris: string;
  qte: string;
  unite: string;
  montant: string;
  // Proposée cochée : la ligne ressemble à un article (réf ou métrage trouvé).
  probable: boolean;
};

export type PdfLu = {
  lignes: LigneLue[];
  // Texte complet (sert à deviner fournisseur et date).
  texte: string;
  date: string; // AAAA-MM-JJ si une date a été trouvée
  pages: number;
};

type Morceau = { x: number; y: number; w: number; s: string };

// Regroupe les morceaux de texte d'une page en lignes (même hauteur à ±2.5),
// triées de haut en bas ; dans une ligne, un grand écart = changement de
// colonne (« | »).
function lignesDePage(morceaux: Morceau[]): string[] {
  const tries = [...morceaux].sort((a, b) => b.y - a.y || a.x - b.x);
  const groupes: Morceau[][] = [];
  for (const m of tries) {
    const g = groupes.find((gr) => Math.abs(gr[0].y - m.y) <= 2.5);
    if (g) g.push(m);
    else groupes.push([m]);
  }
  return groupes.map((g) => {
    g.sort((a, b) => a.x - b.x);
    let out = "";
    let finPrec = -Infinity;
    for (const m of g) {
      const ecart = m.x - finPrec;
      if (out) out += ecart > 12 ? " | " : ecart > 1.5 ? " " : "";
      out += m.s;
      finPrec = m.x + m.w;
    }
    return out.replace(/\s+/g, " ").trim();
  });
}

// Lignes d'en-tête / pied de page / totaux : jamais des articles.
const HORS_ARTICLE =
  /\b(total|sous-total|tva|t\.v\.a|net à payer|acompte|iban|bic|siret|siren|naf|rcs|capital|tél|tel\.|fax|e-?mail|www\.|page \d|adresse|livraison :|facturation|conditions|règlement|escompte|frais de port|port\b|référence client|n° client|votre commande|notre commande|commande n|date\s*:|n°\s*(?:de\s+)?(?:commande|cde|facture|bl))\b/i;

const NOMBRE = /^-?\d{1,3}(?:[ .]\d{3})*(?:[.,]\d+)?$|^-?\d+(?:[.,]\d+)?$/;
const PRIX = /^-?\d{1,3}(?:[ .]\d{3})*,\d{2}$|^-?\d+[.,]\d{2}$/;
const UNITE =
  /(\d+(?:[.,]\d+)?)\s*(ml|m\.?l\.?|mètres?|metres?|m²|m2|m|pces?|pcs|pièces?|pieces?|u|unités?|rlx|rouleaux?|kg)\b/i;

function normUnite(u: string): string {
  const s = u.toLowerCase().replace(/\./g, "");
  if (/^(ml|m|mètres?|metres?)$/.test(s)) return "ml";
  if (/^(m²|m2)$/.test(s)) return "m²";
  if (/^(pces?|pcs|pièces?|pieces?|u|unités?)$/.test(s)) return "pce";
  if (/^(rlx|rouleaux?)$/.test(s)) return "rlx";
  return s;
}

// Une référence : bloc sans espace, avec au moins un chiffre, 3+ caractères.
const REF_BRUTE = /^(?=.*\d)[A-Z0-9][A-Z0-9.\-/_]{2,}$/i;
const DATE = /^\d{1,2}[/.\-]\d{1,2}[/.\-]\d{2,4}$/;
const REF = { test: (s: string) => REF_BRUTE.test(s) && !DATE.test(s) };

export function analyserLigne(brut: string): LigneLue {
  const vide: LigneLue = {
    brut,
    reference: "",
    designation: "",
    coloris: "",
    qte: "",
    unite: "",
    montant: "",
    probable: false,
  };
  if (!/\d/.test(brut) || HORS_ARTICLE.test(brut)) return vide;

  let cellules = brut.split(" | ").map((c) => c.trim()).filter(Boolean);
  const l = { ...vide };

  // Coloris annoncé par un mot-clé (« coloris 03 », « col. Sable »…).
  const col = brut.match(/\b(?:coloris|col\.?|coul\.?|couleur|teinte)\s*:?\s*([^|]+?)(?=\s*(?:\||$))/i);
  if (col) {
    l.coloris = col[1].trim();
    cellules = cellules.map((c) =>
      c.replace(/\b(?:coloris|col\.?|coul\.?|couleur|teinte)\s*:?\s*.+$/i, "").trim()
    ).filter(Boolean);
  }

  // Métrage / quantité avec unité.
  const qu = brut.match(UNITE);
  if (qu) {
    l.qte = qu[1].replace(".", ",");
    l.unite = normUnite(qu[2]);
    cellules = cellules
      .map((c) => (c.includes(qu[0]) ? c.replace(qu[0], "").trim() : c))
      .filter(Boolean);
  }

  // Montant : dernier prix (2 décimales) de la ligne = total de la ligne.
  const prix = cellules.filter((c) => PRIX.test(c.replace(/\s?€$/, "")));
  if (prix.length) l.montant = prix[prix.length - 1].replace(/\s?€$/, "");
  cellules = cellules.filter((c) => !PRIX.test(c.replace(/\s?€$/, "")));

  // Quantité sans unité : premier nombre seul restant (ex. colonne « Qté »).
  if (!l.qte) {
    const n = cellules.find((c) => NOMBRE.test(c) && !REF.test(c.replace(/[.,]/g, "x")));
    if (n) {
      l.qte = n.replace(".", ",");
      cellules = cellules.filter((c) => c !== n);
    }
  }

  // Référence : première cellule (ou premier mot) au format référence.
  const refCellule = cellules.find((c) => REF.test(c) && !NOMBRE.test(c));
  if (refCellule) {
    l.reference = refCellule;
    cellules = cellules.filter((c) => c !== refCellule);
  } else {
    const mots = cellules.join(" ").split(" ");
    const mot = mots.find((m) => REF.test(m) && !NOMBRE.test(m));
    if (mot) {
      l.reference = mot;
      cellules = cellules.map((c) => c.replace(mot, "").trim()).filter(Boolean);
    }
  }

  // Désignation : la cellule la plus « texte » restante.
  const textes = cellules.filter((c) => /[a-zà-ÿ]{3,}/i.test(c));
  textes.sort((a, b) => b.length - a.length);
  l.designation = (textes[0] ?? "").replace(/\s+/g, " ").trim();
  // Coloris sans mot-clé : courte cellule texte restante après la désignation.
  if (!l.coloris && textes.length > 1 && textes[1].length <= 25) {
    l.coloris = textes[1];
  }

  l.probable = !!(l.designation && (l.reference || l.qte));
  return l;
}

// Date du document : première date JJ/MM/AAAA (ou JJ.MM.AA) trouvée.
// Première date VALIDE (un n° de téléphone « 05.49.46… » ne compte pas).
export function dateDuTexte(texte: string): string {
  for (const m of texte.matchAll(/\b(\d{1,2})[/.\-](\d{1,2})[/.\-](\d{2,4})\b/g)) {
    const [, j, mo, a] = m;
    const an = a.length === 2 ? `20${a}` : a;
    const jj = j.padStart(2, "0");
    const mm = mo.padStart(2, "0");
    if (Number(mm) < 1 || Number(mm) > 12 || Number(jj) < 1 || Number(jj) > 31) continue;
    if (Number(an) < 2000 || Number(an) > 2100) continue;
    return `${an}-${mm}-${jj}`;
  }
  return "";
}

export async function lirePdfCommande(data: Uint8Array): Promise<PdfLu> {
  const { lignes: toutes, pages } = await lignesDuPdf(data);
  const texte = toutes.join("\n");
  return {
    lignes: toutes.filter(Boolean).map(analyserLigne),
    texte,
    date: dateDuTexte(texte),
    pages,
  };
}

// Texte d'un PDF reconstitué en lignes (cellules séparées par « | »), toutes
// pages confondues. Partagé avec la lecture des devis (lib/devis-pdf).
export async function lignesDuPdf(
  data: Uint8Array
): Promise<{ lignes: string[]; pages: number }> {
  const pdf = await getDocumentProxy(data);
  const toutes: string[] = [];
  for (let p = 1; p <= pdf.numPages; p++) {
    const page = await pdf.getPage(p);
    const contenu = await page.getTextContent();
    const morceaux: Morceau[] = [];
    for (const it of contenu.items as {
      str?: string;
      transform?: number[];
      width?: number;
    }[]) {
      if (!it.str || !it.str.trim() || !it.transform) continue;
      morceaux.push({
        s: it.str,
        x: it.transform[4],
        y: it.transform[5],
        w: it.width ?? 0,
      });
    }
    toutes.push(...lignesDePage(morceaux));
  }
  return { lignes: toutes, pages: pdf.numPages };
}
