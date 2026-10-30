import { PrintButton } from "@/components/print-button";

export const dynamic = "force-dynamic";

// ── Prédevis VIERGE — noir & blanc, à remplir à la main, 1 page A4 dense ──
const INK = "#000";
const GRAY = "#555"; // libellés (niveaux de gris = OK en N&B)
const WLINE = "#B7B7B7"; // lignes d'écriture discrètes
const SANS = "'Helvetica Neue', Arial, sans-serif";

const MENTIONS =
  "Devis valable 30 jours. Acompte de 30 % à la commande, solde à la livraison. " +
  "Prix indicatifs — confirmés à la commande.";

const labelS: React.CSSProperties = {
  fontFamily: SANS, fontSize: 12, fontWeight: 700,
  textTransform: "uppercase", letterSpacing: "0.05em", color: GRAY, whiteSpace: "nowrap",
};
const th: React.CSSProperties = {
  fontFamily: SANS, fontSize: 12, fontWeight: 700, textTransform: "uppercase",
  letterSpacing: "0.05em", color: INK, textAlign: "left",
  padding: "5px 7px", borderBottom: `1.5px solid ${INK}`, borderRight: `1px solid ${INK}`,
};
const tdCell: React.CSSProperties = {
  padding: "0 7px", height: 30, borderBottom: `1px solid ${WLINE}`,
  borderRight: `1px solid ${WLINE}`, verticalAlign: "middle",
};
// Lignes plus fines : descriptif & tissus, où l'on veut beaucoup de lignes.
const tdSlim: React.CSSProperties = { ...tdCell, height: 27 };
// Tableau encadré (bord extérieur noir, grille grise à l'intérieur)
const tableS: React.CSSProperties = {
  width: "100%", borderCollapse: "collapse", border: `1.5px solid ${INK}`,
};

// Bandeau de section : le noir s'arrête à la fin du titre (pas de pleine
// largeur), et `space` règle l'air au-dessus — c'est lui qui remonte Tissus et
// redescend Chiffrage.
function SectionH({ title, space = 10 }: { title: string; space?: number }) {
  return (
    <div style={{ marginTop: space, marginBottom: 7 }}>
      <span
        style={{
          display: "inline-block",
          fontFamily: SANS, fontWeight: 700, fontSize: 15, letterSpacing: "0.1em",
          textTransform: "uppercase", color: "#fff", background: INK,
          padding: "4px 12px 4px 9px",
        }}
      >
        {title}
      </span>
    </div>
  );
}

// Champ « Libellé ______ » avec ligne d'écriture qui s'étire.
function Field({ label, height = 22 }: { label: string; height?: number }) {
  return (
    <div style={{ display: "flex", alignItems: "flex-end", gap: 6, flex: 1 }}>
      <span style={labelS}>{label}</span>
      <span style={{ flex: 1, borderBottom: `1px solid ${INK}`, height }} />
    </div>
  );
}

