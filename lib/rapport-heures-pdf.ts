// Mise en page PDF du rapport d'heures d'un dossier (phase 6). Lisible en
// noir et blanc : prévu en gris clair, réel en gris foncé, dépassement en
// brique foncée au bout de la barre réelle. Données déjà agrégées en SQL
// (lib/rapport-heures.ts).
import { A4, ajuster, couleur, PdfSimple } from "@/lib/pdf-simple";
import type { RapportDossier } from "@/lib/rapport-heures";

const MARGE = 42;
const LARGEUR = A4.w - 2 * MARGE;
const BAS = A4.h - 50;

const ENCRE = couleur("#22303C");
const GRIS = couleur("#6B7480");
const FILET = couleur("#D9DDE2");
const CLAIR = couleur("#C3CCD5");
const FONCE = couleur("#2F3B47");
const DEPASSE = couleur("#7A2E2E");

const MOIS = ["janv.", "févr.", "mars", "avr.", "mai", "juin", "juil.", "août", "sept.", "oct.", "nov.", "déc."];

export const heuresFr = (v: number) => `${String(Math.round(v * 10) / 10).replace(".", ",")} h`;
const dateFr = (iso: string) => {
  const [y, m, d] = iso.split("-");
  return d && m && y ? `${d}/${m}/${y}` : iso;
};
const moisFr = (am: string) => {
  const [y, m] = am.split("-");
  return MOIS[Number(m) - 1] ? `${MOIS[Number(m) - 1]} ${y}` : am;
};

