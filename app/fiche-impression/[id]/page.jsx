import Database from 'better-sqlite3';
import path from 'path';

export const dynamic = 'force-dynamic';

function getDb() {
  return new Database(path.join(process.cwd(), 'data', 'atelier.db'));
}

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
  const base = ETAPES_PAR_TYPE[typeIntervention] || ETAPES_PAR_TYPE['Autre'];
  // Injecter dynamiquement le type tête pour rideaux
  if (typeIntervention === 'Rideaux' && contenu.type_tete) {
    return base.map(e => e.etape === 'TÊTES' ? { ...e, type: contenu.type_tete } : e);
  }
  if (['Tapisserie', 'Tête de lit'].includes(typeIntervention) && contenu.tissu_ref) {
    return base.map(e => e.etape === 'POSE TISSU' ? { ...e, type: contenu.tissu_ref } : e);
  }
  return base;
}

function extraireMateriaux(typeIntervention, contenu) {
  const materiaux = [];
  if (contenu.tissu_ref) {
    materiaux.push({
      materiau: 'TISSU',
      ref: contenu.tissu_ref,
      dim: contenu.ml_tissu ? `${contenu.ml_tissu}ML` : '',
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
  const db = getDb();
  const row = db.prepare('SELECT * FROM dossiers WHERE id = ?').get(params.id);
  const ficheRow = db.prepare('SELECT * FROM fiches_atelier WHERE dossier_id = ?').get(params.id);
  db.close();

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

  // ── Styles constants ────────────────────────────────────────────────────
  const FONT = "'DM Sans', Arial, sans-serif";
  const DARK = '#555555';
  const BORDER = '1px solid #AAAAAA';
  const th = {
    background: DARK, color: '#fff',
    padding: '7px 10px', fontWeight: 700,
    fontSize: 12, textTransform: 'uppercase', letterSpacing: 0.5,
    border: BORDER, textAlign: 'left',
  };
  const td = { padding: '7px 10px', fontSize: 13, border: BORDER, verticalAlign: 'middle' };
  const tdC = { ...td, textAlign: 'center' };
  const zebra = (i) => ({ background: i % 2 === 0 ? '#fff' : '#F5F5F5' });

  return (
    <>
      <style>{`
        *, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }
        body { font-family: ${FONT}; background: #fff; color: #000; }
        table { width: 100%; border-collapse: collapse; margin-bottom: 14px; }
        .print-btn {
          position: fixed; top: 14px; right: 14px; z-index: 999;
          background: #000; color: #fff; border: none;
          padding: 10px 22px; font-size: 13px; cursor: pointer;
          font-family: ${FONT}; font-weight: 600; letter-spacing: 0.5px;
        }
        .print-btn:hover { background: #333; }
        @media print {
          @page { margin: 12mm 14mm; size: A4; }
          .print-btn { display: none !important; }
          body { font-size: 11px; }
        }
      `}</style>

      <button className="print-btn">
        Imprimer
      </button>

      <div style={{ padding: '24px 32px', maxWidth: 800, margin: '0 auto' }}>

        {/* ── En-tête ─────────────────────────────────────────────── */}
        <table style={{ marginBottom: 0 }}>
          <tbody>
            <tr>
              <td style={{ ...th, width: '36%', fontSize: 15, letterSpacing: 1 }}>FICHE ATELIER</td>
              <td style={{ ...th, width: '44%', fontSize: 13 }}>Code de devis : {codeDevis}</td>
              <td style={{ ...th, width: '20%', fontSize: 10, textAlign: 'right' }}>Impression FICHE</td>
            </tr>
          </tbody>
        </table>

        {/* ── Estimation / Type / Date ─────────────────────────────── */}
        <table style={{ marginBottom: 0 }}>
          <tbody>
            <tr>
              <td style={{ ...td, width: '36%', fontWeight: 700 }}>ESTIMATION D'HEURE :</td>
              <td style={{ ...td, width: '44%', fontWeight: 700, fontSize: 15 }}>
                {typeIntervention.toUpperCase()}
              </td>
              <td style={{ ...td, width: '20%' }}>{dateStr}</td>
            </tr>
          </tbody>
        </table>

        {/* ── Heures + Nom client ──────────────────────────────────── */}
        <table style={{ marginBottom: 16 }}>
          <tbody>
            <tr>
              <td style={{
                width: '36%', padding: '10px 12px',
                fontSize: 54, fontWeight: 900, border: BORDER, lineHeight: 1,
              }}>
                {heures}
              </td>
              <td style={{
                width: '64%', padding: '10px 12px',
                fontSize: 48, fontWeight: 900, border: BORDER, lineHeight: 1,
                letterSpacing: 2, wordBreak: 'break-word',
              }}>
                {clientNom}
              </td>
            </tr>
          </tbody>
        </table>

        {/* ── INFORMATION ─────────────────────────────────────────── */}
        <table>
          <tbody>
            <tr>
              <td style={{ ...th, width: '33%' }}>INFORMATION</td>
              <td style={{ ...th, width: '50%' }}>Données</td>
              <td style={{ ...th, width: '17%' }}>NUM</td>
            </tr>
            <tr>
              <td style={{ ...td, background: '#F0F0F0', fontWeight: 600 }}>ADRESSE</td>
              <td style={{ ...td }}>{ville}</td>
              <td style={{ ...td }}>{cp}</td>
            </tr>
            <tr>
              <td style={{ ...td, background: '#F0F0F0' }}>Téléphone client</td>
              <td style={{ ...td, fontWeight: 700 }}>{tel}</td>
              <td style={{ ...td }}>{typePhone(tel)}</td>
            </tr>
            <tr>
              <td style={{ ...td, background: '#F0F0F0' }}>Date de livraison estimée</td>
              <td style={{ ...td }}></td>
              <td style={{ ...td }}></td>
            </tr>
          </tbody>
        </table>

        {/* ── ETAPES ──────────────────────────────────────────────── */}
        <table>
          <tbody>
            <tr>
              <td style={{ ...th, width: '40%' }}>ETAPES</td>
              <td style={{ ...th, width: '43%' }}>TYPES</td>
              <td style={{ ...th, width: '17%', textAlign: 'center' }}>COCHE</td>
            </tr>
            {etapes.map((e, i) => (
              <tr key={i}>
                <td style={{ ...td, ...zebra(i) }}>{e.etape}</td>
                <td style={{ ...td, ...zebra(i) }}>{e.type}</td>
                <td style={{ ...tdC, ...zebra(i), fontSize: 20 }}>□</td>
              </tr>
            ))}
          </tbody>
        </table>

        {/* ── MATÉRIAUX ───────────────────────────────────────────── */}
        <table>
          <tbody>
            <tr>
              <td style={{ ...th, width: '33%' }}>Matériaux</td>
              <td style={{ ...th, width: '50%' }}>Réf</td>
              <td style={{ ...th, width: '17%' }}>Dim</td>
            </tr>
            {materiaux.length > 0
              ? materiaux.map((m, i) => (
                  <tr key={i}>
                    <td style={{ ...td }}>{m.materiau}</td>
                    <td style={{ ...td }}>{m.ref}</td>
                    <td style={{ ...td }}>{m.dim}</td>
                  </tr>
                ))
              : [0, 1].map(i => (
                  <tr key={i}>
                    <td style={{ ...td, height: 34 }}></td>
                    <td style={{ ...td }}></td>
                    <td style={{ ...td }}></td>
                  </tr>
                ))
            }
          </tbody>
        </table>

        {/* ── NOM / HEURES / TRAVAIL TERMINÉ ──────────────────────── */}
        <table>
          <tbody>
            <tr>
              <td style={{ ...th, width: '40%' }}>NOM</td>
              <td style={{ ...th, width: '43%' }}>HEURES</td>
              <td style={{ ...th, width: '17%', textAlign: 'center' }}>TRAVAIL TERMINÉ</td>
            </tr>
            {[0, 1, 2].map(i => (
              <tr key={i}>
                <td style={{ ...td, height: 36 }}></td>
                <td style={{ ...td }}></td>
                <td style={{ ...tdC, fontSize: 20 }}>□</td>
              </tr>
            ))}
            <tr>
              <td colSpan={3} style={{ ...td, background: '#F0F0F0', fontWeight: 700 }}>
                NOTES :
              </td>
            </tr>
            <tr>
              <td colSpan={3} style={{ ...td, height: 90, verticalAlign: 'top', whiteSpace: 'pre-wrap', fontSize: 13 }}>
                {notes}
              </td>
            </tr>
            <tr>
              <td colSpan={3} style={{ ...td, height: 22 }}></td>
            </tr>
          </tbody>
        </table>

      </div>

      {/* Le bouton Imprimer est un Server Component — on l'active via script inline */}
      <script dangerouslySetInnerHTML={{
        __html: `document.querySelector('.print-btn').addEventListener('click',function(){window.print();});`,
      }} />
    </>
  );
}
