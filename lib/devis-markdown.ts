// Lecture d'un devis écrit en Markdown (export d'un gabarit Word, devis
// rédigé à la main ou généré par une IA) SANS IA. Le Markdown est ramené au
// même format de lignes que les PDF EBP (cellules séparées par « | »), puis
// confié au moteur de lecture des devis (lib/devis-pdf) : mêmes règles
// métier/réalisation, mêmes fiches atelier pré-remplies.
//
// Ce qui est compris :
//  - en-tête en « Clé : valeur » (Client, Nom, Adresse, Tél, Email, Devis n°,
//    Date, Référence / Objet), en gras ou en liste, ou sous un titre « Client » ;
//  - un tableau Markdown avec une colonne de libellé et des colonnes
//    Qté / Unité / P.U. / Montant (ordre libre, repéré par l'en-tête) ;
//  - des titres (#, ##) pris pour des titres de pièce ou d'ouvrage ;
//  - des listes « - » sous une ligne chiffrée (étapes, tissu…).
import { lireDevisLignes, type DevisLu } from "@/lib/devis-pdf";

const COL_QTE = /^(qt[ée]|quantit[ée]|nb|nombre)$/i;
const COL_UNITE = /^(unit[ée]|u\.?|un)$/i;
const COL_PU = /^(p\.?\s?u\.?(?:\s*h\.?t\.?)?|prix\s*(?:unit(?:aire)?)?(?:\s*h\.?t\.?)?|pu\s*ht)$/i;
const COL_MONTANT = /^(montant(?:\s*h\.?t\.?)?|total(?:\s*h\.?t\.?)?|prix\s*(?:total|h\.?t\.?)|ht)$/i;
const COL_TVA = /^(tva|taux(?:\s*tva)?)$/i;
const COL_LIBELLE = /^(d[ée]signation|description|libell[ée]|d[ée]tail|prestation|article|ouvrage)$/i;

