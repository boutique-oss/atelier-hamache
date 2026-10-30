import { PrintButton } from "@/components/print-button";
import {
  COEF_STOCK,
  PAUSE_HEBDO,
  chargerMois,
  dernierJourMois,
  jourMois,
  moisAdjacent,
  moisValide,
  nf,
  nfs,
  nomMois,
  schemaPret,
  type JourMois,
  type LigneMois,
  type Plage,
} from "@/lib/pointage";

export const dynamic = "force-dynamic";

// ── NAVETTE de paie (format du cabinet comptable) ──────────────────────────
// Page 1 : éléments de paie, une colonne par salarié — horaire mensuel,
//          congés payés, sans solde, absences (motif), heures sup. PAYÉES
//          par semaine (rattachée au mois de son lundi), commentaires.
// Page 2 : relevé jour par jour (1er → dernier jour), détail du calcul des
//          heures sup. et mouvements du stock d'heures.
// Mêmes calculs que la page Pointage (chargerMois).

// Charte Redo (orange / marine)
const ORANGE = "#F26A21";
const MARINE = "#16324F";
const INK = "#22303C";
const GRAY = "#8A8A8A";
const RULE = "#DEDEDE";
const DOT = "rgba(22,50,79,0.16)";
const WE = "#EEF2F5";
const FERIE = "#FDEBDD";
const VERT = "#0F7B55";
const AMBRE = "#8A5A00";
const AMBRE_BG = "#FDF1D6";
const SANS = "'Rethink Sans', system-ui, sans-serif";
const SERIF = "'Hedvig Letters Serif', Georgia, serif";

const frDate = (iso: string) => `${iso.slice(8)}/${iso.slice(5, 7)}/${iso.slice(0, 4)}`;
const nh = (n: number) => nf(n).replace(/,00$/, "");
const fond = (j: JourMois) => (j.ferie ? FERIE : j.weekend ? WE : undefined);

const c: React.CSSProperties = {
  fontFamily: SANS, fontSize: 11, textAlign: "center", padding: "6px 7px",
  border: `1px solid ${RULE}`, verticalAlign: "middle",
};
const lab: React.CSSProperties = {
  ...c, textAlign: "left", fontWeight: 600, color: MARINE, background: "#FAFBFC", width: "27%",
};
const sec: React.CSSProperties = {
  ...c, textAlign: "left", background: "#F1F4F6", color: MARINE, fontSize: 9.5,
  fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.08em", padding: "5px 8px",
};
const petit: React.CSSProperties = { display: "block", fontWeight: 400, color: GRAY, fontSize: 8.5 };
const vide = <span style={{ color: "#C9CFD4" }}>—</span>;

function ListePlages({ p, avecMotif }: { p: Plage[]; avecMotif?: boolean }) {
  if (p.length === 0) return vide;
  return (
    <>
      {p.map((x, i) => (
        <div key={i} style={{ marginTop: i ? 4 : 0 }}>
          {x.du === x.au ? `le ${frDate(x.du)}` : <>du {frDate(x.du)}<br />au {frDate(x.au)}</>}
          {avecMotif && (
            <small style={petit}>
              {x.motif} · {nh(x.heures)} h
            </small>
          )}
        </div>
      ))}
    </>
  );
}

// Commentaire automatique de la navette.
function commentaire(l: LigneMois, extrasPrets: boolean): string {
  const bouts: string[] = [];
  if (l.fixe) {
    if (!l.congesPlages.length && !l.absences.length && !l.sansSolde.length) return "idem mois précédent";
    return "";
  }
  if (l.hsStockees > 0) bouts.push(`${nh(l.hsStockees)} h sup. stockées (non payées)`);
  // Retraits du stock (récups au pointage, demandes validées).
  const retraits = l.mouvements.filter((m) => m.id === null && m.heures < 0);
  if (retraits.length)
    bouts.push(`pris sur le stock : ${retraits.map((m) => `${jourMois(m.date)} (${nh(-m.heures)} h)`).join(", ")}`);
  if (extrasPrets && (l.stockFin !== 0 || l.mouvements.length)) bouts.push(`stock d'heures fin de mois : ${nh(l.stockFin)} h`);
  if (!bouts.length && !l.hsPayees && !l.congesPlages.length && !l.absences.length && !l.sansSolde.length)
    return "idem mois précédent";
  return bouts.join(" · ");
}

