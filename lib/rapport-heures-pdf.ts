// PDF « Rapport d'heures » d'un dossier (pdf-lib, côté serveur). Sobre et
// lisible en noir et blanc : prévu en gris clair, réel en ardoise foncée,
// valeur écrite au bout de chaque barre.
import { PDFDocument, StandardFonts, rgb, type PDFFont, type PDFPage } from "pdf-lib";

import type { RapportDossier } from "@/lib/documents-heures";

const A4: [number, number] = [595.28, 841.89];
const MARGE = 40;
const LARGEUR = A4[0] - 2 * MARGE;
const REEL = rgb(0.184, 0.231, 0.278); // #2F3B47
const PREVU = rgb(0.722, 0.765, 0.808); // #B8C3CE
const GRIS = rgb(0.42, 0.45, 0.5);
const NOIR = rgb(0.1, 0.1, 0.12);
const FILET = rgb(0.85, 0.86, 0.88);

// Les polices standard (WinAnsi) ne couvrent pas tout Unicode : on remplace
// les signes typographiques courants et on retire le reste.
const REMPLACE: Record<string, string> = {
  "’": "'", "‘": "'", "“": '"', "”": '"', "–": "-", "—": "-",
  "…": "...", "→": "->", " ": " ", " ": " ", "−": "-",
};
const AUTORISES = new Set("€ŒœŠšŽžŸ•™ƒ‰‹›");
function propre(s: string): string {
  return Array.from(s.normalize("NFC"))
    .map((c) => REMPLACE[c] ?? c)
    .join("")
    .split("")
    .filter((c) => {
      const n = c.charCodeAt(0);
      return (n >= 0x20 && n < 0x7f) || (n >= 0xa0 && n <= 0xff) || AUTORISES.has(c);
    })
    .join("");
}

const fmtH = (n: number) => `${(Math.round(n * 10) / 10).toString().replace(".", ",")} h`;
const dateFr = (iso: string) => (/^\d{4}-\d{2}-\d{2}/.test(iso) ? iso.slice(0, 10).split("-").reverse().join("/") : iso);

type Ctx = { doc: PDFDocument; page: PDFPage; y: number; f: PDFFont; fb: PDFFont };

function coupe(t: string, font: PDFFont, taille: number, max: number): string {
  let s = propre(t);
  if (font.widthOfTextAtSize(s, taille) <= max) return s;
  while (s.length > 1 && font.widthOfTextAtSize(s + "...", taille) > max) s = s.slice(0, -1);
  return s + "...";
}

function texte(c: Ctx, t: string, x: number, y: number, o: { taille?: number; gras?: boolean; couleur?: ReturnType<typeof rgb>; max?: number } = {}) {
  const font = o.gras ? c.fb : c.f;
  const taille = o.taille ?? 10;
  c.page.drawText(o.max ? coupe(t, font, taille, o.max) : propre(t), { x, y, size: taille, font, color: o.couleur ?? NOIR });
}

function nouvellePage(c: Ctx) {
  c.page = c.doc.addPage(A4);
  c.y = A4[1] - MARGE;
}

// Garantit `h` points de place, sinon page suivante.
function place(c: Ctx, h: number) {
  if (c.y - h < MARGE + 20) nouvellePage(c);
}

function titreSection(c: Ctx, t: string) {
  place(c, 40);
  c.y -= 22;
  texte(c, t, MARGE, c.y, { taille: 12, gras: true });
  c.y -= 6;
  c.page.drawLine({ start: { x: MARGE, y: c.y }, end: { x: MARGE + LARGEUR, y: c.y }, thickness: 0.6, color: FILET });
  c.y -= 14;
}

// Barres horizontales avec libellé à gauche et valeur au bout.
function barres(c: Ctx, rows: { libelle: string; valeur: number; couleur: ReturnType<typeof rgb> }[], max: number) {
  const xBarre = MARGE + 130;
  const lBarre = LARGEUR - 130 - 50;
  for (const r of rows) {
    place(c, 20);
    texte(c, r.libelle, MARGE, c.y - 9, { max: 122 });
    const w = max > 0 ? Math.max(1, (r.valeur / max) * lBarre) : 1;
    c.page.drawRectangle({ x: xBarre, y: c.y - 12, width: w, height: 12, color: r.couleur });
    texte(c, fmtH(r.valeur), xBarre + w + 5, c.y - 9, { taille: 9 });
    c.y -= 18;
  }
}

