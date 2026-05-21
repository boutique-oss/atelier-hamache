import { createClient } from '@/lib/supabase/server';
import { SCHEMAS } from '@/lib/fiches-schemas';
import PrintButton from './PrintButton';

export const dynamic = 'force-dynamic';

function formatDate(d) {
  if (!d) return '—';
  const [y, m, day] = String(d).split('-');
  return `${day}/${m}/${y}`;
}

export default async function FicheAtelierPrint({ params }) {
  const supabase = createClient();
  const { data: fiche } = await supabase
    .from('fiches_atelier').select('*').eq('id', params.id).single();

  if (!fiche) return <p style={{ fontFamily: 'sans-serif', padding: 40 }}>Fiche introuvable.</p>;

  let contenu = {};
  try { contenu = JSON.parse(fiche.contenu_json); } catch {}

  const schema = SCHEMAS[fiche.type_intervention] || [];

  return (
    <>
      <style>{`
        @media print {
          @page { size: A4; margin: 12mm 14mm; }
          body { margin: 0; }
          .no-print { display: none !important; }
        }
        * { box-sizing: border-box; }
        body { font-family: Arial, sans-serif; background: #fff; color: #000; margin: 0; }
        .page { max-width: 794px; margin: 0 auto; padding: 24px 28px; min-height: 1123px; }
        .header { border-bottom: 2px solid #000; padding-bottom: 12px; margin-bottom: 16px; display: flex; justify-content: space-between; align-items: flex-start; }
        .brand { font-size: 20px; font-weight: bold; letter-spacing: -0.01em; }
        .sub { font-size: 9px; text-transform: uppercase; letter-spacing: 0.14em; color: #555; margin-top: 2px; }
        .fiche-title { text-align: right; }
        .fiche-title h1 { font-size: 11px; text-transform: uppercase; letter-spacing: 0.18em; font-weight: normal; color: #555; margin: 0 0 4px; }
        .fiche-title .type-badge { display: inline-block; border: 1.5px solid #000; padding: 4px 10px; font-size: 13px; font-weight: bold; text-transform: uppercase; letter-spacing: 0.08em; }
        .section { margin-bottom: 14px; }
        .section-title { font-size: 8px; text-transform: uppercase; letter-spacing: 0.2em; color: #777; border-bottom: 1px solid #ddd; padding-bottom: 3px; margin-bottom: 8px; }
        .grid2 { display: grid; grid-template-columns: 1fr 1fr; gap: 8px 16px; }
        .grid1 { display: grid; grid-template-columns: 1fr; gap: 8px; }
        .field { display: flex; flex-direction: column; }
        .field label { font-size: 8px; text-transform: uppercase; letter-spacing: 0.16em; color: #888; margin-bottom: 2px; }
        .field .val { font-size: 12px; border-bottom: 1px solid #ccc; padding-bottom: 2px; min-height: 20px; }
        .field .val.big { font-size: 13px; font-weight: bold; }
        .notes-box { border: 1px solid #000; padding: 8px; min-height: 60px; font-size: 12px; white-space: pre-wrap; }
        .footer { border-top: 1px solid #000; margin-top: 20px; padding-top: 8px; display: flex; justify-content: space-between; font-size: 8px; color: #888; text-transform: uppercase; letter-spacing: 0.1em; }
        .sign-row { display: grid; grid-template-columns: 1fr 1fr 1fr; gap: 16px; margin-top: 16px; }
        .sign-box { border: 1px solid #ccc; padding: 6px 8px; }
        .sign-box label { font-size: 8px; text-transform: uppercase; letter-spacing: 0.16em; color: #888; display: block; margin-bottom: 24px; }
        .print-btn { position: fixed; bottom: 24px; right: 24px; background: #000; color: #fff; border: none; padding: 12px 20px; font-size: 13px; cursor: pointer; z-index: 100; }
      `}</style>

      <PrintButton />

      <div className="page">

        {/* En-tête */}
        <div className="header">
          <div>
            <div className="brand">Stéphan Hamache</div>
            <div className="sub">Tapisserie d'ameublement · Poitiers</div>
          </div>
          <div className="fiche-title">
            <h1>Fiche atelier</h1>
            <div className="type-badge">{fiche.type_intervention}</div>
          </div>
        </div>

        {/* Infos communes */}
        <div className="section">
          <div className="section-title">Intervention</div>
          <div className="grid2">
            <div className="field">
              <label>Client</label>
              <div className="val big">{contenu.client_nom || '—'}</div>
            </div>
            <div className="field">
              <label>Téléphone</label>
              <div className="val">{contenu.client_tel || '—'}</div>
            </div>
            <div className="field">
              <label>Date prévue</label>
              <div className="val">{formatDate(contenu.date_prevue)}</div>
            </div>
            <div className="field">
              <label>Heures estimées</label>
              <div className="val">{contenu.heures_estimees ? `${contenu.heures_estimees} h` : '—'}</div>
            </div>
          </div>
        </div>

        {/* Champs spécifiques */}
        {schema.length > 0 && (
          <div className="section">
            <div className="section-title">Détails {fiche.type_intervention}</div>
            <div className="grid2">
              {schema.map(field => {
                const val = contenu[field.key];
                if (!val && field.type !== 'textarea') return null;
                return (
                  <div key={field.key} className={`field${field.type === 'textarea' ? ' col-span-2' : ''}`}
                       style={field.type === 'textarea' ? { gridColumn: '1 / -1' } : {}}>
                    <label>{field.label}{field.unit ? ` (${field.unit})` : ''}</label>
                    <div className="val" style={field.type === 'textarea' ? { whiteSpace: 'pre-wrap', minHeight: 40, border: '1px solid #ddd', padding: '4px 6px' } : {}}>
                      {val || '—'}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {/* Notes libres */}
        {fiche.notes_libres && (
          <div className="section">
            <div className="section-title">Instructions / notes</div>
            <div className="notes-box">{fiche.notes_libres}</div>
          </div>
        )}

        {/* Zone signatures */}
        <div className="sign-row">
          {['Réalisé par', 'Contrôlé par', 'Date réalisation'].map(label => (
            <div key={label} className="sign-box">
              <label>{label}</label>
            </div>
          ))}
        </div>

        {/* Footer */}
        <div className="footer">
          <span>Fiche #{fiche.id} · {fiche.type_intervention}</span>
          <span>Atelier Stéphan Hamache · Usage interne</span>
        </div>
      </div>

    </>
  );
}
