// Base de graphiques IMPRIMABLES : SVG pur, rendu côté serveur, sans
// recharts (ni animation ni chargement différé : l'impression capture tout de
// suite le bon rendu). Lisibles en noir et blanc : séries différenciées par
// la clarté (clair / foncé), valeur écrite au bout de chaque barre.
// Réutilisable dans toute page A4 (app/documents/*).

export type Serie = { nom: string; couleur: string };

export const TEINTES = {
  clair: "#B9C4CF", // ardoise claire : prévu, pointé
  fonce: "#2F3B47", // ardoise nuit : réel, saisi
  alerte: "#7A2E2E", // brique foncée : dépassement
  encre: "#22303C",
  gris: "#6B7480",
  filet: "#D9DDE2",
};

const fmt = (v: number) =>
  v > 0 ? `${String(Math.round(v * 10) / 10).replace(".", ",")} h` : "";

const tronque = (s: string, max: number) => (s.length > max ? s.slice(0, max - 1) + "…" : s);

function Legende({ series }: { series: Serie[] }) {
  if (series.length < 2) return null;
  return (
    <div style={{ display: "flex", gap: 14, fontSize: 10, color: TEINTES.gris, margin: "0 0 4px" }}>
      {series.map((s) => (
        <span key={s.nom} style={{ display: "inline-flex", alignItems: "center", gap: 5 }}>
          <span
            style={{
              width: 10,
              height: 10,
              background: s.couleur,
              display: "inline-block",
              // Couleurs de fond imprimées même si l'option « graphiques d'arrière-plan » est décochée.
              printColorAdjust: "exact",
              WebkitPrintColorAdjust: "exact",
            }}
          />
          {s.nom}
        </span>
      ))}
    </div>
  );
}

// Barres horizontales, une ligne par libellé, une barre par série.
export function BarresHorizontales({
  lignes,
  series,
  largeur = 680,
  largeurLibelle = 170,
  vide = "Aucune donnée sur cette période.",
}: {
  lignes: { libelle: string; valeurs: number[] }[];
  series: Serie[];
  largeur?: number;
  largeurLibelle?: number;
  vide?: string;
}) {
  if (!lignes.length) return <p style={{ fontSize: 11, color: TEINTES.gris }}>{vide}</p>;
  const hBarre = 11;
  const ecart = 2;
  const hLigne = series.length * (hBarre + ecart) + 10;
  const max = Math.max(1, ...lignes.flatMap((l) => l.valeurs));
  const zone = largeur - largeurLibelle - 56; // place pour la valeur à droite
  const hauteur = lignes.length * hLigne + 4;
  return (
    <figure style={{ margin: 0 }}>
      <Legende series={series} />
      <svg
        viewBox={`0 0 ${largeur} ${hauteur}`}
        width="100%"
        role="img"
        style={{ display: "block", printColorAdjust: "exact", WebkitPrintColorAdjust: "exact" }}
      >
        {lignes.map((l, i) => {
          const y0 = i * hLigne + 4;
          return (
            <g key={l.libelle + i}>
              <text
                x={largeurLibelle - 8}
                y={y0 + (series.length * (hBarre + ecart)) / 2 + 3}
                textAnchor="end"
                fontSize={10.5}
                fill={TEINTES.encre}
              >
                {tronque(l.libelle, 30)}
              </text>
              {series.map((s, j) => {
                const v = l.valeurs[j] ?? 0;
                const w = (v / max) * zone;
                const y = y0 + j * (hBarre + ecart);
                return (
                  <g key={s.nom}>
                    <rect x={largeurLibelle} y={y} width={Math.max(0, w)} height={hBarre} fill={s.couleur} rx={2} />
                    <text x={largeurLibelle + w + 4} y={y + hBarre - 2} fontSize={9.5} fill={TEINTES.encre}>
                      {fmt(v)}
                    </text>
                  </g>
                );
              })}
            </g>
          );
        })}
        <line x1={largeurLibelle} y1={0} x2={largeurLibelle} y2={hauteur} stroke={TEINTES.filet} />
      </svg>
    </figure>
  );
}

// Colonnes verticales (évolution dans le temps), valeur au-dessus de chaque colonne.
export function Colonnes({
  points,
  couleur = TEINTES.fonce,
  largeur = 680,
  hauteur = 170,
  vide = "Aucune donnée sur cette période.",
}: {
  points: { libelle: string; valeur: number }[];
  couleur?: string;
  largeur?: number;
  hauteur?: number;
  vide?: string;
}) {
  if (!points.length) return <p style={{ fontSize: 11, color: TEINTES.gris }}>{vide}</p>;
  const haut = 16; // place de la valeur
  const bas = 22; // place des libellés
  const zone = hauteur - haut - bas;
  const max = Math.max(1, ...points.map((p) => p.valeur));
  const pas = largeur / points.length;
  const wCol = Math.min(46, pas * 0.68);
  const afficherTous = points.length <= 16;
  return (
    <svg
      viewBox={`0 0 ${largeur} ${hauteur}`}
      width="100%"
      role="img"
      style={{ display: "block", printColorAdjust: "exact", WebkitPrintColorAdjust: "exact" }}
    >
      <line x1={0} y1={haut + zone} x2={largeur} y2={haut + zone} stroke={TEINTES.filet} />
      {points.map((p, i) => {
        const h = (p.valeur / max) * zone;
        const x = i * pas + (pas - wCol) / 2;
        const cx = i * pas + pas / 2;
        return (
          <g key={p.libelle + i}>
            <rect x={x} y={haut + zone - h} width={wCol} height={Math.max(0, h)} fill={couleur} rx={2} />
            {afficherTous && (
              <text x={cx} y={haut + zone - h - 4} textAnchor="middle" fontSize={9} fill={TEINTES.encre}>
                {fmt(p.valeur)}
              </text>
            )}
            {(afficherTous || i % Math.ceil(points.length / 16) === 0) && (
              <text x={cx} y={hauteur - 7} textAnchor="middle" fontSize={9} fill={TEINTES.gris}>
                {p.libelle}
              </text>
            )}
          </g>
        );
      })}
    </svg>
  );
}
