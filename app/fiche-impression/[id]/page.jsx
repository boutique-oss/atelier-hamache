import { createClient } from '@/lib/supabase/server';
import PrintButton from './PrintButton';

export const dynamic = 'force-dynamic';

// ── Étapes prédéfinies par type d'intervention ────────────────────────────
const ETAPES_PAR_TYPE = {
  Tapisserie: [
    { etape: 'DÉCOUVERTURE', type: '' },
    { etape: 'SANGLAGE', type: '' },
    { etape: 'GARNISSAGE', type: '' },
    { etape: 'POSE TISSU', type: 'Tissu' },
    { etape: 'FINITION', type: 'Passepoil / Sobafix' },
  ],
  Rideaux: [
    { etape: 'COUPE', type: '' },
    { etape: 'COUTURE', type: '' },
    { etape: 'TÊTES', type: '' },
    { etape: 'FINITIONS', type: '' },
    { etape: 'POSE', type: '' },
  ],
  Stores: [
    { etape: 'DÉCOUPE', type: '' },
    { etape: 'MONTAGE', type: '' },
    { etape: 'ESSAI', type: '' },
    { etape: 'POSE', type: '' },
  ],
  'Tête de lit': [
    { etape: 'DÉCOUPE', type: '' },
    { etape: 'GARNISSAGE', type: '' },
    { etape: 'POSE TISSU', type: 'Tissu' },
    { etape: 'FINITION', type: '' },
  ],
  'Habillage de lit': [
    { etape: 'DÉCOUPE', type: '' },
    { etape: 'COUTURE', type: '' },
    { etape: 'ASSEMBLAGE', type: '' },
    { etape: 'FINITION', type: '' },
  ],
  Coussins: [
    { etape: 'DÉCOUPE', type: '' },
    { etape: 'COUTURE', type: '' },
    { etape: 'GARNISSAGE', type: '' },
    { etape: 'FERMETURE', type: '' },
  ],
  'Pose seule': [
    { etape: 'PRÉPARATION', type: '' },
    { etape: 'POSE', type: '' },
    { etape: 'VÉRIFICATION', type: '' },
  ],
  Autre: [
    { etape: 'ÉTAPE 1', type: '' },
    { etape: 'ÉTAPE 2', type: '' },
    { etape: 'ÉTAPE 3', type: '' },
  ],
};

function buildEtapes(typeIntervention, contenu) {
  // Si des étapes ont été sauvegardées (même liste vide), les utiliser telles quelles
  if (Array.isArray(contenu.etapes_custom)) {
    return contenu.etapes_custom;
  }
  // Fallback pour fiches jamais sauvegardées
  const base = ETAPES_PAR_TYPE[typeIntervention] || ETAPES_PAR_TYPE['Autre'];
  if (typeIntervention === 'Rideaux' && contenu.type_tete) {
    return base.map(e => e.etape === 'TÊTES' ? { ...e, type: contenu.type_tete } : e);
  }
  if (['Tapisserie', 'Tête de lit'].includes(typeIntervention) && contenu.tissu_ref) {
    return base.map(e => e.etape === 'POSE TISSU' ? { ...e, type: contenu.tissu_ref } : e);
  }
  return base;
}

function extraireMateriaux(typeIntervention, contenu) {
  // Tissus multiples (nouveau format)
  if (Array.isArray(contenu.tissus_list) && contenu.tissus_list.length > 0) {
    return contenu.tissus_list.map(t => ({
      materiau: 'TISSU',
      ref: [t.ref, t.coloris].filter(Boolean).join(' · '),
      dim: [t.placement, t.metrage ? `${t.metrage}m` : ''].filter(Boolean).join(' / '),
    }));
  }
  // Fallback legacy — un seul tissu
  const materiaux = [];
  if (contenu.tissu_ref) {
    materiaux.push({
      materiau: 'TISSU',
      ref: contenu.tissu_ref,
      dim: contenu.ml_tissu ? `${contenu.ml_tissu}m` : '',
    });
  }
  if (contenu.garnissage && ['Tapisserie', 'Tête de lit', 'Coussins'].includes(typeIntervention)) {
    materiaux.push({ materiau: 'GARNISSAGE', ref: contenu.garnissage, dim: '' });
  }
  return materiaux;
}

function extraireVilleCP(adresse) {
  if (!adresse) return { ville: '', cp: '' };
  const match = adresse.match(/\b(\d{5})\b/);
  if (match) {
    return {
      ville: adresse.replace(match[0], '').replace(/\s{2,}/g, ' ').trim(),
      cp: match[1],
    };
  }
  return { ville: adresse, cp: '' };
}

function typePhone(tel) {
  if (!tel) return '';
  const c = tel.replace(/[\s.\-]/g, '');
  return (c.startsWith('06') || c.startsWith('07') || c.startsWith('+336') || c.startsWith('+337'))
    ? 'PORTABLE' : 'FIXE';
}

