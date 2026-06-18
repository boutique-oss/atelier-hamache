import { sql } from '@/lib/postgres';
import { SCHEMAS, groupBySection } from '@/lib/fiches-schemas';
import PrintButton from './PrintButton';

export const dynamic = 'force-dynamic';

function formatDate(d) {
  if (!d) return '—';
  const [y, m, day] = String(d).split('-');
  return `${day}/${m}/${y}`;
}

export default async function FicheAtelierPrint({ params }) {
  const { rows } = await sql`SELECT * FROM fiches_atelier WHERE id = ${params.id}`;
  const fiche = rows[0];

  if (!fiche) return <p style={{ fontFamily: 'sans-serif', padding: 40 }}>Fiche introuvable.</p>;

  let contenu = {};
  try { contenu = JSON.parse(fiche.contenu_json); } catch {}

  const schema = SCHEMAS[fiche.type_intervention] || [];
  const groups = groupBySection(schema);

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
        .section { margin-bottom: 12px; }
        .section-title { font-size: 8px; text-transform: uppercase; letter-spacing: 0.2em; color: #777; border-bottom: 1px solid #ddd; padding-bottom: 3px; margin-bottom: 8px; }
        .grid2 { display: grid; grid-template-columns: 1fr 1fr; gap: 8px 16px; }
        .grid1 { display: grid; grid-template-columns: 1fr; gap: 8px; }
        .field { display: flex; flex-direction: column; }
        .field label { font-size: 8px; text-transform: uppercase; letter-spacing: 0.16em; color: #888; margin-bottom: 2px; }
        .field .val { font-size: 12px; border-bottom: 1px solid #ccc; padding-bottom: 2px; min-height: 20px; }
        .field .val.big { font-size: 13px; font-weight: bold; }
        .field .val.textarea { white-space: pre-wrap; min-height: 40px; border: 1px solid #ddd; padding: 4px 6px; font-size: 12px; }
        .notes-box { border: 1px solid #000; padding: 8px; min-height: 60px; font-size: 12px; white-space: pre-wrap; }
        .footer { border-top: 1px solid #000; margin-top: 20px; padding-top: 8px; display: flex; justify-content: space-between; font-size: 8px; color: #888; text-transform: uppercase; letter-spacing: 0.1em; }
        .sign-row { display: grid; grid-template-columns: 1fr 1fr 1fr; gap: 16px; margin-top: 16px; }
        .sign-box { border: 1px solid #ccc; padding: 6px 8px; }
        .sign-box label { font-size: 8px; text-transform: uppercase; letter-spacing: 0.16em; color: #888; display: block; margin-bottom: 24px; }
        .print-btn { position: fixed; bottom: 24px; right: 24px; background: #000; color: #fff; border: none; padding: 12px 20px; font-size: 13px; cursor: pointer; z-index: 100; }
        /* Checklist */
        .checklist { display: flex; flex-wrap: wrap; gap: 5px 14px; padding-top: 4px; }
        .checklist-item { display: inline-flex; align-items: center; gap: 4px; font-size: 10px; font-family: Arial, sans-serif; }
        .check-box { display: inline-block; width: 11px; height: 11px; border: 1px solid #000; flex-shrink: 0; position: relative; }
        .check-box.checked { background: #000; }
        .check-box.checked::after { content: ''; position: absolute; top: 1px; left: 2px; width: 5px; height: 3px; border-left: 1.5px solid #fff; border-bottom: 1.5px solid #fff; transform: rotate(-45deg); }
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

        {/* Sections par groupe */}
        {groups.map(group => {
          // Vérifier si le groupe a du contenu à afficher
          const hasContent = group.fields.some(f => {
            if (f.type === 'checklist') return true;
            if (f.type === 'textarea') return true;
            return !!contenu[f.key];
          });
          if (!hasContent) return null;

          return (
            <div key={group.title || '__top__'} className="section">
              {group.title && (
                <div className="section-title">{group.title}</div>
              )}
              <div className="grid2">
                {group.fields.map(field => {
                  const val = contenu[field.key];

                  if (field.type === 'checklist') {
                    const checked = Array.isArray(val) ? val : [];
                    return (
                      <div key={field.key} style={{ gridColumn: '1 / -1' }} className="field">
                        <label>{field.label}</label>
                        <div className="checklist">
                          {field.options.map(o => (
                            <span key={o} className="checklist-item">
                              <span className={`check-box${checked.includes(o) ? ' checked' : ''}`} />
                              {o}
                            </span>
                          ))}
                        </div>
                      </div>
                    );
                  }

                  if (field.type === 'textarea') {
                    return (
                      <div key={field.key} style={{ gridColumn: '1 / -1' }} className="field">
                        <label>{field.label}{field.unit ? ` (${field.unit})` : ''}</label>
                        <div className="val textarea">{val || '—'}</div>
                      </div>
                    );
                  }

                  if (!val) return null;

                  return (
                    <div key={field.key} className="field">
                      <label>{field.label}{field.unit ? ` (${field.unit})` : ''}</label>
                      <div className="val">{val}</div>
                    </div>
                  );
                })}
              </div>
            </div>
          );
        })}

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
