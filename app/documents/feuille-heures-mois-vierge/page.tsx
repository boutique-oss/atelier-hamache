import { PrintButton } from "@/components/print-button";

export const dynamic = "force-dynamic";

// ── Feuille d'heures MENSUELLE VIERGE — un mois = 4 semaines sur une page ──
// À imprimer et remplir à la main. Aucun préremplissage : les dates « du…au… »
// se notent au stylo, la feuille est donc valable pour n'importe quel mois.

export default function FeuilleHeuresMoisViergePage() {
  const semaines = [1, 2, 3, 4];

  return (
    <>
      <style>{`
        .fh { --orange:#F26A21; --marine:#16324F; --ink:#22303C; --gray:#8A8A8A;
          --rule:#C9D2DA; --rule-soft:#E4E9ED; --write:#B7C1CA; --we:#F1F4F6;
          --sans:'Rethink Sans',system-ui,-apple-system,'Segoe UI',Roboto,sans-serif;
          --serif:'Hedvig Letters Serif',Georgia,'Times New Roman',serif; }
        body { background:#E7ECF0; margin:0; }
        .fh .sheet { width:210mm; min-height:297mm; box-sizing:border-box;
          margin:14px auto 40px; padding:15mm 14mm; background:#fff; color:var(--ink);
          font-family:var(--sans); box-shadow:0 6px 26px rgba(16,32,48,.18); }

        .fh .head { display:flex; align-items:flex-start; justify-content:space-between; gap:16px; }
        .fh .name { font-family:var(--serif); font-size:20px; color:var(--marine); line-height:1.15; }
        .fh .act { font-size:10px; color:var(--gray); letter-spacing:.06em; text-transform:uppercase; margin-top:3px; }
        .fh .doc { text-align:right; }
        .fh .kind { font-size:10px; font-weight:700; letter-spacing:.13em; text-transform:uppercase; color:var(--orange); }
        .fh .per { font-family:var(--serif); font-size:16px; color:var(--marine); margin-top:2px; }
        .fh .rule-top { height:2.5px; background:var(--marine); margin:10px 0 0; }
        .fh .rule-orange { height:2.5px; background:var(--orange); width:80px; margin-top:-2.5px; }

        .fh .ident { display:grid; grid-template-columns:2fr 1fr 1fr; gap:10px 26px; margin:20px 0 4px; }
        .fh .fld { display:flex; align-items:baseline; gap:8px; }
        .fh .fld .lab { font-size:10px; font-weight:700; letter-spacing:.08em; text-transform:uppercase; color:var(--gray); white-space:nowrap; }
        .fh .fld .line { flex:1; border-bottom:1.5px solid var(--write); height:18px; }

        .fh table { width:100%; border-collapse:collapse; margin-top:24px; border:1.5px solid var(--marine); }
        .fh th { font-size:10px; font-weight:700; letter-spacing:.06em; text-transform:uppercase; color:var(--gray);
          text-align:center; padding:7px 4px 8px; border-bottom:2px solid var(--marine); border-right:1px solid var(--rule-soft); }
        .fh th.sem { text-align:left; padding-left:12px; width:128px; }
        .fh th.tot { color:var(--marine); border-right:0; }
        .fh th.wend { color:#9aa6b0; }
        .fh td { border-bottom:1px solid var(--rule); border-right:1px solid var(--rule-soft); height:54px; }
        .fh tbody tr:last-child td { border-bottom:0; }
        .fh td.sem { padding:0 12px; vertical-align:middle; border-right:1.5px solid var(--rule); background:#FAFBFC; }
        .fh td.sem .n { font-family:var(--serif); font-size:15px; color:var(--marine); }
        .fh td.sem .du { display:flex; align-items:baseline; gap:5px; margin-top:5px; font-size:9px; color:var(--gray); }
        .fh td.sem .du .l { border-bottom:1.2px solid var(--write); flex:1; height:13px; }
        .fh td.wend { background:var(--we); }
        .fh td.tot { border-right:0; background:#FAFBFC; }

        .fh tfoot td { height:34px; border-bottom:0; border-right:1px solid var(--rule-soft);
          border-top:2px solid var(--marine); font-size:11px; font-weight:700; color:var(--marine);
          text-transform:uppercase; letter-spacing:.05em; }
        .fh tfoot td.lbl { text-align:right; padding-right:10px; }
        .fh tfoot td.tot { border-right:0; }

        .fh .legend { display:flex; flex-wrap:wrap; gap:6px 18px; margin-top:12px; font-size:10px; color:var(--gray); }
        .fh .legend b { color:var(--marine); display:inline-block; min-width:16px; border:1px solid var(--rule);
          border-radius:4px; text-align:center; padding:0 3px; margin-right:4px; }

        .fh .sigs { display:grid; grid-template-columns:1fr 1fr; gap:18px; margin-top:34px; }
        .fh .sig { border:1px solid var(--rule); border-radius:6px; padding:9px 12px 0; height:84px; box-sizing:border-box; }
        .fh .sig .n { font-size:11px; font-weight:600; color:var(--ink); }
        .fh .sig .l { font-size:9px; color:var(--gray); text-transform:uppercase; letter-spacing:.08em; margin-top:2px; }

        .fh .foot { margin-top:22px; padding-top:8px; border-top:1px solid var(--rule-soft); text-align:center; font-size:9.5px; color:var(--gray); }

        /* Bloc « Demande de congés » (bas de feuille) */
        .fh .leave { margin-top:26px; border:1.5px solid var(--marine); border-radius:6px; overflow:hidden; }
        .fh .leave-hd { display:flex; align-items:baseline; justify-content:space-between; gap:10px;
          background:#FAFBFC; border-bottom:1.5px solid var(--marine); padding:8px 12px; }
        .fh .leave-hd .t { font-size:11px; font-weight:700; letter-spacing:.13em; text-transform:uppercase; color:var(--orange); }
        .fh .leave-hd .sub { font-size:9px; color:var(--gray); }
        .fh .leave-note { display:flex; gap:8px; align-items:flex-start; padding:8px 12px; border-bottom:1px solid var(--rule-soft);
          background:#FFF7F2; font-size:10px; color:var(--marine); }
        .fh .leave-note b { color:var(--orange); }
        .fh .leave-body { padding:12px; }
        .fh .leave-row { display:grid; grid-template-columns:1.6fr 1.6fr .8fr 1.6fr; gap:10px 22px; }
        .fh .leave-sigs { display:grid; grid-template-columns:1fr 1fr; gap:18px; margin-top:16px; }
        .fh .leave-sig { border:1px solid var(--rule); border-radius:6px; padding:9px 12px 0; height:76px; box-sizing:border-box; }
        .fh .leave-sig .n { font-size:11px; font-weight:600; color:var(--ink); }
        .fh .leave-sig .l { font-size:9px; color:var(--gray); text-transform:uppercase; letter-spacing:.08em; margin-top:2px; }
        .fh .leave-sig .opt { font-size:10px; color:var(--marine); margin-top:6px; }
        .fh .leave-sig .box { display:inline-block; width:11px; height:11px; border:1.2px solid var(--marine); border-radius:2px;
          vertical-align:-1px; margin:0 4px 0 10px; }

        @page { size:A4 portrait; margin:11mm; }
        @media print {
          body { background:#fff; }
          .print-btn { display:none !important; }
          .fh .sheet { box-shadow:none !important; margin:0 !important; width:auto !important; min-height:0 !important; padding:0 !important; }
          .fh tr, .fh .sig, .fh .leave { break-inside:avoid; }
        }
      `}</style>

      <div className="print-btn" style={{ maxWidth: "210mm", margin: "0 auto", padding: "14px 6mm 0" }}>
        <PrintButton />
      </div>

      <div className="fh">
        <div className="sheet">
          <div className="head">
            <div>
              <div className="name">Atelier Stéphan Hamache</div>
              <div className="act">Tapisserie d&apos;ameublement · Poitiers</div>
            </div>
            <div className="doc">
              <div className="kind">Feuille d&apos;heures</div>
              <div className="per">Relevé du mois</div>
            </div>
          </div>
          <div className="rule-top" />
          <div className="rule-orange" />

          <div className="ident">
            <div className="fld"><span className="lab">Salarié</span><span className="line" /></div>
            <div className="fld"><span className="lab">Mois</span><span className="line" /></div>
            <div className="fld"><span className="lab">Année</span><span className="line" /></div>
          </div>

          <table>
            <thead>
              <tr>
                <th className="sem">Semaine</th>
                <th>Lun</th><th>Mar</th><th>Mer</th><th>Jeu</th><th>Ven</th>
                <th className="tot">Total h. sup</th>
                <th className="tot">Total heures</th>
              </tr>
            </thead>
            <tbody>
              {semaines.map((n) => (
                <tr key={n}>
                  <td className="sem">
                    <span className="n">Semaine {n}</span>
                    <span className="du">du <span className="l" /> au <span className="l" /></span>
                  </td>
                  <td /><td /><td /><td /><td />
                  <td className="tot" /><td className="tot" />
                </tr>
              ))}
            </tbody>
            <tfoot>
              <tr>
                <td className="lbl" colSpan={6}>Total du mois</td>
                <td className="tot" /><td className="tot" />
              </tr>
            </tfoot>
          </table>

          <div className="legend">
            <span>Codes :</span>
            <span><b>C</b>congé</span>
            <span><b>M</b>maladie</span>
            <span><b>F</b>férié</span>
            <span><b>RC</b>récup</span>
            <span><b>R</b>repos</span>
          </div>

          <div className="sigs">
            <div className="sig"><div className="n">Signature du salarié</div><div className="l">Date</div></div>
            <div className="sig"><div className="n">Visa — Stéphan Hamache</div><div className="l">Date et signature</div></div>
          </div>

          {/* ── Demande de congés (à remplir à la main) ── */}
          <div className="leave">
            <div className="leave-hd">
              <span className="t">Demande de congés</span>
              <span className="sub">Salarié : … · Année : …</span>
            </div>
            <div className="leave-note">
              <span>⚠</span>
              <span>
                À remettre <b>au moins deux semaines avant</b> le premier jour de
                congé souhaité. La demande n&apos;est valable que <b>datée et signée</b>,
                et après accord de la direction.
              </span>
            </div>
            <div className="leave-body">
              <div className="leave-row">
                <div className="fld"><span className="lab">Du</span><span className="line" /></div>
                <div className="fld"><span className="lab">Au</span><span className="line" /></div>
                <div className="fld"><span className="lab">Nb jours</span><span className="line" /></div>
                <div className="fld"><span className="lab">Motif</span><span className="line" /></div>
              </div>
              <div className="leave-sigs">
                <div className="leave-sig">
                  <div className="n">Demande — signature du salarié</div>
                  <div className="l">Fait le … à …</div>
                </div>
                <div className="leave-sig">
                  <div className="n">Décision de la direction</div>
                  <div className="opt">
                    <span className="box" />Accordé
                    <span className="box" />Refusé
                  </div>
                  <div className="l">Date et signature</div>
                </div>
              </div>
            </div>
          </div>

          <div className="foot">Atelier Stéphan Hamache · feuille d&apos;heures mensuelle · document interne</div>
        </div>
      </div>
    </>
  );
}