export default async function FicheImpressionPage({ params }) {
  const supabase = createClient();
  const [{ data: row }, { data: ficheRow }] = await Promise.all([
    supabase.from('dossiers').select('*').eq('id', params.id).maybeSingle(),
    supabase.from('fiches_atelier').select('*').eq('dossier_id', params.id).maybeSingle(),
  ]);

  if (!row) {
    return <div style={{ padding: 40, fontFamily: 'sans-serif' }}>Dossier introuvable (id={params.id})</div>;
  }

  const contenu = ficheRow ? JSON.parse(ficheRow.contenu_json || '{}') : {};
  const typeIntervention = ficheRow?.type_intervention || row.type_intervention || 'Autre';
  const clientNom = (row.client_nom || row.nom_dossier || '').toUpperCase();
  const heures = row.heures_a_realiser > 0 ? `${row.heures_a_realiser}H` : '—';
  const codeDevis = `DE${String(row.id).padStart(8, '0')}`;
  const dateStr = row.date_ouverture
    ? new Date(row.date_ouverture).toLocaleDateString('fr-FR') : '';
  const { ville, cp } = extraireVilleCP(row.adresse || '');
  const tel = row.telephone || '';
  const notes = ficheRow?.notes_libres || '';
  const etapes = buildEtapes(typeIntervention, contenu);
  const materiaux = extraireMateriaux(typeIntervention, contenu);
  const fournitures = Array.isArray(contenu.fournitures_list) ? contenu.fournitures_list : [];

  const SANS  = "'DM Sans', system-ui, sans-serif";
  const SERIF = "'Fraunces', Georgia, serif";
  const MONO  = "'DM Mono', Consolas, monospace";
  const BORDER_SOLID  = '1px solid #000';
  const BORDER_DOTTED = '1px dotted rgba(0,0,0,0.25)';

  const th = {
    background: '#000', color: '#fff',
    padding: '6px 10px',
    fontFamily: MONO, fontSize: 10, fontWeight: 400,
    textTransform: 'uppercase', letterSpacing: '0.14em',
    border: BORDER_SOLID, textAlign: 'left',
  };
  const td = {
    padding: '7px 10px', fontSize: 13,
    fontFamily: SANS,
    border: BORDER_DOTTED, verticalAlign: 'middle',
  };
  const tdC = { ...td, textAlign: 'center' };
  const tdLabel = { ...td, fontFamily: MONO, fontSize: 10, textTransform: 'uppercase', letterSpacing: '0.12em', color: '#737373', background: '#F5F5F5', borderBottom: BORDER_SOLID };

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

        {/* ── Masthead ─────────────────────────────────────────────── */}
        <div style={{ borderBottom: BORDER_SOLID, paddingBottom: 12, marginBottom: 16 }}>
          <p style={{ fontFamily: MONO, fontSize: 9, textTransform: 'uppercase', letterSpacing: '0.18em', color: '#737373', marginBottom: 4 }}>
            Atelier Stéphan Hamache · Poitiers
          </p>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline' }}>
            <p style={{ fontFamily: SERIF, fontSize: 22, color: '#000', lineHeight: 1 }}>
              Fiche {typeIntervention}
            </p>
            <div style={{ textAlign: 'right', fontFamily: MONO, fontSize: 10, color: '#737373', letterSpacing: '0.1em' }}>
              <p>Réf. {codeDevis}</p>
              {dateStr && <p>{dateStr}</p>}
            </div>
          </div>
        </div>

        {/* ── Heures + Nom client ──────────────────────────────────── */}
        <table style={{ marginBottom: 16, border: BORDER_SOLID }}>
          <tbody>
            <tr>
              <td style={{
                width: '30%', padding: '10px 14px',
                fontFamily: SERIF, fontSize: 56, fontWeight: 600,
                border: BORDER_SOLID, lineHeight: 1,
                fontVariantNumeric: 'tabular-nums',
              }}>
                {heures}
              </td>
              <td style={{
                width: '70%', padding: '10px 14px',
                fontFamily: SERIF, fontSize: 44, fontWeight: 600,
                border: BORDER_SOLID, lineHeight: 1,
                letterSpacing: 1, wordBreak: 'break-word',
              }}>
                {clientNom}
              </td>
            </tr>
          </tbody>
        </table>

        {/* ── INFORMATION ─────────────────────────────────────────── */}
        <table>
          <thead>
            <tr>
              <td style={{ ...th, width: '33%' }}>Information</td>
              <td style={{ ...th, width: '50%' }}>Données</td>
              <td style={{ ...th, width: '17%' }}>Num</td>
            </tr>
          </thead>
          <tbody>
            <tr>
              <td style={tdLabel}>Adresse</td>
              <td style={td}>{ville}</td>
              <td style={td}>{cp}</td>
            </tr>
            <tr>
              <td style={tdLabel}>Téléphone client</td>
              <td style={{ ...td, fontFamily: MONO, fontSize: 12 }}>{tel}</td>
              <td style={{ ...td, fontFamily: MONO, fontSize: 10 }}>{typePhone(tel)}</td>
            </tr>
            <tr>
              <td style={tdLabel}>Date livraison estimée</td>
              <td style={td}></td>
              <td style={td}></td>
            </tr>
          </tbody>
        </table>

        {/* ── ETAPES ──────────────────────────────────────────────── */}
        <table>
          <thead>
            <tr>
              <td style={{ ...th, width: '40%' }}>Étapes</td>
              <td style={{ ...th, width: '43%' }}>Types</td>
              <td style={{ ...th, width: '17%', textAlign: 'center' }}>Coche</td>
            </tr>
          </thead>
          <tbody>
            {etapes.map((e, i) => (
              <tr key={i}>
                <td style={{ ...td, fontFamily: MONO, fontSize: 11, letterSpacing: '0.08em' }}>{e.etape}</td>
                <td style={td}>{e.type}</td>
                <td style={{ ...tdC, fontSize: 18 }}>□</td>
              </tr>
            ))}
          </tbody>
        </table>

        {/* ── MATÉRIAUX ───────────────────────────────────────────── */}
        <table>
          <thead>
            <tr>
              <td style={{ ...th, width: '33%' }}>Matériaux</td>
              <td style={{ ...th, width: '50%' }}>Réf</td>
              <td style={{ ...th, width: '17%' }}>Dim</td>
            </tr>
          </thead>
          <tbody>
            {materiaux.length > 0
              ? materiaux.map((m, i) => (
                  <tr key={i}>
                    <td style={{ ...td, fontFamily: MONO, fontSize: 10, letterSpacing: '0.1em', textTransform: 'uppercase' }}>{m.materiau}</td>
                    <td style={{ ...td, fontFamily: MONO, fontSize: 11 }}>{m.ref}</td>
                    <td style={{ ...td, fontFamily: MONO, fontSize: 11 }}>{m.dim}</td>
                  </tr>
                ))
              : [0, 1].map(i => (
                  <tr key={i}>
                    <td style={{ ...td, height: 34 }}></td>
                    <td style={td}></td>
                    <td style={td}></td>
                  </tr>
                ))
            }
          </tbody>
        </table>

        {/* ── FOURNITURES ─────────────────────────────────────────── */}
        {fournitures.length > 0 && (
          <table>
            <thead>
              <tr>
                <td style={{ ...th, width: '33%' }}>Fournitures</td>
                <td style={{ ...th, width: '25%' }}>Coloris</td>
                <td style={{ ...th, width: '25%' }}>Placement</td>
                <td style={{ ...th, width: '17%' }}>Métrage</td>
              </tr>
            </thead>
            <tbody>
              {fournitures.map((f, i) => (
                <tr key={i}>
                  <td style={{ ...td, fontFamily: MONO, fontSize: 11 }}>{f.ref}</td>
                  <td style={td}>{f.coloris}</td>
                  <td style={td}>{f.placement}</td>
                  <td style={{ ...td, fontFamily: MONO, fontSize: 11 }}>{f.metrage ? `${f.metrage}m` : ''}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}

        {/* ── RÉALISATION ─────────────────────────────────────────── */}
        <table>
          <thead>
            <tr>
              <td style={{ ...th, width: '40%' }}>Nom opérateur</td>
              <td style={{ ...th, width: '43%' }}>Heures réelles</td>
              <td style={{ ...th, width: '17%', textAlign: 'center' }}>Terminé</td>
            </tr>
          </thead>
          <tbody>
            {[0, 1, 2].map(i => (
              <tr key={i}>
                <td style={{ ...td, height: 36 }}></td>
                <td style={td}></td>
                <td style={{ ...tdC, fontSize: 18 }}>□</td>
              </tr>
            ))}
            <tr>
              <td colSpan={3} style={{ ...tdLabel, borderTop: BORDER_SOLID }}>Notes</td>
            </tr>
            <tr>
              <td colSpan={3} style={{ ...td, height: 90, verticalAlign: 'top', whiteSpace: 'pre-wrap', borderBottom: BORDER_SOLID }}>
                {notes}
              </td>
            </tr>
          </tbody>
        </table>

        {/* Signatures */}
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 24, marginTop: 8 }}>
          {['Réalisé par', 'Contrôlé par'].map(label => (
            <div key={label}>
              <p style={{ fontFamily: MONO, fontSize: 9, textTransform: 'uppercase', letterSpacing: '0.14em', color: '#737373', marginBottom: 8 }}>{label}</p>
              <div style={{ borderBottom: BORDER_SOLID, height: 28 }}></div>
              <p style={{ fontFamily: MONO, fontSize: 9, color: '#737373', marginTop: 4 }}>Date : ___________</p>
            </div>
          ))}
        </div>

      </div>

    </>
  );
}
