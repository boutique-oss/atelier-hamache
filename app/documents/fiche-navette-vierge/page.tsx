import { PrintButton } from "@/components/print-button";
import { semaineIsoDe } from "@/lib/fiches-navettes";

export const dynamic = "force-dynamic";

// ── Fiche navette VIERGE — une semaine, un salarié, lundi → samedi ──
// À imprimer, remplir au stylo, puis photographier depuis /pointages/scan.
// Noir et blanc, grandes cases. ?operateur=…&lundi=AAAA-MM-JJ pré-remplit
// l'en-tête (sinon tout se note à la main).

const JOURS = ["Lundi", "Mardi", "Mercredi", "Jeudi", "Vendredi", "Samedi"];

export default function FicheNavetteViergePage({
  searchParams,
}: {
  searchParams: { operateur?: string; lundi?: string };
}) {
  const operateur = (searchParams.operateur || "").slice(0, 60);
  const lundi = /^\d{4}-\d{2}-\d{2}$/.test(searchParams.lundi || "") ? (searchParams.lundi as string) : "";
  const semaine = lundi ? semaineIsoDe(lundi).slice(6) : "";
  const date = (i: number) => {
    if (!lundi) return "";
    const [y, m, j] = lundi.split("-").map(Number);
    const d = new Date(Date.UTC(y, m - 1, j + i));
    return `${String(d.getUTCDate()).padStart(2, "0")}/${String(d.getUTCMonth() + 1).padStart(2, "0")}`;
  };

  return (
    <>
      <style>{`
        .fn { --ink:#111; --gray:#555; --rule:#999; --soft:#ccc;
          --sans:'Rethink Sans',system-ui,-apple-system,'Segoe UI',Roboto,sans-serif;
          --serif:'Hedvig Letters Serif',Georgia,'Times New Roman',serif; }
        body { background:#E7ECF0; margin:0; }
        .fn .sheet { width:210mm; min-height:297mm; box-sizing:border-box; margin:14px auto 40px;
          padding:14mm 13mm; background:#fff; color:var(--ink); font-family:var(--sans);
          box-shadow:0 6px 26px rgba(16,32,48,.18); }
        .fn .head { display:flex; justify-content:space-between; align-items:flex-start; gap:16px;
          border-bottom:2.5px solid var(--ink); padding-bottom:8px; }
        .fn .name { font-family:var(--serif); font-size:19px; }
        .fn .act { font-size:10px; color:var(--gray); letter-spacing:.06em; text-transform:uppercase; margin-top:3px; }
        .fn .kind { font-size:22px; font-weight:800; letter-spacing:.04em; text-transform:uppercase; text-align:right; }
        .fn .sub { font-size:11px; color:var(--gray); text-align:right; margin-top:2px; }

        .fn .ident { display:grid; grid-template-columns:2.2fr 1fr 1.4fr; gap:12px 24px; margin:18px 0 4px; }
        .fn .fld { display:flex; align-items:baseline; gap:8px; }
        .fn .lab { font-size:11px; font-weight:800; letter-spacing:.06em; text-transform:uppercase; white-space:nowrap; }
        .fn .val { flex:1; border-bottom:1.5px solid var(--ink); min-height:24px; font-size:18px; font-weight:600; padding-left:4px; }

        .fn table { width:100%; border-collapse:collapse; margin-top:20px; border:2px solid var(--ink); }
        .fn th { font-size:10.5px; font-weight:800; letter-spacing:.04em; text-transform:uppercase; text-align:center;
          padding:7px 4px; border:1px solid var(--rule); border-bottom:2px solid var(--ink); }
        .fn th small { display:block; font-weight:500; text-transform:none; letter-spacing:0; color:var(--gray); }
        .fn td { border:1px solid var(--rule); height:58px; }
        .fn td.jour { width:92px; padding:0 10px; font-size:15px; font-weight:700; }
        .fn td.jour .d { display:block; font-size:11px; font-weight:500; color:var(--gray); margin-top:2px; min-height:13px; }
        .fn td.tot, .fn th.tot { border-left:2px solid var(--ink); background:#f3f3f3; }
        .fn tfoot td { height:44px; border-top:2px solid var(--ink); font-size:12px; font-weight:800; text-transform:uppercase; }
        .fn tfoot td.lbl { text-align:right; padding-right:12px; }

        .fn .codes { margin-top:12px; font-size:11.5px; display:flex; flex-wrap:wrap; gap:6px 18px; }
        .fn .codes b { display:inline-block; min-width:20px; border:1.2px solid var(--ink); border-radius:3px;
          text-align:center; padding:0 3px; margin-right:4px; }
        .fn .consigne { margin-top:14px; border:1.5px dashed var(--rule); border-radius:6px; padding:9px 12px; font-size:11.5px; line-height:1.45; }

        .fn .sigs { display:grid; grid-template-columns:1fr 1fr; gap:18px; margin-top:26px; }
        .fn .sig { border:1.2px solid var(--rule); border-radius:6px; padding:9px 12px 0; height:86px; box-sizing:border-box; }
        .fn .sig .n { font-size:12px; font-weight:700; }
        .fn .sig .l { font-size:10px; color:var(--gray); text-transform:uppercase; letter-spacing:.06em; margin-top:2px; }

        @page { size:A4 portrait; margin:11mm; }
        @media print {
          body { background:#fff; }
          .print-btn { display:none !important; }
          .fn .sheet { box-shadow:none !important; margin:0 !important; width:auto !important; min-height:0 !important; padding:0 !important; }
          .fn tr, .fn .sig { break-inside:avoid; }
        }
      `}</style>

      <div className="print-btn" style={{ maxWidth: "210mm", margin: "0 auto", padding: "14px 6mm 0" }}>
        <PrintButton label="Imprimer" />
      </div>

      <div className="fn">
        <div className="sheet">
          <div className="head">
            <div>
              <div className="name">Atelier Stéphan Hamache</div>
              <div className="act">Tapisserie d&apos;ameublement · Poitiers</div>
            </div>
            <div>
              <div className="kind">Fiche navette</div>
              <div className="sub">Pointage de présence de la semaine</div>
            </div>
          </div>

          <div className="ident">
            <div className="fld"><span className="lab">Nom</span><span className="val">{operateur}</span></div>
            <div className="fld"><span className="lab">Semaine n°</span><span className="val">{semaine}</span></div>
            <div className="fld"><span className="lab">Du</span><span className="val">{lundi ? `${date(0)}/${lundi.slice(0, 4)}` : ""}</span></div>
          </div>

          <table>
            <thead>
              <tr>
                <th>Jour</th>
                <th>Arrivée<small>matin</small></th>
                <th>Départ<small>midi</small></th>
                <th>Arrivée<small>après-midi</small></th>
                <th>Départ<small>soir</small></th>
                <th>Absence<small>code</small></th>
                <th className="tot">Total<small>heures du jour</small></th>
              </tr>
            </thead>
            <tbody>
              {JOURS.map((j, i) => (
                <tr key={j}>
                  <td className="jour">
                    {j}
                    <span className="d">{date(i)}</span>
                  </td>
                  <td /><td /><td /><td /><td />
                  <td className="tot" />
                </tr>
              ))}
            </tbody>
            <tfoot>
              <tr>
                <td className="lbl" colSpan={6}>Total de la semaine</td>
                <td className="tot" />
              </tr>
            </tfoot>
          </table>

          <div className="codes">
            <span>Codes absence :</span>
            <span><b>C</b>congé</span>
            <span><b>M</b>maladie</span>
            <span><b>F</b>férié</span>
            <span><b>RC</b>récup</span>
            <span><b>R</b>repos</span>
          </div>

          <div className="consigne">
            En fin de semaine, photographiez cette fiche avec le téléphone de l&apos;atelier :
            page <b>Envoyer ma fiche navette</b> (adresse <b>/pointages/scan</b>).
            Écrivez lisiblement les heures en chiffres, par exemple <b>7,5</b>.
          </div>

          <div className="sigs">
            <div className="sig"><div className="n">Signature du salarié</div><div className="l">Date</div></div>
            <div className="sig"><div className="n">Saisie bureau</div><div className="l">Date et visa</div></div>
          </div>
        </div>
      </div>
    </>
  );
}
