import { PrintButton } from "@/components/print-button";
import {
  CONGES_PAR_AN,
  ajouterJours,
  chargerSemaine,
  jourMois,
  lundiValide,
  nf,
  nfs,
  numeroSemaine,
  schemaPret,
} from "@/lib/pointage";

export const dynamic = "force-dynamic";

// ── Charte Redo (orange / marine) ─────────────────────────────────────────
const ORANGE = "#F26A21";
const MARINE = "#16324F";
const INK = "#22303C";
const GRAY = "#8A8A8A";
const RULE = "#DEDEDE";
const DOT = "rgba(22,50,79,0.16)";
const POS = "#2F7D62";
const NEG = "#B4472F";
const SANS = "'Rethink Sans', system-ui, sans-serif";
const SERIF = "'Hedvig Letters Serif', Georgia, serif";

const th: React.CSSProperties = {
  fontFamily: SANS, fontSize: 9.5, fontWeight: 700, textTransform: "uppercase",
  letterSpacing: "0.09em", color: GRAY, textAlign: "center",
  padding: "0 6px 6px", borderBottom: `1.5px solid ${MARINE}`,
};
const td: React.CSSProperties = {
  fontFamily: SANS, fontSize: 12, color: INK, textAlign: "center",
  padding: "7px 6px", borderBottom: `1px dotted ${DOT}`, verticalAlign: "middle",
};
const secStyle: React.CSSProperties = {
  fontFamily: SANS, fontSize: 10, fontWeight: 700, letterSpacing: "0.12em",
  textTransform: "uppercase", color: GRAY, margin: "16px 0 7px",
  display: "flex", alignItems: "center", gap: 9,
};

// Abréviation imprimée d'un type d'absence : lisible en noir et blanc.
const ABREV: Record<string, string> = {
  Congé: "C", Maladie: "M", Férié: "F", Récup: "RC", Repos: "R",
};

function Section({ titre, tag }: { titre: string; tag?: string }) {
  return (
    <h2 style={secStyle}>
      {titre}
      {tag && (
        <span style={{
          fontSize: 8.5, letterSpacing: "0.06em", color: MARINE, textTransform: "none",
          border: `1px solid ${RULE}`, borderRadius: 999, padding: "1px 7px",
        }}>{tag}</span>
      )}
      <span style={{ flex: 1, height: 1, background: RULE }} />
    </h2>
  );
}