export default function PredevisViergePage() {
  return (
    <>
      <title>Prédevis vierge</title>
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
          @page { margin: 10mm 12mm; size: A4; }
          body { background: #fff; }
          .sheet { box-shadow: none !important; margin: 0 !important; width: auto !important; }
          .print-btn { display: none !important; }
        }
      `}</style>

      <PrintButton className="print-btn" />

      <div
        className="sheet"
        style={{ width: 794, margin: "20px auto", background: "#fff", padding: "20px 24px 22px", boxShadow: "0 6px 30px rgba(0,0,0,0.12)" }}
      >
        {/* En-tête */}
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-end", gap: 20, border: `2px solid ${INK}`, padding: "6px 12px" }}>
          <div style={{ fontFamily: SANS, fontSize: 36, fontWeight: 700, letterSpacing: "0.06em", textTransform: "uppercase", lineHeight: 1 }}>
            Prédevis
          </div>
          <div style={{ textAlign: "right", flexShrink: 0 }}>
            <div style={{ fontFamily: SANS, fontSize: 12.5, color: INK }}>N° _______________</div>
            <div style={{ fontFamily: SANS, fontSize: 12.5, color: INK, marginTop: 5 }}>Date _____________</div>
          </div>
        </div>

        {/* Client */}
        <SectionH title="Client" />
        <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
          <div style={{ display: "flex", gap: 24 }}>
            <Field label="Nom" />
            <Field label="Téléphone" />
          </div>
          <div style={{ display: "flex", gap: 24 }}>
            <Field label="Adresse" />
            <Field label="Email" />
          </div>
        </div>

        {/* Descriptif du meuble */}
        <SectionH title="Descriptif du meuble / travaux" />
        <div style={{ display: "flex", gap: 24, marginBottom: 8 }}>
          <Field label="Type de meuble" />
        </div>
        <table style={tableS}>
          <thead>
            <tr>
              <th style={{ ...th, width: "26%" }}>Élément</th>
              <th style={{ ...th, width: "48%" }}>Travaux à réaliser</th>
              <th style={{ ...th, width: "26%" }}>Observations</th>
            </tr>
          </thead>
          <tbody>
            {[0, 1, 2, 3, 4, 5].map((i) => (
              <tr key={`d${i}`}>
                <td style={tdSlim} />
                <td style={tdSlim} />
                <td style={tdSlim} />
              </tr>
            ))}
          </tbody>
        </table>

        {/* Tissus & fournitures */}
        <SectionH title="Tissus & fournitures" space={4} />
        <table style={tableS}>
          <thead>
            <tr>
              <th style={{ ...th, width: "30%" }}>Référence</th>
              <th style={{ ...th, width: "24%" }}>Coloris</th>
              <th style={{ ...th, width: "18%" }}>Métrage</th>
              <th style={{ ...th, width: "28%" }}>Fournisseur</th>
            </tr>
          </thead>
          <tbody>
            {[0, 1, 2, 3, 4].map((i) => (
              <tr key={i}>
                <td style={tdSlim} />
                <td style={tdSlim} />
                <td style={tdSlim} />
                <td style={tdSlim} />
              </tr>
            ))}
          </tbody>
        </table>

        {/* Postes chiffrés */}
        <SectionH title="Chiffrage" space={45} />
        <table style={tableS}>
          <thead>
            <tr>
              <th style={{ ...th, width: "62%" }}>Désignation</th>
              <th style={{ ...th, width: "16%", textAlign: "center" }}>Qté</th>
              <th style={{ ...th, width: "22%", textAlign: "right" }}>Total HT</th>
            </tr>
          </thead>
          <tbody>
            {[
              "Main d'œuvre  ( ____ h × ____ €/h )",
              "Déplacement  ( ____ km )",
            ].map((lib) => (
              <tr key={lib}>
                <td style={{ ...tdCell, fontFamily: SANS, fontSize: 13.5, color: INK }}>{lib}</td>
                <td style={tdCell} />
                <td style={tdCell} />
              </tr>
            ))}
            {[0].map((i) => (
              <tr key={`v${i}`}>
                <td style={tdCell} />
                <td style={tdCell} />
                <td style={tdCell} />
              </tr>
            ))}
          </tbody>
        </table>

        {/* Délai + Totaux */}
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-end", gap: 24, marginTop: 12 }}>
          <div style={{ flex: 1, display: "flex", flexDirection: "column", gap: 12, paddingBottom: 2 }}>
            <Field label="Délai de réalisation" />
            <Field label="Livraison prévue" />
          </div>
          <div style={{ width: 262, border: `1.5px solid ${INK}` }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-end", padding: "6px 10px", borderBottom: `1px solid ${WLINE}` }}>
              <span style={labelS}>Total HT</span>
              <span style={{ fontFamily: SANS, fontSize: 13 }}>___________ €</span>
            </div>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-end", padding: "6px 10px", borderBottom: `1.5px solid ${INK}` }}>
              <span style={labelS}>TVA ____ %</span>
              <span style={{ fontFamily: SANS, fontSize: 13 }}>___________ €</span>
            </div>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "8px 10px", background: INK, color: "#fff" }}>
              <span style={{ fontFamily: SANS, fontSize: 13, fontWeight: 700, letterSpacing: "0.04em" }}>TOTAL TTC</span>
              <span style={{ fontFamily: SANS, fontSize: 14, fontWeight: 700 }}>___________ €</span>
            </div>
          </div>
        </div>

        {/* Mentions + signature */}
        <div style={{ marginTop: 10, fontFamily: SANS, fontSize: 10, color: GRAY, lineHeight: 1.4 }}>{MENTIONS}</div>
        <div style={{ marginTop: 8, border: `1.5px solid ${INK}`, padding: "7px 12px 24px" }}>
          <div style={labelS}>Bon pour accord — date et signature du client</div>
        </div>
      </div>
    </>
  );
}
