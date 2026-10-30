import { PrintButton } from "@/components/print-button";

export const dynamic = "force-dynamic";

// ── Fiche d'intervention RIDEAUX — reprise au point près du PDF de l'atelier ──
// Toutes les coordonnées viennent du PDF d'origine (A4 595,276 × 841,89 pt) et
// sont exprimées ici en points : la feuille est dessinée à l'échelle 1 pt = 1 px
// puis agrandie via `transform: scale(4/3)` pour tomber sur du 96 dpi (794 px).
// Seul le logo (image de 105 × 104 pt en haut à gauche) a été retiré ; aucun
// autre élément n'a bougé, d'où le blanc à gauche du titre.
const INK = "#000";
const SANS = "Carlito, Calibri, Arial, sans-serif";
const SERIF = "'Minion Pro', Georgia, serif"; // « NOTE : » est en serif dans le PDF

const PAGE_W = 595.276;
const PAGE_H = 841.89;
const SCALE = 4 / 3; // pt → px 96 dpi

// Un bloc de prise de cotes : cadre de 523,276 × 210,614 pt, répété 3 fois.
const BLOC_W = 523.276;
const BLOC_H = 210.614;
const BLOC_TOPS = [175.9, 387.51, 599.13]; // pas de 211,614 pt, comme le PDF

const txt: React.CSSProperties = {
  position: "absolute", whiteSpace: "pre", fontFamily: SANS, color: INK, lineHeight: 1,
};
// Trait d'écriture : chaque libellé est souligné sur sa largeur d'origine.
function Trait({ left, top, width, h = 0.697 }: { left: number; top: number; width: number; h?: number }) {
  return <div style={{ position: "absolute", left, top, width, height: h, background: INK }} />;
}
// Case à cocher : 10,484 × 11,939 pt dans le PDF.
function Case({ left, top }: { left: number; top: number }) {
  return <div style={{ position: "absolute", left, top, width: 10.484, height: 11.939, border: `1px solid ${INK}` }} />;
}
// Position d'un texte à partir de sa ligne de base (comme dans le PDF).
function base(baselineTop: number, size: number) {
  return baselineTop - size * 0.8;
}

function BlocRideau({ top }: { top: number }) {
  return (
    <div style={{ position: "absolute", left: 37, top, width: BLOC_W, height: BLOC_H, border: `1px solid ${INK}` }}>
      {/* Colonne gauche */}
      <div style={{ ...txt, left: 6.8, top: base(22.29, 15), fontSize: 15 }}>Pièce :</div>
      <Trait left={6.8} top={23.62} width={42.012} h={0.872} />

      <div style={{ ...txt, left: 6.8, top: base(41.79, 12), fontSize: 12 }}>Longeur de tringle :</div>
      <Trait left={6.8} top={42.86} width={103.764} />

      <div style={{ ...txt, left: 6.8, top: base(69.79, 12), fontSize: 12 }}>Nombre de crochets :</div>
      <Trait left={6.8} top={70.8} width={114.164} />

      <div style={{ ...txt, left: 6.8, top: base(97.29, 12), fontSize: 12 }}>Hauteur dessous de Tringle/sol :</div>
      <Trait left={6.8} top={98.35} width={170.361} />

      <div style={{ ...txt, left: 6.8, top: base(120.89, 12), fontSize: 12 }}>Type de tête :</div>
      <Trait left={6.8} top={121.91} width={71.912} />

      <div style={{ ...txt, left: 6.8, top: base(149.69, 12), fontSize: 12 }}>Type de bas :</div>
      <Trait left={6.8} top={150.71} width={69.48} />

      {/* Filet pleine largeur, puis la zone de note */}
      <Trait left={-0.5} top={159.39} width={524.276} h={1} />
      <div style={{ ...txt, left: 6.8, top: base(171.89, 12), fontSize: 12, fontFamily: SERIF }}>NOTE :</div>
      <Trait left={6.8} top={173.06} width={37.404} h={0.6} />

      {/* Colonne droite */}
      <div style={{ ...txt, left: 378, top: base(20.09, 12), fontSize: 12 }}>Unique</div>
      <Case left={420.445} top={11.56} />
      <div style={{ ...txt, left: 447, top: base(20.09, 12), fontSize: 12 }}>Paire</div>
      <Case left={478.126} top={11.56} />

      <div style={{ ...txt, left: 294.7, top: base(37.19, 12), fontSize: 12 }}>
        Si unique          G:_________ D:___________
      </div>
      <div style={{ ...txt, left: 294.7, top: base(58.79, 12), fontSize: 12 }}>
        Retour :             G:_________ D:___________
      </div>

      <div style={{ ...txt, left: 294.7, top: base(80.49, 12), fontSize: 12 }}>Doublure</div>
      <div style={{ ...txt, left: 384, top: base(80.49, 12), fontSize: 12 }}>Satinette</div>
      <Case left={434.333} top={71.78} />
      <div style={{ ...txt, left: 466, top: base(80.49, 12), fontSize: 12 }}>Occ</div>
      <Case left={489.61} top={71.78} />
    </div>
  );
}

export default function FicheRideauxPage() {
  return (
    <>
      <title>Fiche d&apos;intervention rideaux</title>
      <style>{`
        *, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }
        body { font-family: ${SANS}; background: #ECECEC; color: ${INK}; -webkit-print-color-adjust: exact; print-color-adjust: exact; }
        .print-btn {
          position: fixed; top: 14px; right: 14px; z-index: 999;
          background: #000; color: #fff; border: none; padding: 9px 20px;
          font-family: ${SANS}; font-size: 11px; font-weight: 700;
          text-transform: uppercase; letter-spacing: 0.1em; cursor: pointer; border-radius: 4px;
        }
        @media print {
          @page { margin: 0; size: A4; }
          body { background: #fff; }
          .sheet { box-shadow: none !important; margin: 0 !important; }
          .print-btn { display: none !important; }
        }
      `}</style>

      <PrintButton className="print-btn" />

      <div
        className="sheet"
        style={{
          width: PAGE_W * SCALE, height: PAGE_H * SCALE,
          margin: "20px auto", background: "#fff", boxShadow: "0 6px 30px rgba(0,0,0,0.12)",
        }}
      >
        <div style={{ width: PAGE_W, height: PAGE_H, position: "relative", transform: `scale(${SCALE})`, transformOrigin: "top left" }}>
          {/* En-tête (le logo d'origine, à gauche, a été retiré) */}
          <div style={{ ...txt, left: 158.74, top: base(77.29, 35), fontSize: 35, fontWeight: 700 }}>
            RIDEAUX PRISE DE COTES
          </div>
          <div style={{ ...txt, left: 158.74, top: base(121.39, 15), fontSize: 15 }}>CLIENT :</div>
          <Trait left={158.74} top={122.65} width={54.368} h={0.872} />

          {BLOC_TOPS.map((top) => (
            <BlocRideau key={top} top={top} />
          ))}
        </div>
      </div>
    </>
  );
}