// Enlève la mise en forme Markdown d'une ligne de texte.
export function nettoyerMarkdown(s: string): string {
  return s
    .replace(/<br\s*\/?>/gi, " ")
    .replace(/<[^>]+>/g, "")
    .replace(/!\[[^\]]*\]\([^)]*\)/g, "")
    .replace(/\[([^\]]*)\]\([^)]*\)/g, "$1")
    .replace(/(\*\*|__)(.+?)\1/g, "$2")
    .replace(/(^|[^*\w])[*_]([^*_]+)[*_](?=[^*\w]|$)/g, "$1$2")
    .replace(/`([^`]*)`/g, "$1")
    .replace(/&nbsp;/g, " ")
    .replace(/ /g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

// « 1 250 », « 1.250,00 », « 350 € », « 350.5 » → « 1250,00 » (format
// attendu par les règles PRIX du moteur EBP).
function versPrix(c: string): string {
  const brut = c.replace(/€|eur(?:os?)?/gi, "").replace(/[\s ]/g, "");
  if (!/^-?\d+(?:[.,]\d+)*$/.test(brut)) return c;
  let n = brut;
  // Séparateur décimal = le dernier « , » ou « . » suivi de 1-2 chiffres.
  const m = n.match(/^(-?[\d.,]*?)[.,](\d{1,2})$/);
  let entier = n;
  let dec = "00";
  if (m) {
    entier = m[1];
    dec = m[2].padEnd(2, "0");
  }
  entier = entier.replace(/[.,]/g, "");
  if (!/^-?\d+$/.test(entier)) return c;
  n = `${entier},${dec}`;
  return n;
}

// Quantité : « 2 », « 2,5 », « 2.5 » → « 2 » / « 2,5 ».
function versQuantite(c: string): string {
  const brut = c.replace(/[\s ]/g, "");
  if (!/^-?\d+(?:[.,]\d+)?$/.test(brut)) return c;
  return brut.replace(".", ",").replace(/,0+$/, "");
}

// Sépare une ligne de tableau Markdown en cellules (bornes « | » optionnelles).
function cellulesDe(l: string): string[] {
  let t = l.trim();
  if (t.startsWith("|")) t = t.slice(1);
  if (t.endsWith("|")) t = t.slice(0, -1);
  // « \| » = barre échappée à l'intérieur d'une cellule.
  return t
    .split(/(?<!\\)\|/)
    .map((c) => nettoyerMarkdown(c.replace(/\\\|/g, "|")));
}

const estSeparateurTableau = (l: string) => /^\s*\|?\s*:?-{2,}:?\s*(\|\s*:?-{2,}:?\s*)*\|?\s*$/.test(l);
const estLigneTableau = (l: string) => /\|/.test(l) && !estSeparateurTableau(l);

type Colonnes = {
  libelle: number[];
  qte: number;
  unite: number;
  pu: number;
  montant: number;
  tva: number;
  ordre: number[]; // ordre de sortie des colonnes (libellé, unité, qté, pu, montant, tva)
};

function analyserEntete(cells: string[]): Colonnes | null {
  const idx = (re: RegExp) => cells.findIndex((c) => re.test(c.trim()));
  const qte = idx(COL_QTE);
  const unite = idx(COL_UNITE);
  const pu = idx(COL_PU);
  const montant = idx(COL_MONTANT);
  const tva = idx(COL_TVA);
  const libelleDeclare = cells
    .map((c, i) => (COL_LIBELLE.test(c.trim()) ? i : -1))
    .filter((i) => i >= 0);
  const chiffres = [qte, unite, pu, montant, tva].filter((i) => i >= 0);
  if (!chiffres.length && !libelleDeclare.length) return null;
  const libelle = libelleDeclare.length
    ? libelleDeclare
    : cells.map((_, i) => i).filter((i) => !chiffres.includes(i));
  if (!libelle.length) return null;
  const ordre = [...libelle, unite, qte, pu, montant, tva].filter((i) => i >= 0);
  return { libelle, qte, unite, pu, montant, tva, ordre };
}

// Ligne de tableau → ligne « façon EBP » : Description | Unité | Qté | P.U. HT | Montant HT | TVA.
function ligneTableau(cells: string[], col: Colonnes): string {
  const out: string[] = [];
  for (const i of col.ordre) {
    let c = (cells[i] ?? "").trim();
    if (!c) continue;
    if (i === col.qte) c = versQuantite(c);
    else if (i === col.pu || i === col.montant) c = versPrix(c);
    else if (i === col.tva) c = c.replace(/\s*%$/, "").replace(".", ",");
    out.push(c);
  }
  return out.join(" | ");
}

const ENTETE_EBP = "Description | Unité | Qté | P.U. HT | Montant HT | TVA";

// Convertit le Markdown en lignes « | » lisibles par le moteur des devis.
export function lignesDuMarkdown(md: string): string[] {
  const src = md.replace(/\r\n?/g, "\n");
  // Front matter YAML (notes Obsidian) : ignoré.
  const sansFront = src.replace(/^---\n[\s\S]*?\n---\n/, "");
  const lignes: string[] = [];
  let colonnes: Colonnes | null = null;
  let dansTableau = false;
  let enteteEcrit = false;

  const brutes = sansFront.split("\n");
  for (let i = 0; i < brutes.length; i++) {
    const l = brutes[i];
    if (!l.trim()) {
      dansTableau = false;
      continue;
    }
    if (estSeparateurTableau(l)) continue;
    if (estLigneTableau(l)) {
      const cells = cellulesDe(l);
      const suivante = brutes[i + 1] ?? "";
      // Ligne d'en-tête = suivie du séparateur « |---|---| ».
      if (!dansTableau || estSeparateurTableau(suivante)) {
        const col = estSeparateurTableau(suivante) ? analyserEntete(cells) : null;
        if (col) {
          colonnes = col;
          dansTableau = true;
          // Une seule en-tête EBP, pour que le moteur repère le début du
          // tableau et la colonne TVA en dernier.
          if (!enteteEcrit) {
            lignes.push(col.tva >= 0 ? ENTETE_EBP : ENTETE_EBP.replace(" | TVA", ""));
            enteteEcrit = true;
          }
          continue;
        }
        if (estSeparateurTableau(suivante)) {
          // Tableau sans colonne reconnue (ex. bloc client « | Nom | Dupont | »).
          colonnes = null;
          dansTableau = true;
          lignes.push(cells.filter(Boolean).join(" | "));
          continue;
        }
      }
      dansTableau = true;
      if (colonnes) {
        const texte = ligneTableau(cells, colonnes);
        if (texte) lignes.push(texte);
      } else {
        const t = cells.filter(Boolean).join(" | ");
        if (t) lignes.push(t);
      }
      continue;
    }
    dansTableau = false;
    // Titres : « ## SALON », « ### Fauteuil Voltaire ».
    const titre = l.match(/^\s{0,3}#{1,6}\s+(.*?)\s*#*\s*$/);
    if (titre) {
      const t = nettoyerMarkdown(titre[1]);
      if (t && !/^devis$/i.test(t)) lignes.push(t);
      continue;
    }
    // Citations, listes, cases à cocher : on garde le texte.
    const t = nettoyerMarkdown(
      l
        .replace(/^\s{0,3}>\s?/, "")
        .replace(/^\s*(?:[-*+•]|\d+[.)])\s+(?:\[[ xX]\]\s+)?/, "")
        .replace(/^\s*[-*_]{3,}\s*$/, "")
    );
    if (!t) continue;
    // « Prix : 350 € » hors tableau → on met un prix lisible.
    const prixLibre = t.match(/^(.*?)(?:\s*[:\-–]\s*)(-?\d[\d\s.,]*)\s*€\s*(?:HT|TTC)?$/i);
    if (prixLibre && prixLibre[1].trim()) {
      lignes.push(`${prixLibre[1].trim()} | ${versPrix(prixLibre[2])}`);
      continue;
    }
    lignes.push(t);
  }
  return lignes;
}

// Complément « Clé : valeur » de l'en-tête, que le moteur EBP ne connaît pas
// (il déduit le client de l'adresse « CP Ville »). Les valeurs explicites du
// Markdown priment.
function champsEntete(md: string) {
  const texte = nettoyerMarkdownBloc(md);
  const prendre = (re: RegExp) => (texte.match(re)?.[1] ?? "").trim();
  const nom =
    prendre(/^(?:client|nom(?:\s+du\s+client)?|destinataire|à\s+l['’]attention\s+de)\s*[:|]\s*(.+)$/im) ||
    prendre(/^(?:m\.|mme|mr|mlle|monsieur|madame)\s+(.+)$/im);
  const adresseLigne = prendre(/^adresse\s*[:|]\s*(.+)$/im);
  const tel = prendre(/^(?:t[ée]l(?:[ée]phone)?|portable|mobile|gsm)\.?\s*[:|]\s*(.+)$/im);
  const email = prendre(/^(?:e-?mail|courriel|mail)\s*[:|]\s*(.+)$/im);
  const numero = prendre(/^(?:devis|n°\s*(?:de\s+)?devis|num[ée]ro(?:\s+de\s+devis)?|r[ée]f(?:[ée]rence)?\s+devis)\s*(?:n°|no|num[ée]ro|#)?\s*[:|]\s*([A-Z0-9][\w\-/]*)/im);
  const date = prendre(/^date(?:\s+du\s+devis)?\s*[:|]\s*(.+)$/im);
  return { nom, adresseLigne, tel, email, numero, date };
}

function nettoyerMarkdownBloc(md: string): string {
  return md
    .replace(/\r\n?/g, "\n")
    .split("\n")
    .map((l) =>
      nettoyerMarkdown(
        l.replace(/^\s*(?:[-*+•]|\d+[.)])\s+/, "").replace(/^\s{0,3}#{1,6}\s+/, "")
      )
        // Cellules « | Client | Dupont | » → « Client : Dupont ».
        .replace(/^\|?\s*([^|]+?)\s*\|\s*([^|]+?)\s*\|?$/, "$1 : $2")
    )
    .join("\n");
}

const dateIso = (s: string) => {
  const m = s.match(/(\d{1,2})[/.\-](\d{1,2})[/.\-](\d{2,4})/);
  if (m) {
    const an = m[3].length === 2 ? `20${m[3]}` : m[3];
    return `${an}-${m[2].padStart(2, "0")}-${m[1].padStart(2, "0")}`;
  }
  const iso = s.match(/(\d{4})-(\d{2})-(\d{2})/);
  return iso ? iso[0] : "";
};

export function lireDevisMarkdown(md: string): DevisLu {
  const lignes = lignesDuMarkdown(md);
  const devis = lireDevisLignes(lignes, 1);
  const e = champsEntete(md);
  if (e.nom && !/\d{5}/.test(e.nom)) devis.client.nom = e.nom;
  if (e.adresseLigne) devis.client.adresse = e.adresseLigne;
  if (e.tel) {
    devis.client.telephone = e.tel;
    if (!devis.telephones.includes(e.tel)) devis.telephones.unshift(e.tel);
  }
  if (e.email) {
    devis.client.email = e.email;
    if (!devis.emails.includes(e.email)) devis.emails.unshift(e.email);
  }
  if (e.numero) devis.numero = e.numero;
  const d = dateIso(e.date);
  if (d) devis.date = d;
  return devis;
}
