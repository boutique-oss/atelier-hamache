'use client';
import { Download } from 'lucide-react';

const INK    = '#000000';
const ACCENT = '#000000';
const SOFT   = '#EEEEEE';

const EXPORTS = [
  { type: 'dossiers',  label: 'Dossiers',         desc: 'Pipeline actif · statuts, heures, avancement' },
  { type: 'commandes', label: 'Commandes tissu',   desc: 'Toutes les commandes fournisseurs' },
  { type: 'heures',    label: 'Heures',            desc: 'Saisies réelles par opérateur et dossier' },
  { type: 'rapport',   label: 'Rapport synthèse',  desc: 'Heures prévues/réelles · par opérateur · par statut' },
  { type: 'complet',   label: 'Tout exporter',      desc: 'Toutes les sections en un seul document PDF' },
];

function BoutonExport({ type, label, desc }) {
  const isBig = type === 'complet';
  return (
    <button onClick={() => window.open(`/api/export?type=${type}`, '_blank')} style={{
      background: isBig ? ACCENT : '#fff',
      color: isBig ? '#fff' : INK,
      border: `1px solid ${isBig ? ACCENT : '#E5E5E5'}`,
      padding: '10px 16px', cursor: 'pointer', textAlign: 'left',
      flex: 1, minWidth: 180,
    }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 2 }}>
        <Download size={14} color={isBig ? '#fff' : ACCENT} />
        <span style={{ fontWeight: 700, fontSize: 13 }}>{label}</span>
      </div>
      <div style={{ fontSize: 11, color: isBig ? 'rgba(255,255,255,.75)' : '#888', paddingLeft: 22 }}>{desc}</div>
    </button>
  );
}

export default function ImportExportPanel() {
  return (
    <div style={{ fontFamily: 'DM Sans, sans-serif', maxWidth: 900 }}>
      <h2 style={{ fontSize: 16, fontWeight: 700, color: INK, marginBottom: 4, display: 'flex', alignItems: 'center', gap: 8 }}>
        <Download size={16} color={ACCENT} /> Exporter en PDF
      </h2>
      <p style={{ fontSize: 13, color: '#888', marginBottom: 16 }}>
        Ouvre un aperçu PDF mis en page dans un nouvel onglet. Clique sur « Imprimer » pour enregistrer en PDF ou imprimer directement.
      </p>
      <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
        {EXPORTS.map(e => <BoutonExport key={e.type} {...e} />)}
      </div>
    </div>
  );
}
