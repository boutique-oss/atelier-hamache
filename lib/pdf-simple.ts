// Générateur PDF minimal, sans dépendance : pages A4, texte Helvetica /
// Helvetica-Bold (polices standard, encodage WinAnsi = accents français),
// rectangles pleins et traits. Suffisant pour des rapports tabulaires ; pas
// d'images ni de polices embarquées. Coordonnées en points, origine en HAUT à
// gauche (converties vers le repère PDF, origine en bas).

export const A4 = { w: 595.28, h: 841.89 };

type Couleur = [number, number, number]; // 0..1

// Largeurs Helvetica (AFM, /1000 em) des caractères ASCII 32 → 126. Les
// lettres accentuées prennent la largeur de leur lettre de base.
const LARGEURS =
  "278,278,355,556,556,889,667,191,333,333,389,584,278,333,278,278,556,556,556,556,556,556,556,556,556,556,278,278,584,584,584,556,1015,667,667,722,722,667,611,778,722,278,500,667,556,833,722,778,667,778,722,667,611,722,667,944,667,667,611,278,278,278,469,556,333,556,556,500,556,556,278,556,556,222,222,500,222,833,556,556,556,556,333,500,278,556,500,722,500,500,500,334,260,334,584"
    .split(",")
    .map(Number);

// Caractères hors Latin-1 présents dans WinAnsi.
const WINANSI_SPECIAUX: Record<string, number> = {
  "€": 0x80, "‚": 0x82, "„": 0x84, "…": 0x85, "‘": 0x91, "’": 0x92, "“": 0x93,
  "”": 0x94, "•": 0x95, "–": 0x96, "—": 0x97, "œ": 0x9c, "Œ": 0x8c, "Ÿ": 0x9f,
};

function octetWinAnsi(c: string): number {
  if (WINANSI_SPECIAUX[c] != null) return WINANSI_SPECIAUX[c];
  const code = c.codePointAt(0) ?? 63;
  if (code === 0x202f || code === 0x2009) return 0x20; // espaces fines → espace
  if ((code >= 0x20 && code <= 0x7e) || (code >= 0xa0 && code <= 0xff)) return code;
  return 0x3f; // « ? »
}

function largeurCar(c: string): number {
  const base = c.normalize("NFD")[0] ?? c;
  const code = base.charCodeAt(0);
  if (code >= 32 && code <= 126) return LARGEURS[code - 32];
  return 556;
}

export function largeurTexte(s: string, taille: number, gras = false): number {
  let w = 0;
  for (const c of s) w += largeurCar(c);
  return (w / 1000) * taille * (gras ? 1.06 : 1);
}

// Coupe le texte (avec « … ») pour qu'il tienne dans `max` points.
export function ajuster(s: string, max: number, taille: number, gras = false): string {
  if (largeurTexte(s, taille, gras) <= max) return s;
  let out = s;
  while (out.length > 1 && largeurTexte(out + "…", taille, gras) > max) out = out.slice(0, -1);
  return out.trimEnd() + "…";
}

const f = (v: number) => (Math.round(v * 100) / 100).toString();
const rgb = (c: Couleur) => c.map((x) => f(x)).join(" ");
const hex = (s: string) =>
  "<" + [...s].map((c) => octetWinAnsi(c).toString(16).padStart(2, "0")).join("") + ">";

export function couleur(hexa: string): Couleur {
  const h = hexa.replace("#", "");
  return [0, 2, 4].map((i) => parseInt(h.slice(i, i + 2), 16) / 255) as Couleur;
}

export class PdfSimple {
  private pages: string[][] = [];

  constructor() {
    this.nouvellePage();
  }

  get page(): number {
    return this.pages.length;
  }

  nouvellePage() {
    this.pages.push([]);
  }

  private op(s: string) {
    this.pages[this.pages.length - 1].push(s);
  }

  texte(
    x: number,
    y: number,
    s: string,
    o: { taille?: number; gras?: boolean; couleur?: Couleur; align?: "gauche" | "droite" | "centre" } = {}
  ) {
    const taille = o.taille ?? 10;
    const w = o.align && o.align !== "gauche" ? largeurTexte(s, taille, o.gras) : 0;
    const x0 = o.align === "droite" ? x - w : o.align === "centre" ? x - w / 2 : x;
    this.op(
      `BT /${o.gras ? "F2" : "F1"} ${f(taille)} Tf ${rgb(o.couleur ?? [0, 0, 0])} rg ${f(x0)} ${f(A4.h - y)} Td ${hex(s)} Tj ET`
    );
  }

  rect(x: number, y: number, w: number, h: number, c: Couleur) {
    if (w <= 0 || h <= 0) return;
    this.op(`${rgb(c)} rg ${f(x)} ${f(A4.h - y - h)} ${f(w)} ${f(h)} re f`);
  }

  trait(x1: number, y1: number, x2: number, y2: number, c: Couleur = [0, 0, 0], epaisseur = 0.5) {
    this.op(`${rgb(c)} RG ${f(epaisseur)} w ${f(x1)} ${f(A4.h - y1)} m ${f(x2)} ${f(A4.h - y2)} l S`);
  }

  // Assemble le fichier. Tout le contenu est ASCII (textes en hexadécimal) :
  // longueur en caractères = longueur en octets, pour les offsets de la table xref.
  octets(titre = "Document"): Uint8Array {
    const objets: string[] = [];
    const nPages = this.pages.length;
    // 1 catalogue, 2 arbre des pages, 3-4 polices, 5 infos, puis page/contenu par page.
    const idPage = (i: number) => 6 + i * 2;
    objets[1] = "<< /Type /Catalog /Pages 2 0 R >>";
    objets[2] = `<< /Type /Pages /Count ${nPages} /Kids [${this.pages.map((_, i) => `${idPage(i)} 0 R`).join(" ")}] >>`;
    objets[3] = "<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica /Encoding /WinAnsiEncoding >>";
    objets[4] = "<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica-Bold /Encoding /WinAnsiEncoding >>";
    objets[5] = `<< /Title ${hex(titre)} /Producer (ERP atelier) >>`;
    this.pages.forEach((ops, i) => {
      const contenu = ops.join("\n");
      objets[idPage(i)] =
        `<< /Type /Page /Parent 2 0 R /MediaBox [0 0 ${f(A4.w)} ${f(A4.h)}] ` +
        `/Resources << /Font << /F1 3 0 R /F2 4 0 R >> >> /Contents ${idPage(i) + 1} 0 R >>`;
      objets[idPage(i) + 1] = `<< /Length ${contenu.length} >>\nstream\n${contenu}\nendstream`;
    });

    let out = "%PDF-1.4\n";
    const offsets: number[] = [];
    for (let id = 1; id < objets.length; id++) {
      offsets[id] = out.length;
      out += `${id} 0 obj\n${objets[id]}\nendobj\n`;
    }
    const xref = out.length;
    out += `xref\n0 ${objets.length}\n0000000000 65535 f \n`;
    for (let id = 1; id < objets.length; id++) {
      out += `${String(offsets[id]).padStart(10, "0")} 00000 n \n`;
    }
    out += `trailer\n<< /Size ${objets.length} /Root 1 0 R /Info 5 0 R >>\nstartxref\n${xref}\n%%EOF\n`;
    return new TextEncoder().encode(out);
  }
}
