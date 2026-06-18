import { sql } from '@/lib/postgres';
import PrintButton from './PrintButton';

export const dynamic = 'force-dynamic';

function formatDate(d) {
  if (!d) return '';
  const [y, m, day] = d.split('-');
  return `${day}/${m}/${y}`;
}

export default async function RideauxPrintPage({ params }) {
  const { rows } = await sql`SELECT * FROM interventions_rideaux WHERE id = ${params.id}`;
  const row = rows[0];

  if (!row) {
    return <div style={{ padding: 40, fontFamily: 'sans-serif' }}>Fiche introuvable (id={params.id})</div>;
  }

  const pieces    = JSON.parse(row.pieces_json    || '[]');
  const materiaux = JSON.parse(row.materiaux_json || '[]');
  // Garantit au moins 4 lignes dans le tableau des pièces
  const pieceRows = [...pieces];
  while (pieceRows.length < 4) pieceRows.push({ baie: '', nb_rideaux: '', dimensions: '' });

  const SANS  = "'DM Sans', system-ui, sans-serif";
  const SERIF = "'Fraunces', Georgia, serif";
  const MONO  = "'DM Mono', Consolas, monospace";
  const BORDER = '1px solid #000';
  const BORDER_D = '1px solid rgba(0,0,0,0.25)';

  const th = {
    background: '#000', color: '#fff',
    padding: '6px 10px',
    fontFamily: MONO, fontSize: 10, fontWeight: 400,
    textTransform: 'uppercase', letterSpacing: '0.14em',
    border: BORDER, textAlign: 'left',
  };
  const td = {
    padding: '7px 10px', fontSize: 13,
    fontFamily: SANS,
    border: BORDER_D, verticalAlign: 'middle',
  };
  const tdLabel = {
    ...td,
    fontFamily: MONO, fontSize: 10,
    textTransform: 'uppercase', letterSpacing: '0.12em',
    color: '#737373', background: '#F5F5F5',
  };

  return (
    <>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=DM+Mono:wght@400;500&family=DM+Sans:wght@400;500&family=Fraunces:ital,opsz,wght@0,9..144,300..900;1,9..144,300..900&display=swap');
        *, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; border-radius: 0 !important; }
        body { font-family: ${SANS}; background: #fff; color: #000; }
        table { width: 100%; border-collapse: collapse; margin-bottom: 12px; }
        .print-btn {
          position: fixed; top: 14px; right: 14px; z-index: 999;
          background: #000; color: #fff; border: none;
          padding: 8px 20px;
          font-family: ${MONO}; font-size: 10px; font-weight: 400;
          text-transform: uppercase; letter-spacing: 0.14em; cursor: pointer;
        }
        @media print {
          @page { margin: 12mm 14mm; size: A4; }
          .print-btn { display: none !important; }
          body { font-size: 11px; }
        }
      `}</style>

      <PrintButton className="print-btn" />

      <div style={{ padding: '24px 32px', maxWidth: 800, margin: '0 auto' }}>

        {/* ── Masthead ───────────────────────────────────────────── */}
        <div style={{ borderBottom: BORDER, paddingBottom: 12, marginBottom: 16 }}>
          <p style={{ fontFamily: MONO, fontSize: 9, textTransform: 'uppercase', letterSpacing: '0.18em', color: '#737373', marginBottom: 4 }}>
            Atelier Stéphan Hamache · Poitiers
          </p>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline' }}>
            <p style={{ fontFamily: SERIF, fontSize: 22, color: '#000', lineHeight: 1 }}>
              Fiche Rideaux
            </p>
            <div style={{ textAlign: 'right', fontFamily: MONO, fontSize: 10, color: '#737373', letterSpacing: '0.1em' }}>
              <p>N° {String(row.id).padStart(4, '0')}</p>
              {row.date && <p>{formatDate(row.date)}</p>}
            </div>
          </div>
        </div>

        {/* ── Client ────────────────────────────────────────────── */}
        <table style={{ border: BORDER }}>
          <tbody>
            <tr>
              <td style={{ ...tdLabel, width: '12%', borderBottom: BORDER_D }}>Client</td>
              <td style={{ ...td, fontFamily: SERIF, fontSize: 20, fontWeight: 600, width: '52%', borderBottom: BORDER_D }}>
                {row.client}
              </td>
              <td style={{ ...tdLabel, width: '10%', borderBottom: BORDER_D }}>Tél.</td>
              <td style={{ ...td, fontFamily: MONO, fontSize: 13, fontWeight: 500, width: '26%', borderBottom: BORDER_D }}>
                {row.telephone || ''}
              </td>
            </tr>
            <tr>
              <td style={tdLabel}>Adresse</td>
              <td colSpan={3} style={td}>{row.adresse || ''}</td>
            </tr>
          </tbody>
        </table>

        {/* ── Pièces ────────────────────────────────────────────── */}
        <table>
          <thead>
            <tr>
              <td style={{ ...th, width: '8%' }}>Pièce</td>
              <td style={{ ...th, width: '36%' }}>Baie / Fenêtre</td>
              <td style={{ ...th, width: '18%', textAlign: 'center' }}>Nb rideaux</td>
              <td style={{ ...th, width: '38%' }}>Dimensions (L×H cm)</td>
            </tr>
          </thead>
          <tbody>
            {pieceRows.map((p, i) => (
              <tr key={i}>
                <td style={{ ...td, textAlign: 'center', fontFamily: MONO, fontSize: 11, color: '#737373' }}>
                  {i + 1}
                </td>
                <td style={{ ...td, color: '#333' }}>{p.baie || ''}</td>
                <td style={{ ...td, textAlign: 'center', fontFamily: MONO, fontSize: 11 }}>
                  {p.nb_rideaux || ''}
                </td>
                <td style={{ ...td, fontFamily: MONO, fontSize: 11 }}>{p.dimensions || ''}</td>
              </tr>
            ))}
          </tbody>
        </table>

        {/* ── Tissu ─────────────────────────────────────────────── */}
        <table>
          <tbody>
            <tr>
              <td style={{ ...tdLabel, width: '12%', borderBottom: BORDER_D }}>Tissu</td>
              <td style={{ ...td, width: '38%', borderBottom: BORDER_D }}>{row.tissu || ''}</td>
              <td style={{ ...tdLabel, width: '12%', borderBottom: BORDER_D }}>Réf</td>
              <td style={{ ...td, fontFamily: MONO, fontSize: 11, width: '38%', borderBottom: BORDER_D }}>
                {row.ref_tissu || ''}
              </td>
            </tr>
            <tr>
              <td style={tdLabel}>Coloris</td>
              <td style={td}>{row.coloris || ''}</td>
              <td style={tdLabel}>Métrage</td>
              <td style={{ ...td, fontFamily: MONO, fontSize: 12 }}>{row.metrage || ''}</td>
            </tr>
          </tbody>
        </table>

        {/* ── Type de tête + Heures ─────────────────────────────── */}
        <table>
          <tbody>
            <tr>
              <td style={{ ...tdLabel, width: '14%' }}>Type de tête</td>
              <td style={{ ...td, fontFamily: SERIF, fontSize: 14, width: '52%' }}>
                {row.type_tete || ''}
              </td>
              <td style={{ ...tdLabel, width: '10%' }}>Heures</td>
              <td style={{
                ...td, width: '24%',
                fontFamily: SERIF, fontSize: 26, fontWeight: 600,
                textAlign: 'center', borderLeft: BORDER,
                background: row.heures ? '#F5F5F5' : '#fff',
              }}>
                {row.heures ? `${row.heures}h` : ''}
              </td>
            </tr>
          </tbody>
        </table>

        {/* ── Matériaux commandés ───────────────────────────────── */}
        {materiaux.length > 0 && (
          <table style={{ marginBottom: 12 }}>
            <thead>
              <tr>
                <td style={{ ...th, width: '28%' }}>Matériau / Tissu</td>
                <td style={{ ...th, width: '18%' }}>Référence</td>
                <td style={{ ...th, width: '22%' }}>Fournisseur</td>
                <td style={{ ...th, width: '18%' }}>Coloris</td>
                <td style={{ ...th, width: '14%', textAlign: 'center' }}>Qté</td>
              </tr>
            </thead>
            <tbody>
              {materiaux.map((m, i) => (
                <tr key={i}>
                  <td style={td}>{m.materiau || ''}</td>
                  <td style={{ ...td, fontFamily: MONO, fontSize: 11 }}>{m.ref || ''}</td>
                  <td style={td}>{m.fournisseur || ''}</td>
                  <td style={td}>{m.coloris || ''}</td>
                  <td style={{ ...td, textAlign: 'center', fontFamily: MONO, fontSize: 11 }}>
                    {m.qte ? `${m.qte} ${m.unite || ''}` : ''}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}

        {/* ── Notes ─────────────────────────────────────────────── */}
        <table>
          <tbody>
            <tr>
              <td style={{ ...tdLabel, borderBottom: BORDER_D }}>Notes</td>
            </tr>
            <tr>
              <td style={{ ...td, height: 80, verticalAlign: 'top', whiteSpace: 'pre-wrap', border: BORDER }}>
                {row.notes || ''}
              </td>
            </tr>
          </tbody>
        </table>

        {/* ── Signatures ────────────────────────────────────────── */}
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 24, marginTop: 8 }}>
          {['Réalisé par', 'Contrôlé par'].map(label => (
            <div key={label}>
              <p style={{ fontFamily: MONO, fontSize: 9, textTransform: 'uppercase', letterSpacing: '0.14em', color: '#737373', marginBottom: 8 }}>
                {label}
              </p>
              <div style={{ borderBottom: BORDER, height: 28 }}></div>
              <p style={{ fontFamily: MONO, fontSize: 9, color: '#737373', marginTop: 4 }}>Date : ___________</p>
            </div>
          ))}
        </div>

      </div>
    </>
  );
}