export default async function NavettePage({
  searchParams,
}: {
  searchParams: { mois?: string };
}) {
  const mois = moisValide(searchParams.mois);

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

  const { jours, salaries, extrasPrets } = await chargerMois(mois);
  const semaines = salaries[0]?.semaines ?? [];
  const fin = dernierJourMois(mois);
  const n = salaries.length;

  return (
    <>
      <style>{`
        @page { size: A4 portrait; margin: 9mm; }
        body { background: #E7ECF0; margin: 0; }
        .sheet {
          width: 210mm; min-height: 297mm; box-sizing: border-box;
          margin: 12px auto 30px; padding: 12mm; background: #fff; color: ${INK};
          box-shadow: 0 6px 26px rgba(16,32,48,.18);
        }
        .navbar a { text-decoration: none; }
        @media print {
          body { background: #fff; }
          .print-btn, .navbar { display: none !important; }
          .sheet { box-shadow: none !important; margin: 0 !important; width: auto !important; min-height: 0 !important; padding: 0 !important; }
          .sheet + .sheet { break-before: page; }
          tr, .avoid { break-inside: avoid; }
        }
      `}</style>

      <div className="navbar" style={{ maxWidth: "210mm", margin: "0 auto", padding: "14px 6mm 0", display: "flex", flexWrap: "wrap", alignItems: "center", gap: 8, fontFamily: SANS, fontSize: 13 }}>
        <a href={`/documents/feuille-heures-mois?mois=${moisAdjacent(mois, -1)}`} style={{ border: `1px solid ${RULE}`, borderRadius: 6, padding: "5px 10px", color: INK }}>← Mois précédent</a>
        <a href={`/documents/feuille-heures-mois?mois=${moisAdjacent(mois, 1)}`} style={{ border: `1px solid ${RULE}`, borderRadius: 6, padding: "5px 10px", color: INK }}>Mois suivant →</a>
        <a href="/documents/feuille-heures-mois" style={{ color: GRAY }}>Mois en cours</a>
        <span style={{ marginLeft: "auto" }} className="print-btn"><PrintButton /></span>
      </div>

      {/* ═════════ PAGE 1 — NAVETTE ═════════ */}
      <div className="sheet">
        <Entete mois={mois} titre="Éléments de paie du mois de" />

        {n === 0 ? (
          <p style={{ fontFamily: SANS, fontSize: 12, color: GRAY }}>Aucun salarié actif.</p>
        ) : (
          <table style={{ borderCollapse: "collapse", width: "100%", fontVariantNumeric: "tabular-nums" }}>
            <thead>
              <tr>
                <th style={{ ...c, border: 0, borderBottom: `1px solid ${RULE}`, borderRight: `1px solid ${RULE}` }} />
                {salaries.map((l) => (
                  <th key={l.nom} style={{ ...c, background: MARINE, color: "#fff", fontSize: 12 }}>{l.nom}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              <tr>
                <th style={lab}>Horaire mensuel</th>
                {salaries.map((l) => (
                  <td key={l.nom} style={c}>
                    {nf(l.horaireMensuel)} h
                    <small style={petit}>{l.fixe ? "horaire fixe" : `${nh(l.contrat)} h / semaine`}</small>
                  </td>
                ))}
              </tr>
              <tr>
                <th style={lab}>Heures réalisées du mois<small style={petit}>du 1er au {Number(fin.slice(8))}, pour information</small></th>
                {salaries.map((l) => <td key={l.nom} style={{ ...c, fontWeight: 700 }}>{nh(l.total)} h</td>)}
              </tr>

              <tr><th colSpan={n + 1} style={sec}>Congés payés <span style={{ textTransform: "none", letterSpacing: 0, fontWeight: 400, color: GRAY }}>(dates)</span></th></tr>
              <tr>
                <th style={lab}>du … au …</th>
                {salaries.map((l) => <td key={l.nom} style={c}><ListePlages p={l.congesPlages} /></td>)}
              </tr>

              <tr><th colSpan={n + 1} style={sec}>Congés sans solde <span style={{ textTransform: "none", letterSpacing: 0, fontWeight: 400, color: GRAY }}>(dates)</span></th></tr>
              <tr>
                <th style={lab}>du … au …</th>
                {salaries.map((l) => <td key={l.nom} style={c}><ListePlages p={l.sansSolde} /></td>)}
              </tr>

              <tr><th colSpan={n + 1} style={sec}>Absences <span style={{ textTransform: "none", letterSpacing: 0, fontWeight: 400, color: GRAY }}>(dates + motif)</span></th></tr>
              <tr>
                <th style={lab}>du … au … · motif</th>
                {salaries.map((l) => <td key={l.nom} style={c}><ListePlages p={l.absences} avecMotif /></td>)}
              </tr>

              <tr><th colSpan={n + 1} style={sec}>Heures supplémentaires <span style={{ textTransform: "none", letterSpacing: 0, fontWeight: 400, color: GRAY }}>(payées, par semaine)</span></th></tr>
              {semaines.map((s, i) => (
                <tr key={s.lundi}>
                  <th style={{ ...lab, ...(s.enCours ? { background: AMBRE_BG } : {}) }}>
                    Semaine n°{s.num}
                    <small style={petit}>{jourMois(s.lundi)} → {jourMois(s.dimanche)}</small>
                    {s.enCours && (
                      <small style={{ ...petit, color: AMBRE, fontWeight: 700 }}>
                        en cours jusqu&apos;au {jourMois(s.dimanche)} — provisoire
                      </small>
                    )}
                  </th>
                  {salaries.map((l) => {
                    if (l.fixe)
                      return i === 0 ? (
                        <td key={l.nom} rowSpan={semaines.length} style={{ ...c, color: GRAY, fontSize: 10 }}>horaire fixe</td>
                      ) : null;
                    const x = l.semaines[i];
                    if (x.enCours)
                      return (
                        <td key={l.nom} style={{ ...c, background: AMBRE_BG, color: AMBRE }}>
                          {x.hs > 0 ? `${nh(x.hs)} h` : "—"}
                          <small style={{ ...petit, color: AMBRE }}>{x.hs > 0 ? "provisoire" : "en cours"}</small>
                        </td>
                      );
                    if (x.hs > 0 && x.mode === "stocker")
                      return (
                        <td key={l.nom} style={c}>
                          0<small style={{ ...petit, color: VERT }}>{nh(x.hs)} h stockées</small>
                        </td>
                      );
                    return (
                      <td key={l.nom} style={{ ...c, ...(x.hs > 0 ? { color: ORANGE, fontWeight: 700 } : { color: GRAY }) }}>
                        {x.hs > 0 ? `${nh(x.hs)} h` : "0"}
                      </td>
                    );
                  })}
                </tr>
              ))}
              <tr>
                <th style={{ ...lab, borderTop: `2px solid ${MARINE}`, background: "#FFF6EE" }}>Total heures sup. payées</th>
                {salaries.map((l) => (
                  <td key={l.nom} style={{ ...c, borderTop: `2px solid ${MARINE}`, background: "#FFF6EE", fontWeight: 700, fontSize: 13, color: MARINE }}>
                    {l.fixe ? "—" : `${nh(l.hsPayees)} h`}
                    {!l.fixe && l.semaines.some((x) => x.enCours) && (
                      <small style={{ ...petit, color: AMBRE, fontWeight: 400 }}>provisoire</small>
                    )}
                  </td>
                ))}
              </tr>

              <tr>
                <th style={lab}>Commentaires</th>
                {salaries.map((l) => (
                  <td key={l.nom} style={{ ...c, height: 40, textAlign: "left", fontSize: 10 }}>{commentaire(l, extrasPrets)}</td>
                ))}
              </tr>
            </tbody>
          </table>
        )}

        {semaines.some((s) => s.enCours) && (
          <p style={{ fontFamily: SANS, fontSize: 10.5, color: AMBRE, background: AMBRE_BG, borderRadius: 6, padding: "6px 10px", marginTop: 8 }}>
            ⏳ Navette provisoire : la semaine n°{semaines[semaines.length - 1].num} n&apos;est pas terminée
            (jusqu&apos;au {jourMois(semaines[semaines.length - 1].dimanche)}). Réimprimer après cette date.
          </p>
        )}
        <p style={{ fontFamily: SANS, fontSize: 9.5, color: GRAY, marginTop: 8, lineHeight: 1.5 }}>
          Heures sup. = heures faites dans la semaine + h/jour du contrat par jour férié ou de congé
          − {nh(PAUSE_HEBDO)} h de pause café − horaire hebdomadaire du contrat. Une semaine est
          déclarée dans le mois de son lundi. Détail du calcul et relevé jour par jour en page 2.
        </p>

        <div className="avoid" style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12, marginTop: 14 }}>
          <Signature titre="Date :" sous={`le ${frDate(fin)}`} />
          <Signature titre="Signature du responsable" sous="Stéphan Hamache" />
        </div>
        <Pied mois={mois} page="page 1/2" droite="Si rien n'a changé : « idem mois précédent »" />
      </div>

      {/* ═════════ PAGE 2 — ANNEXES ═════════ */}
      {n > 0 && (
        <div className="sheet">
          <Entete mois={mois} titre="Annexe — navette du mois de" />

          <Titre>Relevé jour par jour</Titre>
          <table style={{ borderCollapse: "collapse", width: "100%", fontVariantNumeric: "tabular-nums" }}>
            <thead>
              <tr>
                <th rowSpan={2} style={{ ...g, textAlign: "left", padding: "3px 6px", color: MARINE, background: "#FAFBFC", fontSize: 9.5 }}>Salarié</th>
                {jours.map((j) => (
                  <th key={j.date} style={{ ...g, fontWeight: 400, color: GRAY, background: fond(j) ?? "#FAFBFC" }}>{j.lettre}</th>
                ))}
                <th rowSpan={2} style={{ ...g, background: MARINE, color: "#fff", fontWeight: 700, minWidth: 32 }}>Total</th>
              </tr>
              <tr>
                {jours.map((j) => (
                  <th key={j.date} title={j.ferie ?? undefined} style={{ ...g, fontWeight: 700, color: MARINE, background: fond(j) ?? "#FAFBFC" }}>{j.num}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {salaries.map((l) => (
                <tr key={l.nom}>
                  <td style={{ ...g, textAlign: "left", padding: "3px 6px", fontWeight: 700, color: MARINE, whiteSpace: "nowrap", fontSize: 9.5 }}>{l.nom}</td>
                  {jours.map((j, i) => {
                    const x = l.cellules[i];
                    const bg = fond(j);
                    if (x && (x.type === "Travail" || x.type === "Absence") && x.heures > 0) {
                      const majore = j.weekend || !!j.ferie;
                      return (
                        <td key={j.date} style={{ ...g, background: bg, ...(majore ? { outline: `2px solid ${ORANGE}`, outlineOffset: -2, fontWeight: 700 } : {}) }}>
                          {nh(x.heures)}
                          {x.type === "Absence" && <b style={{ color: "#5B3B9A" }}>A</b>}
                        </td>
                      );
                    }
                    const lettre = x
                      ? ({ Congé: "CP", Férié: "F", Récup: "RC", Repos: "R", Absence: "A" } as Record<string, string>)[x.type] ?? ""
                      : j.ferie && !j.weekend ? "F" : "";
                    return (
                      <td key={j.date} style={{ ...g, background: bg, fontWeight: 700, color: lettre === "A" ? "#5B3B9A" : MARINE }}>{lettre}</td>
                    );
                  })}
                  <td style={{ ...g, background: MARINE, color: "#fff", fontWeight: 700 }}>{nh(l.total)}</td>
                </tr>
              ))}
            </tbody>
          </table>
          <Legende>
            <span><b style={{ color: MARINE }}>CP</b> congé payé</span>
            <span><b style={{ color: MARINE }}>F</b> férié chômé</span>
            <span><b style={{ color: MARINE }}>RC</b> récup (sur stock)</span>
            <span><b style={{ color: MARINE }}>R</b> repos</span>
            <span><b style={{ color: "#5B3B9A" }}>A</b> absence (motif en page 1)</span>
            <span>heures encadrées = samedi, dimanche ou férié</span>
          </Legende>

          <Titre>Détail du calcul des heures sup. par semaine</Titre>
          <table style={{ borderCollapse: "collapse", width: "100%", fontVariantNumeric: "tabular-nums" }}>
            <thead>
              <tr>
                {["Salarié", "Semaine", "Heures faites", "+ Férié / congé", "Pause café", "Heures retenues", "Contrat", "Heures sup.", "Choix"].map((h, i) => (
                  <th key={h} style={{ ...th, textAlign: i === 0 ? "left" : "center" }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {salaries.filter((l) => !l.fixe).flatMap((l) =>
                l.semaines.map((s, i) => (
                  <tr key={`${l.nom}-${s.lundi}`}>
                    <td style={{ ...td, textAlign: "left", fontWeight: 700, color: MARINE }}>{i === 0 ? l.nom : ""}</td>
                    <td style={td}>
                      S{s.num} <small style={{ color: GRAY }}>{jourMois(s.lundi)}→{jourMois(s.dimanche)}</small>
                      {s.enCours && <small style={{ color: AMBRE, fontWeight: 700 }}> · en cours</small>}
                    </td>
                    <td style={td}>{nh(s.fait)}</td>
                    <td style={td}>{s.assim ? `+${nh(s.assim)}` : "—"}</td>
                    <td style={td}>−{nh(PAUSE_HEBDO)}</td>
                    <td style={td}>{nh(s.retenu)}</td>
                    <td style={td}>−{nh(l.contrat)}</td>
                    <td style={{ ...td, ...(s.hs > 0 ? { background: ORANGE, color: "#fff", fontWeight: 700 } : {}) }}>{nh(s.hs)}</td>
                    <td style={{ ...td, color: s.hs > 0 ? (s.mode === "stocker" ? VERT : MARINE) : GRAY }}>{s.hs > 0 ? (s.mode === "stocker" ? "stockée" : "payée") : "—"}</td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
          {salaries.some((l) => l.fixe) && (
            <p style={{ fontFamily: SANS, fontSize: 9.5, color: GRAY, margin: "6px 0 0" }}>
              Horaire fixe, exclu du calcul des heures sup. : {salaries.filter((l) => l.fixe).map((l) => l.nom).join(", ")}.
            </p>
          )}

          {extrasPrets && salaries.some((l) => !l.fixe && (l.stockDebut !== 0 || l.mouvements.length)) && (
            <>
              <Titre>Stock d&apos;heures — mouvements du mois</Titre>
              <table style={{ borderCollapse: "collapse", width: "100%", fontVariantNumeric: "tabular-nums" }}>
                <thead>
                  <tr>
                    {["Salarié", "Date", "Mouvement", "Heures", "Solde"].map((h, i) => (
                      <th key={h} style={{ ...th, textAlign: i === 0 || i === 2 ? "left" : "center" }}>{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {salaries
                    .filter((l) => !l.fixe && (l.stockDebut !== 0 || l.mouvements.length))
                    .flatMap((l) => {
                      let solde = l.stockDebut;
                      return [
                        <tr key={`${l.nom}-debut`}>
                          <td style={{ ...td, textAlign: "left", fontWeight: 700, color: MARINE }}>{l.nom}</td>
                          <td style={td}>01/{mois.slice(5, 7)}</td>
                          <td style={{ ...td, textAlign: "left" }}>Report du mois précédent</td>
                          <td style={td} />
                          <td style={td}>{nh(solde)} h</td>
                        </tr>,
                        ...l.mouvements.map((m, i) => {
                          solde += m.heures;
                          return (
                            <tr key={`${l.nom}-${i}`}>
                              <td style={td} />
                              <td style={td}>{jourMois(m.date)}</td>
                              <td style={{ ...td, textAlign: "left" }}>{m.libelle}</td>
                              <td style={{ ...td, fontWeight: 700, color: m.heures < 0 ? "#B3261E" : VERT }}>{nfs(m.heures)}</td>
                              <td style={td}>{nh(Math.round(solde * 100) / 100)} h</td>
                            </tr>
                          );
                        }),
                      ];
                    })}
                  <tr>
                    <td colSpan={3} style={{ ...td, textAlign: "left", fontWeight: 700, color: MARINE, borderTop: `2px solid ${MARINE}`, borderBottom: 0 }}>
                      Stock total de l&apos;atelier au {frDate(fin)}
                    </td>
                    <td style={{ ...td, borderTop: `2px solid ${MARINE}`, borderBottom: 0 }} />
                    <td style={{ ...td, fontWeight: 700, color: MARINE, borderTop: `2px solid ${MARINE}`, borderBottom: 0 }}>
                      {nh(salaries.filter((l) => !l.fixe).reduce((s, l) => s + l.stockFin, 0))} h
                    </td>
                  </tr>
                </tbody>
              </table>
              <p style={{ fontFamily: SANS, fontSize: 9.5, color: GRAY, margin: "6px 0 0" }}>
                1 h sup. stockée = {nf(COEF_STOCK)} h de repos · une récup retire une journée (h/jour du contrat).
              </p>
            </>
          )}

          <Pied mois={mois} page="page 2/2" droite="Document interne" />
        </div>
      )}
    </>
  );
}

const g: React.CSSProperties = {
  fontFamily: SANS, fontSize: 8.5, textAlign: "center", padding: "3px 0",
  border: `1px solid ${RULE}`, minWidth: 14,
};
const th: React.CSSProperties = {
  fontFamily: SANS, fontSize: 8.5, fontWeight: 700, textTransform: "uppercase",
  letterSpacing: "0.06em", color: GRAY, padding: "6px 5px", borderBottom: `2px solid ${MARINE}`,
};
const td: React.CSSProperties = {
  fontFamily: SANS, fontSize: 10.5, padding: "4px 5px", textAlign: "center",
  borderBottom: `1px dotted ${DOT}`,
};

function Entete({ mois, titre }: { mois: string; titre: string }) {
  return (
    <>
      <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", gap: 16 }}>
        <div>
          <div style={{ fontFamily: SERIF, fontSize: 19, color: MARINE, lineHeight: 1.15 }}>M. Hamache Stéphan</div>
          <div style={{ fontFamily: SANS, fontSize: 9.5, color: GRAY, letterSpacing: "0.06em", textTransform: "uppercase", marginTop: 3 }}>
            Atelier Stéphan Hamache · Poitiers
          </div>
        </div>
        <div style={{ textAlign: "right" }}>
          <div style={{ fontFamily: SANS, fontSize: 10, fontWeight: 700, letterSpacing: "0.13em", textTransform: "uppercase", color: ORANGE }}>{titre}</div>
          <div style={{ fontFamily: SERIF, fontSize: 18, color: MARINE, textTransform: "capitalize" }}>{nomMois(mois)}</div>
        </div>
      </div>
      <div style={{ height: 2.5, background: MARINE, marginTop: 8 }} />
      <div style={{ height: 2.5, background: ORANGE, width: 76, marginTop: -2.5, marginBottom: 14 }} />
    </>
  );
}

function Titre({ children }: { children: React.ReactNode }) {
  return (
    <h2 style={{ fontFamily: SANS, fontSize: 10, fontWeight: 700, letterSpacing: "0.12em", textTransform: "uppercase", color: GRAY, margin: "16px 0 6px", display: "flex", alignItems: "center", gap: 9 }}>
      {children}
      <span style={{ flex: 1, height: 1, background: RULE }} />
    </h2>
  );
}

function Legende({ children }: { children: React.ReactNode }) {
  return (
    <div style={{ display: "flex", flexWrap: "wrap", gap: 12, marginTop: 5, fontFamily: SANS, fontSize: 9, color: GRAY }}>
      {children}
    </div>
  );
}

function Signature({ titre, sous }: { titre: string; sous: string }) {
  return (
    <div style={{ border: `1px solid ${RULE}`, borderRadius: 6, height: 58, padding: "7px 10px", boxSizing: "border-box", fontFamily: SANS, fontSize: 11, fontWeight: 600 }}>
      {titre}
      <small style={{ display: "block", fontSize: 8.5, color: GRAY, textTransform: "uppercase", letterSpacing: "0.08em", fontWeight: 400 }}>{sous}</small>
    </div>
  );
}

function Pied({ mois, page, droite }: { mois: string; page: string; droite: string }) {
  return (
    <div style={{ marginTop: 12, paddingTop: 6, borderTop: `1px solid ${RULE}`, display: "flex", justifyContent: "space-between", gap: 12, fontFamily: SANS, fontSize: 9, color: GRAY }}>
      <span style={{ textTransform: "capitalize" }}>Navette · {nomMois(mois)} · {page}</span>
      <span>{droite}</span>
    </div>
  );
}
