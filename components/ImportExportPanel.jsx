'use client';
import { useState, useEffect } from 'react';
import { Download, FileText, ExternalLink } from 'lucide-react';
import Kicker from './ui/Kicker';

const INK    = '#000000';
const ACCENT = '#000000';

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

const STATUT_STYLES = {
  'Nouveau':       '#BBBBBB',
  'Devis envoyé':  '#888888',
  'Validé':        '#555555',
  'En atelier':    '#222222',
  'Prêt à poser':  '#000000',
  'Clos':          '#CCCCCC',
};

export default function ImportExportPanel() {
  const [dossiers, setDossiers] = useState([]);
  const [search, setSearch]     = useState('');

  useEffect(() => {
    fetch('/api/dossiers').then(r => r.json()).then(d => setDossiers(Array.isArray(d) ? d : []));
  }, []);

  const filtered = dossiers.filter(d => {
    if (!search) return true;
    const q = search.toLowerCase();
    return (d.nom_dossier || '').toLowerCase().includes(q) || (d.client_nom || '').toLowerCase().includes(q);
  });

  const tap  = filtered.filter(d => d.type_intervention !== 'Rideaux' && d.statut !== 'Clos');
  const cout = filtered.filter(d => d.type_intervention === 'Rideaux'  && d.statut !== 'Clos');
  const clos = filtered.filter(d => d.statut === 'Clos');

  const FicheRow = ({ d }) => (
    <a
      href={`/fiche-impression/${d.id}`}
      target="_blank"
      rel="noreferrer"
      className="flex items-center justify-between px-4 py-2.5 border-t border-dotted border-black/20 hover:bg-bg group"
    >
      <div className="flex items-center gap-3 min-w-0">
        <FileText size={13} className="text-muted shrink-0" />
        <div className="min-w-0">
          <p className="font-serif text-[14px] text-ink truncate">{d.nom_dossier}</p>
          {d.client_nom && d.client_nom !== d.nom_dossier && (
            <p className="font-sans text-[11px] text-muted truncate">{d.client_nom}</p>
          )}
        </div>
      </div>
      <div className="flex items-center gap-3 shrink-0 ml-4">
        <span
          className="font-mono text-[9px] uppercase tracking-[0.12em] px-1.5 py-0.5"
          style={{ background: STATUT_STYLES[d.statut] || '#ccc', color: d.statut === 'Clos' ? '#888' : '#fff' }}
        >
          {d.statut}
        </span>
        <ExternalLink size={12} className="text-muted opacity-0 group-hover:opacity-100" />
      </div>
    </a>
  );

  const Section = ({ label, items }) => {
    if (items.length === 0) return null;
    return (
      <div className="mb-4">
        <div className="flex items-center justify-between px-4 py-2 bg-ink">
          <Kicker className="text-white/70">{label}</Kicker>
          <span className="font-mono text-[10px] text-white/50">{items.length}</span>
        </div>
        {items.map(d => <FicheRow key={d.id} d={d} />)}
      </div>
    );
  };

  return (
    <div className="max-w-[900px]">
      {/* ── Export PDF ──────────────────────────────────────── */}
      <div className="mb-8">
        <Kicker className="mb-2">Module 07</Kicker>
        <h2 className="font-serif text-[36px] tracking-[-0.01em] leading-[1.0] text-ink mb-1">Export PDF</h2>
        <p className="font-sans text-[13px] text-muted mb-4">
          Ouvre un aperçu PDF mis en page dans un nouvel onglet.
        </p>
        <div className="flex gap-2 flex-wrap">
          {EXPORTS.map(e => <BoutonExport key={e.type} {...e} />)}
        </div>
      </div>

      {/* ── Fiches atelier ──────────────────────────────────── */}
      <div>
        <div className="flex items-end justify-between mb-3">
          <div>
            <Kicker className="mb-1">Fiches impression</Kicker>
            <h3 className="font-serif text-[22px] text-ink">Toutes les fiches atelier</h3>
            <p className="font-sans text-[13px] text-muted mt-0.5">
              {dossiers.length} dossiers · clic pour ouvrir la fiche
            </p>
          </div>
          <div className="relative">
            <span className="absolute left-3 top-1/2 -translate-y-1/2 font-mono text-muted text-[13px] pointer-events-none">⌕</span>
            <input
              type="text"
              value={search}
              onChange={e => setSearch(e.target.value)}
              placeholder="Filtrer…"
              className="pl-8 pr-3 py-2 bg-surface border border-ink font-sans text-[13px] text-ink w-52"
            />
          </div>
        </div>

        <div className="border border-ink bg-surface">
          <Section label="Atelier TAP"  items={tap} />
          <Section label="Atelier COUT" items={cout} />
          <Section label="Dossiers clos" items={clos} />
          {filtered.length === 0 && (
            <p className="px-4 py-10 text-center font-sans text-[13px] text-muted">Aucun dossier.</p>
          )}
        </div>
      </div>
    </div>
  );
}
