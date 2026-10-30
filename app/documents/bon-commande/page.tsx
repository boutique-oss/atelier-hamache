import { asc, eq, isNull, or } from "drizzle-orm";

import { db } from "@/db";
import { commandes } from "@/db/schema";
import { PrintButton } from "@/components/print-button";

export const dynamic = "force-dynamic";

// ── Charte Redo (orange / marine) ─────────────────────────────────────────
const ORANGE = "#F26A21";
const MARINE = "#16324F";
const INK = "#22303C";
const GRAY = "#8A8A8A";
const RULE_DOT = "rgba(22,50,79,0.16)";
const SANS = "'Rethink Sans', system-ui, sans-serif";
const SERIF = "'Hedvig Letters Serif', Georgia, serif";

const ENTREPRISE = {
  raisonSociale: "Atelier Stéphan Hamache",
  activite: "Tapisserie d'ameublement · Poitiers",
};

const th: React.CSSProperties = {
  fontFamily: SANS, fontSize: 10, fontWeight: 700, textTransform: "uppercase",
  letterSpacing: "0.1em", color: GRAY, textAlign: "left",
  padding: "0 10px 6px", borderBottom: `1.5px solid ${MARINE}`,
};
const td: React.CSSProperties = {
  fontFamily: SANS, fontSize: 12.5, color: INK,
  padding: "8px 10px", borderBottom: `1px dotted ${RULE_DOT}`, verticalAlign: "middle",
};