export default async function FeuillePointagePage({
  searchParams,
}: {
  searchParams: { lundi?: string };
}) {
  const lundi = lundiValide(searchParams.lundi);
  const vendredi = ajouterJours(lundi, 4);

  if (!(await schemaPret())) {
    return (
      <main style={{ fontFamily: SANS, padding: 40, color: INK }}>
        <p>Le pointage n&apos;est pas encore activé.</p>
        <p style={{ fontSize: 13, color: GRAY }}>
          Ouvre la page Pointage de l&apos;application et clique sur « Activer maintenant ».
        </p>
      </main>
    );
  }

  const { jours, salaries, dirigeants, compteur, conges, dirCumul } =
    await chargerSemaine(lundi);

  const totalJour = jours.map((_, i) =>
    salaries.reduce((s, l) => s + (l.cellules[i]?.heures ?? 0), 0)
  );
  const totalGeneral = salaries.reduce(
    (s, l) => s + l.cellules.reduce((a, c) => a + (c?.heures ?? 0), 0), 0
  );
  const contratTotal = salaries.reduce((s, l) => s + l.contrat, 0);
  const soldeTotal = compteur.reduce((s, c) => s + c.solde, 0);

  return (
    <>
      <style>{`
        @page { size: A4 portrait; margin: 10mm; }
        body { background: #E7ECF0; margin: 0; }
        .sheet {
          width: 210mm; min-height: 297mm; box-sizing: border-box;
          margin: 14px auto 40px; padding: 14mm; background: #fff;
          box-shadow: 0 6px 26px rgba(16,32,48,.18);
        }
        @media print {
          body { background: #fff; }
          .print-btn { display: none !important; }
          .sheet {
            box-shadow: none !important; margin: 0 !important;
            width: auto !important; min-height: 0 !important; padding: 0 !important;
          }
          tr, .avoid { break-inside: avoid; }
        }
      `}</style>

      <div className="print-btn" style={{ maxWidth: "210mm", margin: "0 auto", padding: "14px 6mm 0" }}>
        <PrintButton />
      </div>

      <div className="sheet">
        {/* En-tête */}
        <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", gap: 16 }}>
          <div>
            <div style={{ fontFamily: SERIF, fontSize: 19, color: MARINE, lineHeight: 1.15 }}>
              Atelier Stéphan Hamache
            </div>
            <div style={{ fontFamily: SANS, fontSize: 10, color: GRAY, letterSpacing: "0.06em", textTransform: "uppercase", marginTop: 3 }}>
              Tapisserie d&apos;ameublement · Poitiers
            </div>
          </div>
          <div style={{ textAlign: "right" }}>
            <div style={{ fontFamily: SANS, fontSize: 10, fontWeight: 700, letterSpacing: "0.13em", textTransform: "uppercase", color: ORANGE }}>
              Feuille de pointage
            </div>
            <div style={{ fontFamily: SERIF, fontSize: 17, color: MARINE, marginTop: 2 }}>
              Semaine {numeroSemaine(lundi)} — {lundi.slice(0, 4)}
            </div>
            <div style={{ fontFamily: SANS, fontSize: 11, color: GRAY }}>
              du {jourMois(lundi)} au {jourMois(vendredi)}
            </div>
          </div>
        </div>
        <div style={{ height: 2.5, background: MARINE, marginTop: 9 }} />
        <div style={{ height: 2.5, background: ORANGE, width: 76, marginTop: -2.5 }} />

        <Section titre="Heures des salariés" />

        {salaries.length === 0 ? (
          <p style={{ fontFamily: SANS, fontSize: 12, color: GRAY }}>Aucun salarié.</p>
        ) : (
          <table style={{ width: "100%", borderCollapse: "collapse", fontVariantNumeric: "tabular-nums" }}>
            <thead>
              <tr>
                <th style={{ ...th, textAlign: "left" }}>Salarié</th>
                {jours.map((j) => (
                  <th key={j.date} style={th}>
                    {j.label}
                    <span style={{ display: "block", fontSize: 11, color: INK, letterSpacing: 0, fontWeight: 600 }}>
                      {j.num}
                    </span>
                  </th>
                ))}
                <th style={th}>Total</th>
                <th style={th}>Contrat</th>
                <th style={th}>Écart</th>
              </tr>
            </thead>
            <tbody>
              {salaries.map((l) => {
                const total = l.cellules.reduce((s, c) => s + (c?.heures ?? 0), 0);
                const ecart = total - l.contrat;
                return (
                  <tr key={l.nom}>
                    <td style={{ ...td, textAlign: "left", fontWeight: 600 }}>
                      {l.nom}
                      <small style={{ display: "block", fontSize: 9.5, color: GRAY, fontWeight: 400 }}>
                        {nf(l.contrat)} h / semaine
                      </small>
                    </td>
                    {l.cellules.map((c, i) => (
                      <td key={i} style={td}>
                        {!c ? (
                          "—"
                        ) : c.type === "Travail" ? (
                          nf(c.heures)
                        ) : (
                          <span style={{ fontWeight: 700, color: MARINE }}>
                            {ABREV[c.type] ?? c.type}
                            <small style={{ display: "block", fontSize: 9, color: GRAY, fontWeight: 400 }}>
                              {c.heures ? nf(c.heures) : "—"}
                            </small>
                          </span>
                        )}
                      </td>
                    ))}
                    <td style={{ ...td, fontWeight: 700, color: MARINE }}>{nf(total)}</td>
                    <td style={td}>{nf(l.contrat)}</td>
                    <td style={{ ...td, fontWeight: 700, color: ecart > 0.0001 ? POS : ecart < -0.0001 ? NEG : INK }}>
                      {nfs(ecart)}
                    </td>
                  </tr>
                );
              })}
              <tr>
                <td style={{ ...td, textAlign: "left", fontWeight: 700, color: MARINE, borderTop: `1.5px solid ${MARINE}`, borderBottom: 0, paddingTop: 9 }}>
                  Total salariés
                </td>
                {totalJour.map((t, i) => (
                  <td key={i} style={{ ...td, fontWeight: 700, borderTop: `1.5px solid ${MARINE}`, borderBottom: 0, paddingTop: 9 }}>
                    {nf(t)}
                  </td>
                ))}
                <td style={{ ...td, fontWeight: 700, color: MARINE, borderTop: `1.5px solid ${MARINE}`, borderBottom: 0, paddingTop: 9 }}>
                  {nf(totalGeneral)}
                </td>
                <td style={{ ...td, fontWeight: 700, borderTop: `1.5px solid ${MARINE}`, borderBottom: 0, paddingTop: 9 }}>
                  {nf(contratTotal)}
                </td>
                <td style={{
                  ...td, fontWeight: 700, borderTop: `1.5px solid ${MARINE}`, borderBottom: 0, paddingTop: 9,
                  color: totalGeneral - contratTotal > 0.0001 ? POS : totalGeneral - contratTotal < -0.0001 ? NEG : INK,
                }}>
                  {nfs(totalGeneral - contratTotal)}
                </td>
              </tr>
            </tbody>
          </table>
        )}

        <div style={{ display: "flex", flexWrap: "wrap", gap: 14, marginTop: 8, fontFamily: SANS, fontSize: 9.5, color: GRAY }}>
          <span><b style={{ color: MARINE }}>C</b> congé payé</span>
          <span><b style={{ color: MARINE }}>M</b> maladie</span>
          <span><b style={{ color: MARINE }}>F</b> jour férié</span>
          <span><b style={{ color: MARINE }}>RC</b> récupération</span>
          <span><b style={{ color: MARINE }}>R</b> repos</span>
          <span>C, M et F comptent pour l&apos;horaire théorique : aucun écart.</span>
        </div>

        {/* Dirigeant — hors décompte salarié */}
        {dirigeants.length > 0 && (
          <>
            <Section titre="Relevé du dirigeant" tag="pour information — aucun horaire dû" />
            {dirigeants.map((l, k) => (
              <div key={l.nom} className="avoid" style={{
                border: `1px dashed ${RULE}`, borderRadius: 6, padding: "9px 12px",
                display: "flex", alignItems: "baseline", justifyContent: "space-between",
                gap: 14, flexWrap: "wrap", fontFamily: SANS, marginTop: 6,
              }}>
                <div style={{ fontSize: 12, fontWeight: 600 }}>
                  {l.nom}
                  <small style={{ display: "block", fontSize: 9.5, color: GRAY, fontWeight: 400 }}>
                    Dirigeant · sans contrat horaire, hors décompte salarié
                  </small>
                </div>
                <div style={{ display: "flex", gap: 20, fontSize: 11.5, fontVariantNumeric: "tabular-nums" }}>
                  <span>
                    {jours.map((j, i) => `${j.label} ${l.cellules[i] ? nf(l.cellules[i]!.heures) : "—"}`).join(" · ")}
                  </span>
                  <span>Semaine <b style={{ color: MARINE }}>{nf(dirCumul[k]?.semaine ?? 0)} h</b></span>
                  <span>Année <b style={{ color: MARINE }}>{nf(dirCumul[k]?.annee ?? 0)} h</b></span>
                </div>
              </div>
            ))}
          </>
        )}

        {/* Compteur + congés */}
        <div className="avoid" style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 18 }}>
          <div>
            <Section titre="Compteur de rattrapage" />
            <table style={{ width: "100%", fontFamily: SANS }}>
              <tbody>
                {compteur.map((c) => (
                  <tr key={c.nom}>
                    <td style={{ textAlign: "left", fontWeight: 600, fontSize: 11.5, padding: "5px 0" }}>{c.nom}</td>
                    <td style={{
                      textAlign: "right", fontSize: 11.5, padding: "5px 0", fontWeight: 700,
                      fontVariantNumeric: "tabular-nums",
                      color: c.solde > 0.0001 ? POS : c.solde < -0.0001 ? NEG : INK,
                    }}>
                      {nfs(c.solde)} h
                    </td>
                  </tr>
                ))}
                <tr>
                  <td style={{ textAlign: "left", fontWeight: 600, fontSize: 11.5, padding: "5px 0", color: MARINE }}>
                    Solde salariés
                  </td>
                  <td style={{
                    textAlign: "right", fontSize: 11.5, padding: "5px 0", fontWeight: 700,
                    fontVariantNumeric: "tabular-nums",
                    color: soldeTotal > 0.0001 ? POS : soldeTotal < -0.0001 ? NEG : INK,
                  }}>
                    {nfs(soldeTotal)} h
                  </td>
                </tr>
              </tbody>
            </table>
          </div>
          <div>
            <Section titre={`Congés — ${CONGES_PAR_AN} j / an`} />
            <table style={{ width: "100%", fontFamily: SANS }}>
              <tbody>
                {conges.map((c) => (
                  <tr key={c.nom}>
                    <td style={{ textAlign: "left", fontWeight: 600, fontSize: 11.5, padding: "5px 0" }}>{c.nom}</td>
                    <td style={{ textAlign: "right", fontSize: 11.5, padding: "5px 0", fontVariantNumeric: "tabular-nums" }}>
                      {c.pris} pris · <b>{c.restants} j restants</b>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        {/* Signatures */}
        <Section titre="Signatures" />
        <div className="avoid" style={{ display: "grid", gridTemplateColumns: "repeat(2, 1fr)", gap: 14 }}>
          {salaries.map((l) => (
            <div key={l.nom} style={{ border: `1px solid ${RULE}`, borderRadius: 6, padding: "8px 10px 0", height: 74, boxSizing: "border-box", fontFamily: SANS }}>
              <div style={{ fontSize: 11, fontWeight: 600 }}>{l.nom}</div>
              <div style={{ fontSize: 9, color: GRAY, textTransform: "uppercase", letterSpacing: "0.08em", marginTop: 2 }}>
                Signature du salarié
              </div>
            </div>
          ))}
        </div>
        <div style={{ marginTop: 14, display: "flex", justifyContent: "flex-end" }}>
          <div style={{ width: "48%", border: `1px solid ${RULE}`, borderRadius: 6, padding: "8px 10px 0", height: 74, boxSizing: "border-box", fontFamily: SANS }}>
            <div style={{ fontSize: 11, fontWeight: 600 }}>
              {dirigeants[0]?.nom ?? "Direction"} — dirigeant
            </div>
            <div style={{ fontSize: 9, color: GRAY, textTransform: "uppercase", letterSpacing: "0.08em", marginTop: 2 }}>
              Visa · date et signature
            </div>
          </div>
        </div>

        <div style={{
          marginTop: 18, paddingTop: 8, borderTop: `1px solid ${RULE}`,
          display: "flex", justifyContent: "space-between", gap: 12,
          fontFamily: SANS, fontSize: 9.5, color: GRAY,
        }}>
          <span>Atelier Stéphan Hamache · Feuille de pointage S{numeroSemaine(lundi)}-{lundi.slice(0, 4)}</span>
          <span>Document interne</span>
        </div>
      </div>
    </>
  );
}