export function rapportHeuresPdf(r: RapportDossier, o: { auteur: string; date: Date }): Uint8Array {
  const pdf = new PdfSimple();
  let y = MARGE;

  const piedDePage = () => {
    pdf.trait(MARGE, A4.h - 36, A4.w - MARGE, A4.h - 36, FILET);
    pdf.texte(MARGE, A4.h - 24, `Rapport d'heures — ${r.nom}`, { taille: 8, couleur: GRIS });
    pdf.texte(A4.w - MARGE, A4.h - 24, `Page ${pdf.page}`, { taille: 8, couleur: GRIS, align: "droite" });
  };
  const place = (h: number) => {
    if (y + h <= BAS) return;
    piedDePage();
    pdf.nouvellePage();
    y = MARGE;
  };
  const titreSection = (t: string) => {
    place(40);
    y += 14;
    pdf.texte(MARGE, y, t, { taille: 12, gras: true, couleur: ENCRE });
    y += 6;
    pdf.trait(MARGE, y, A4.w - MARGE, y, FILET);
    y += 14;
  };

  // ── En-tête ──
  pdf.texte(MARGE, y + 8, "Atelier Stéphan Hamache — tapisserie d'ameublement", { taille: 9, couleur: GRIS });
  y += 30;
  pdf.texte(MARGE, y, "Rapport d'heures", { taille: 20, gras: true, couleur: ENCRE });
  y += 22;
  pdf.texte(MARGE, y, ajuster(r.nom, LARGEUR, 13, true), { taille: 13, gras: true, couleur: ENCRE });
  y += 16;
  const sousTitre = [`Dossier n° ${r.id}`, r.client, r.statut && `statut : ${r.statut}`].filter(Boolean).join(" · ");
  pdf.texte(MARGE, y, ajuster(sousTitre, LARGEUR, 10), { taille: 10, couleur: GRIS });
  y += 14;
  const le = o.date.toLocaleDateString("fr-FR", { day: "2-digit", month: "2-digit", year: "numeric", timeZone: "Europe/Paris" });
  pdf.texte(MARGE, y, `Généré le ${le} par ${o.auteur}`, { taille: 9, couleur: GRIS });
  y += 10;

  // ── Synthèse prévu / réel ──
  titreSection("Prévu et réel");
  const ecart = r.reel - r.prevu;
  const max = Math.max(r.prevu, r.reel, 1);
  const largeurBarre = LARGEUR - 160;
  const barre = (libelle: string, v: number, c: typeof CLAIR, depasse = 0) => {
    place(22);
    pdf.texte(MARGE, y + 10, libelle, { taille: 10, couleur: ENCRE });
    const w = (v / max) * largeurBarre;
    const wDep = (depasse / max) * largeurBarre;
    pdf.rect(MARGE + 70, y, w - wDep, 14, c);
    pdf.rect(MARGE + 70 + w - wDep, y, wDep, 14, DEPASSE);
    pdf.texte(MARGE + 76 + w, y + 10.5, heuresFr(v), { taille: 10, gras: true, couleur: ENCRE });
    y += 22;
  };
  barre("Prévu", r.prevu, CLAIR);
  barre("Réel", r.reel, FONCE, r.prevu > 0 ? Math.max(0, ecart) : 0);
  place(18);
  y += 4;
  const bilan =
    r.prevu > 0
      ? `Écart : ${ecart > 0 ? "+" : ""}${heuresFr(ecart)} (${Math.round((r.reel / r.prevu) * 100)} % du prévu)`
      : "Aucune heure prévue renseignée sur le dossier.";
  pdf.texte(MARGE, y, bilan, { taille: 10, gras: r.prevu > 0 && ecart > 0, couleur: ENCRE });
  y += 8;

  // ── Répartitions ──
  const repartition = (titre: string, rows: { libelle: string; h: number }[], libelle = (s: string) => s) => {
    titreSection(titre);
    if (!rows.length) {
      pdf.texte(MARGE, y, "Aucune heure saisie.", { taille: 10, couleur: GRIS });
      y += 14;
      return;
    }
    const total = rows.reduce((s, x) => s + x.h, 0) || 1;
    const maxH = Math.max(...rows.map((x) => x.h), 1);
    for (const row of rows) {
      place(18);
      pdf.texte(MARGE, y + 9, ajuster(libelle(row.libelle), 150, 10), { taille: 10, couleur: ENCRE });
      pdf.rect(MARGE + 160, y, (row.h / maxH) * (LARGEUR - 260), 11, FONCE);
      pdf.texte(A4.w - MARGE - 40, y + 9, heuresFr(row.h), { taille: 10, gras: true, couleur: ENCRE, align: "droite" });
      pdf.texte(A4.w - MARGE, y + 9, `${Math.round((row.h / total) * 100)} %`, { taille: 9, couleur: GRIS, align: "droite" });
      y += 18;
    }
  };
  repartition("Par opérateur", r.parOperateur);
  repartition("Par type de travail", r.parType);
  repartition("Par mois", r.parMois, moisFr);

  // ── Détail des saisies ──
  titreSection(`Détail des saisies (${r.lignes.length})`);
  const cols = [
    { titre: "Date", x: MARGE, w: 56 },
    { titre: "Opérateur", x: MARGE + 58, w: 80 },
    { titre: "Type", x: MARGE + 140, w: 70 },
    { titre: "Réalisation / description", x: MARGE + 212, w: LARGEUR - 212 - 50 },
  ];
  const entete = () => {
    place(30);
    for (const c of cols) pdf.texte(c.x, y, c.titre, { taille: 8, gras: true, couleur: GRIS });
    pdf.texte(A4.w - MARGE, y, "Heures", { taille: 8, gras: true, couleur: GRIS, align: "droite" });
    y += 5;
    pdf.trait(MARGE, y, A4.w - MARGE, y, FILET);
    y += 11;
  };
  if (!r.lignes.length) {
    pdf.texte(MARGE, y, "Aucune heure saisie sur ce dossier.", { taille: 10, couleur: GRIS });
  } else {
    entete();
    for (const l of r.lignes) {
      if (y + 15 > BAS) {
        piedDePage();
        pdf.nouvellePage();
        y = MARGE;
        entete();
      }
      const detail = [l.realisation, l.description].filter((s) => s.trim()).join(" — ");
      pdf.texte(cols[0].x, y, dateFr(l.date), { taille: 9, couleur: ENCRE });
      pdf.texte(cols[1].x, y, ajuster(l.operateur, cols[1].w, 9), { taille: 9, couleur: ENCRE });
      pdf.texte(cols[2].x, y, ajuster(l.type, cols[2].w, 9), { taille: 9, couleur: ENCRE });
      pdf.texte(cols[3].x, y, ajuster(detail, cols[3].w, 9), { taille: 9, couleur: GRIS });
      pdf.texte(A4.w - MARGE, y, heuresFr(l.heures), { taille: 9, couleur: ENCRE, align: "droite" });
      y += 4;
      pdf.trait(MARGE, y, A4.w - MARGE, y, FILET, 0.3);
      y += 11;
    }
    place(18);
    y += 2;
    pdf.texte(cols[3].x, y, "Total", { taille: 10, gras: true, couleur: ENCRE });
    pdf.texte(A4.w - MARGE, y, heuresFr(r.reel), { taille: 10, gras: true, couleur: ENCRE, align: "droite" });
  }

  piedDePage();
  return pdf.octets(`Rapport d'heures — ${r.nom}`);
}