export async function genererPdfRapportDossier(r: RapportDossier, auteur: string): Promise<Uint8Array> {
  const doc = await PDFDocument.create();
  doc.setTitle(propre(`Rapport d'heures - ${r.nom}`));
  doc.setAuthor("Atelier Stéphan Hamache");
  const c: Ctx = {
    doc,
    page: doc.addPage(A4),
    y: A4[1] - MARGE,
    f: await doc.embedFont(StandardFonts.Helvetica),
    fb: await doc.embedFont(StandardFonts.HelveticaBold),
  };

  const maintenant = new Date();
  const genere = maintenant.toLocaleDateString("fr-FR", { timeZone: "Europe/Paris" });

  // En-tête
  texte(c, "Atelier Stéphan Hamache · Rapport d'heures", MARGE, c.y - 10, { taille: 9, couleur: GRIS });
  c.y -= 34;
  texte(c, r.nom, MARGE, c.y, { taille: 18, gras: true, max: LARGEUR });
  c.y -= 16;
  texte(c, [r.client, r.statut, `Dossier n° ${r.id}`].filter(Boolean).join(" · "), MARGE, c.y, { couleur: GRIS, max: LARGEUR });
  c.y -= 13;
  texte(c, `Généré le ${genere}${auteur ? ` par ${auteur}` : ""}`, MARGE, c.y, { taille: 9, couleur: GRIS });

  // Indicateurs
  c.y -= 18;
  const ecart = r.total - r.prevu;
  const cases = [
    { l: "Prévu", v: r.prevu > 0 ? fmtH(r.prevu) : "non renseigné" },
    { l: "Réel (cumul)", v: fmtH(r.total) },
    { l: "Écart", v: r.prevu > 0 ? `${ecart > 0 ? "+" : ecart < 0 ? "-" : ""}${fmtH(Math.abs(ecart))}` : "-" },
  ];
  const lCase = (LARGEUR - 16) / 3;
  cases.forEach((k, i) => {
    const x = MARGE + i * (lCase + 8);
    c.page.drawRectangle({ x, y: c.y - 46, width: lCase, height: 46, borderColor: FILET, borderWidth: 0.8 });
    texte(c, k.l, x + 10, c.y - 16, { taille: 9, couleur: GRIS });
    texte(c, k.v, x + 10, c.y - 36, { taille: 15, gras: true });
  });
  c.y -= 50;

  titreSection(c, "Prévu et réel");
  barres(
    c,
    [
      { libelle: "Prévu", valeur: r.prevu, couleur: PREVU },
      { libelle: "Réel (cumul)", valeur: r.total, couleur: REEL },
    ],
    Math.max(r.prevu, r.total)
  );

  titreSection(c, "Heures par opérateur");
  if (r.parOperateur.length === 0) {
    texte(c, "Aucune heure saisie sur ce dossier.", MARGE, c.y - 9, { couleur: GRIS });
    c.y -= 18;
  } else {
    barres(
      c,
      r.parOperateur.map((o) => ({ libelle: o.operateur, valeur: o.heures, couleur: REEL })),
      Math.max(...r.parOperateur.map((o) => o.heures))
    );
  }

  if (r.parType.length > 0) {
    titreSection(c, "Heures par type de travail");
    barres(
      c,
      r.parType.map((t) => ({ libelle: t.type, valeur: t.heures, couleur: REEL })),
      Math.max(...r.parType.map((t) => t.heures))
    );
  }

  // Détail des lignes
  if (r.lignes.length > 0) {
    titreSection(c, "Détail des heures saisies");
    const cols = [
      { l: "Date", w: 58 },
      { l: "Opérateur", w: 80 },
      { l: "Type", w: 70 },
      { l: "Réalisation", w: 90 },
      { l: "Heures", w: 46 },
      { l: "Description", w: LARGEUR - 58 - 80 - 70 - 90 - 46 },
    ];
    const entete = () => {
      let x = MARGE;
      for (const col of cols) {
        texte(c, col.l, x, c.y - 9, { taille: 8, gras: true, couleur: GRIS });
        x += col.w;
      }
      c.y -= 14;
    };
    entete();
    for (const l of r.lignes) {
      if (c.y - 14 < MARGE + 20) {
        nouvellePage(c);
        entete();
      }
      const vals = [
        dateFr(l.date),
        l.operateur,
        l.typeTravail,
        [l.typeRealisation, l.nombre && l.nombre !== 1 ? `×${l.nombre}` : ""].filter(Boolean).join(" "),
        fmtH(l.heures),
        l.description,
      ];
      let x = MARGE;
      vals.forEach((v, i) => {
        texte(c, v, x, c.y - 9, { taille: 8.5, max: cols[i].w - 6 });
        x += cols[i].w;
      });
      c.y -= 13;
      c.page.drawLine({ start: { x: MARGE, y: c.y + 1 }, end: { x: MARGE + LARGEUR, y: c.y + 1 }, thickness: 0.3, color: FILET });
    }
  }

  // Pied de page : numéro de page
  const pages = doc.getPages();
  pages.forEach((p, i) => {
    const t = `${i + 1} / ${pages.length}`;
    p.drawText(t, { x: A4[0] - MARGE - c.f.widthOfTextAtSize(t, 8), y: MARGE - 16, size: 8, font: c.f, color: GRIS });
  });

  return doc.save();
}