// Bon de commande : liste des articles PAS ENCORE REÇUS (est_recu ≠ true),
// qu'ils soient « à commander » (est_commande non coché) ou « à recevoir »
// (déjà commandés), groupés par fournisseur. À imprimer et remettre à la
// manutention (colonne « Reçu » à cocher à la réception).
export default async function BonCommandePage() {
  const rows = await db
    .select()
    .from(commandes)
    .where(or(eq(commandes.estRecu, false), isNull(commandes.estRecu)))
    .orderBy(asc(commandes.fournisseur), asc(commandes.designation));

  const nACommander = rows.filter((c) => !c.estCommande).length;
  const nARecevoir = rows.filter((c) => c.estCommande).length;

  // Regroupement par fournisseur (ordre d'apparition, déjà trié).
  const parFournisseur = new Map<string, typeof rows>();
  for (const c of rows) {
    const key = (c.fournisseur || "").trim() || "— Fournisseur non précisé —";
    const arr = parFournisseur.get(key) ?? [];
    arr.push(c);
    parFournisseur.set(key, arr);
  }
  const groupes = [...parFournisseur.entries()];
  const dateStr = new Date().toLocaleDateString("fr-FR");

  return (
    <>
      <title>Bon de commande</title>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Rethink+Sans:ital,wght@0,400;0,500;0,600;0,700;0,800;1,400&family=Hedvig+Letters+Serif:opsz@12..24&display=swap');
        *, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }
        body { font-family: ${SANS}; background: #EDEFF2; color: ${INK}; -webkit-print-color-adjust: exact; print-color-adjust: exact; }
        .print-btn {
          position: fixed; top: 14px; right: 14px; z-index: 999;
          background: ${ORANGE}; color: #fff; border: none; padding: 9px 20px;
          font-family: ${SANS}; font-size: 11px; font-weight: 700;
          text-transform: uppercase; letter-spacing: 0.1em; cursor: pointer; border-radius: 6px;
        }
        @media print {
          @page { margin: 0; size: A4; }
          body { background: #fff; }
          .sheet { box-shadow: none !important; margin: 0 !important; max-width: none !important; }
          .print-btn { display: none !important; }
          *, *::before, *::after { -webkit-print-color-adjust: exact; print-color-adjust: exact; }
          tr, .bloc-avoid { break-inside: avoid; page-break-inside: avoid; }
        }
      `}</style>

      <PrintButton className="print-btn" />

      <div
        className="sheet"
        style={{ maxWidth: 820, margin: "24px auto", background: "#fff", boxShadow: "0 8px 40px rgba(22,50,79,0.10)" }}
      >
        <div style={{ height: 6, background: ORANGE }} />
        <div style={{ padding: "26px 36px 40px" }}>

          {/* En-tête */}
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: 24 }}>
            <div>
              <div style={{ fontFamily: SERIF, fontSize: 24, color: INK, lineHeight: 1.1 }}>
                {ENTREPRISE.raisonSociale}
              </div>
              <div style={{ fontFamily: SANS, fontSize: 11, color: GRAY, marginTop: 4 }}>
                {ENTREPRISE.activite}
              </div>
            </div>
            <div style={{ textAlign: "right", flexShrink: 0 }}>
              <span
                style={{
                  display: "inline-block", background: ORANGE, color: "#fff",
                  fontFamily: SANS, fontWeight: 700, fontSize: 13,
                  letterSpacing: "0.14em", textTransform: "uppercase", padding: "6px 16px",
                }}
              >
                Bon de commande
              </span>
              <div style={{ fontFamily: SANS, fontSize: 11, color: GRAY, marginTop: 8 }}>{dateStr}</div>
              <div style={{ fontFamily: SANS, fontSize: 11, color: GRAY, marginTop: 2 }}>
                {nACommander} à commander · {nARecevoir} à recevoir
              </div>
            </div>
          </div>

          {rows.length === 0 ? (
            <p style={{ fontFamily: SANS, fontSize: 13, color: GRAY, marginTop: 32 }}>
              Aucun article commandé en attente de réception.
            </p>
          ) : (
            groupes.map(([fournisseur, items]) => (
              <div key={fournisseur} className="bloc-avoid" style={{ marginTop: 26 }}>
                <div
                  style={{
                    fontFamily: SANS, fontWeight: 800, fontSize: 12, letterSpacing: "0.1em",
                    textTransform: "uppercase", color: MARINE,
                    borderBottom: `1.5px solid ${MARINE}`, paddingBottom: 6, marginBottom: 4,
                  }}
                >
                  {fournisseur}{" "}
                  <span style={{ fontWeight: 500, color: GRAY }}>
                    · {items.length} article{items.length > 1 ? "s" : ""}
                  </span>
                </div>
                <table style={{ width: "100%", borderCollapse: "collapse" }}>
                  <thead>
                    <tr>
                      <th style={{ ...th, width: "28%" }}>Désignation</th>
                      <th style={{ ...th, width: "17%" }}>Réf.</th>
                      <th style={{ ...th, width: "13%" }}>Coloris</th>
                      <th style={{ ...th, textAlign: "right", width: "10%" }}>Qté</th>
                      <th style={{ ...th, width: "12%" }}>Client</th>
                      <th style={{ ...th, width: "13%" }}>Statut</th>
                      <th style={{ ...th, textAlign: "center", width: "7%" }}>Reçu</th>
                    </tr>
                  </thead>
                  <tbody>
                    {items.map((c) => {
                      const aCommander = !c.estCommande;
                      return (
                        <tr key={c.id}>
                          <td style={{ ...td, fontWeight: 600 }}>{c.designation || "—"}</td>
                          <td style={td}>{c.reference}</td>
                          <td style={td}>{c.coloris}</td>
                          <td style={{ ...td, textAlign: "right" }}>
                            {c.qte ? `${c.qte} ${c.unite ?? ""}`.trim() : ""}
                          </td>
                          <td style={{ ...td, color: GRAY }}>{c.client}</td>
                          <td style={td}>
                            <span
                              style={{
                                display: "inline-block", fontFamily: SANS, fontSize: 10, fontWeight: 700,
                                textTransform: "uppercase", letterSpacing: "0.06em", padding: "3px 8px",
                                color: aCommander ? "#993C1D" : MARINE,
                                background: aCommander ? "#FAECE7" : "#EDEFF2",
                              }}
                            >
                              {aCommander ? "À commander" : "À recevoir"}
                            </span>
                          </td>
                          <td style={{ ...td, textAlign: "center" }}>
                            <span style={{ display: "inline-block", width: 15, height: 15, border: `1.5px solid ${MARINE}` }} />
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            ))
          )}

          {/* Pied : réception */}
          {rows.length > 0 ? (
            <div className="bloc-avoid" style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-end", marginTop: 34, gap: 40 }}>
              <div style={{ minWidth: "48%" }}>
                <div style={{ fontFamily: SANS, fontSize: 10, fontWeight: 600, textTransform: "uppercase", letterSpacing: "0.1em", color: GRAY, marginBottom: 22 }}>
                  Réceptionné par
                </div>
                <div style={{ borderBottom: `1px solid ${MARINE}` }} />
                <div style={{ fontFamily: SANS, fontSize: 10, color: GRAY, marginTop: 6 }}>Date : ___________</div>
              </div>
              <div style={{ textAlign: "right", fontFamily: SANS, fontSize: 10, color: GRAY, lineHeight: 1.6 }}>
                <div>{ENTREPRISE.raisonSociale}</div>
                <div>Bon de commande · {dateStr}</div>
              </div>
            </div>
          ) : null}

        </div>
      </div>
    </>
  );
}
