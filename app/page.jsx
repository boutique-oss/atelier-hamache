'use client';

import { useState, useEffect, useMemo } from 'react';
import { Plus, Pencil, Trash2, X, ExternalLink, Truck, Check, FileText, ClipboardList } from 'lucide-react';
import Link from 'next/link';
import HeuresModule from '../components/HeuresModule';
import ImportExportPanel from '../components/ImportExportPanel';
import FicheAtelierModal from '../components/FicheAtelierModal';
import PredevisModule from '../components/PredevisModule';
import VueRideaux from '../components/VueRideaux';
import VueTodo from '../components/VueTodo';
import Kicker from '../components/ui/Kicker';
import Btn from '../components/ui/Btn';

const STATUTS = ['Nouveau', 'Devis envoyé', 'Validé', 'En atelier', 'Prêt à poser', 'Clos'];
const FLAGS = ['Standby', 'SAV', 'Urgent'];
const TYPES = ['Tapisserie', 'Rideaux', 'Stores', 'Tête de lit', 'Habillage de lit', 'Coussins', 'Pose seule', 'Autre'];

const STATUT_STYLES = {
  'Nouveau':       { bg: '#FFFFFF', text: '#000', dot: '#BBBBBB' },
  'Devis envoyé':  { bg: '#EEEEEE', text: '#000', dot: '#888888' },
  'Validé':        { bg: '#E0E0E0', text: '#000', dot: '#555555' },
  'En atelier':    { bg: '#222222', text: '#FFF', dot: '#FFFFFF' },
  'Prêt à poser':  { bg: '#000000', text: '#FFF', dot: '#FFFFFF' },
  'Clos':          { bg: '#DDDDDD', text: '#666', dot: '#999999' },
};


function StatutBadge({ statut }) {
  const s = STATUT_STYLES[statut] || STATUT_STYLES['Nouveau'];
  return (
    <span
      className="inline-block px-2 py-0.5 font-mono text-[10px] uppercase tracking-[0.12em] whitespace-nowrap border"
      style={{ background: s.bg, color: s.text, borderColor: s.dot }}
    >
      {statut}
    </span>
  );
}

function FlagBadge({ flag }) {
  if (flag === 'Urgent') {
    return (
      <span className="inline-block font-serif italic text-[11px] px-1.5 py-0 border-2 border-urgent text-urgent -rotate-3">
        URGENT
      </span>
    );
  }
  if (flag === 'Standby') {
    return (
      <span className="inline-block font-serif italic text-[11px] px-1.5 py-0 border border-ink text-ink -rotate-3">
        STANDBY
      </span>
    );
  }
  if (flag === 'SAV') {
    return (
      <span className="inline-block font-mono text-[10px] uppercase tracking-[0.12em] px-1.5 py-0.5 bg-ink text-surface">
        SAV
      </span>
    );
  }
  return null;
}

function EtapesDots({ etapes }) {
  const items = [
    { key: 'devis', label: 'Devis' }, { key: 'cmde', label: 'Commande' },
    { key: 'atelier', label: 'Fiche atelier' }, { key: 'print', label: 'Print' },
    { key: 'realise', label: 'Réalisé' },
  ];
  return (
    <div className="flex items-center gap-1">
      {items.map(it => (
        <div
          key={it.key}
          title={`${it.label} : ${etapes[it.key] ? 'fait' : 'à faire'}`}
          style={{
            width: 10, height: 10,
            background: etapes[it.key] ? '#000' : 'transparent',
            border: '1px solid #000',
          }}
        />
      ))}
    </div>
  );
}

const formatDate = (d) => {
  if (!d) return '—';
  const [y, m, day] = d.split('-');
  return `${day}/${m}/${y}`;
};

const labelCls = 'font-mono uppercase tracking-[0.16em] text-[10px] text-muted block mb-1';
const fieldCls = 'w-full px-3 py-2 bg-bg border border-ink font-sans text-[13px] text-ink';

function DossierModal({ dossier, onSave, onDelete, onClose, onReload }) {
  const isNew = !dossier.id;
  const [d, setD] = useState({
    nom_dossier: '', client_nom: '', statut: 'Nouveau', flags: [],
    type_intervention: 'Autre', date_ouverture: '', adresse: '',
    telephone: '', email: '', lien: '', comm: '',
    heures_a_realiser: 0,
    etapes: { devis: false, cmde: false, atelier: false, print: false, realise: false },
    ...dossier,
  });

  const update = (f, v) => setD(p => ({ ...p, [f]: v }));
  const updateEtape = (k, v) => setD(p => ({ ...p, etapes: { ...p.etapes, [k]: v } }));
  const toggleFlag = (f) => setD(p => ({ ...p, flags: p.flags.includes(f) ? p.flags.filter(x => x !== f) : [...p.flags, f] }));

  const [pdfLoading, setPdfLoading] = useState(false);

  const uploadPdf = async (file) => {
    if (!file || !d.id) return;
    setPdfLoading(true);
    const fd = new FormData();
    fd.append('file', file);
    fd.append('dossier_id', d.id);
    const r = await fetch('/api/pdf', { method: 'POST', body: fd });
    const res = await r.json();
    if (res.ok) { update('fiche_pdf', res.filename); onReload && onReload(); }
    else alert(res.error || 'Erreur upload');
    setPdfLoading(false);
  };

  const deletePdf = async () => {
    if (!confirm('Supprimer la fiche PDF jointe ?')) return;
    await fetch(`/api/pdf?dossier_id=${d.id}`, { method: 'DELETE' });
    update('fiche_pdf', null);
    onReload && onReload();
  };

  const handleSubmit = () => {
    if (!d.nom_dossier.trim()) return;
    onSave({ ...d, client_nom: d.client_nom || d.nom_dossier });
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4"
         style={{ background: 'rgba(0,0,0,0.5)' }} onClick={onClose}>
      <div className="w-full max-w-2xl max-h-[90vh] overflow-y-auto bg-surface border border-ink" onClick={e => e.stopPropagation()}>

        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-line">
          <div>
            <h2 className="font-serif text-[22px] text-ink">{isNew ? 'Nouveau dossier' : d.nom_dossier}</h2>
            <p className="font-mono text-[10px] text-muted mt-0.5">
              {isNew ? 'Saisis les informations principales' : 'Modifier ce dossier'}
            </p>
          </div>
          <button onClick={onClose} className="p-1.5 text-muted"><X size={18} /></button>
        </div>

        <div className="px-6 py-5 space-y-5">
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className={labelCls}>Nom du dossier *</label>
              <input type="text" value={d.nom_dossier} onChange={e => update('nom_dossier', e.target.value)} className={fieldCls} />
            </div>
            <div>
              <label className={labelCls}>Type d&apos;intervention</label>
              <select value={d.type_intervention} onChange={e => update('type_intervention', e.target.value)} className={fieldCls}>
                {TYPES.map(t => <option key={t} value={t}>{t}</option>)}
              </select>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className={labelCls}>Heures prévues (devis)</label>
              <input type="number" step="0.5" min="0" placeholder="ex: 8.5"
                     value={d.heures_a_realiser || ''}
                     onChange={e => update('heures_a_realiser', parseFloat(e.target.value) || 0)}
                     className={fieldCls} />
              <p className="font-mono text-[10px] text-muted mt-1">Comparé aux heures réelles</p>
            </div>
            <div>
              <label className={labelCls}>Date d&apos;ouverture</label>
              <input type="date" value={d.date_ouverture || ''} onChange={e => update('date_ouverture', e.target.value)} className={fieldCls} />
            </div>
          </div>

          {/* Statut */}
          <div>
            <label className={labelCls}>Statut dans le pipeline</label>
            <div className="grid grid-cols-3 gap-2">
              {STATUTS.map(s => {
                const style = STATUT_STYLES[s]; const active = d.statut === s;
                return (
                  <button key={s} type="button" onClick={() => update('statut', s)}
                          className="flex items-center gap-2 px-3 py-2 font-mono text-[10px] uppercase tracking-[0.1em]"
                          style={{ background: active ? style.bg : 'transparent', color: active ? style.text : '#444', border: `1px solid ${active ? style.dot : '#000'}` }}>
                    {s}
                  </button>
                );
              })}
            </div>
          </div>

          {/* Flags */}
          <div>
            <label className={labelCls}>Flags (cumulables)</label>
            <div className="flex gap-2 flex-wrap">
              {FLAGS.map(f => {
                const active = d.flags.includes(f);
                const isUrgent = f === 'Urgent';
                return (
                  <button key={f} type="button" onClick={() => toggleFlag(f)}
                          className="inline-flex items-center gap-1.5 px-3 py-1.5 font-mono text-[10px] uppercase tracking-[0.1em]"
                          style={{
                            background: active && isUrgent ? '#FF0000' : active ? '#000' : 'transparent',
                            color: active ? '#FFF' : '#444',
                            border: `1px solid ${active && isUrgent ? '#FF0000' : '#000'}`,
                          }}>
                    {f}
                  </button>
                );
              })}
            </div>
          </div>

          {/* Jalons */}
          <div>
            <label className={labelCls}>Jalons d&apos;avancement</label>
            <div className="grid grid-cols-5 gap-2">
              {[
                { key: 'devis', label: 'Devis signé' }, { key: 'cmde', label: 'Commande' },
                { key: 'atelier', label: 'Fiche atelier' }, { key: 'print', label: 'Print' },
                { key: 'realise', label: 'Réalisé' },
              ].map(it => (
                <label key={it.key} className="flex items-center gap-2 px-2.5 py-2 cursor-pointer font-mono text-[10px]"
                       style={{ background: '#F5F5F5', border: `1px solid ${d.etapes[it.key] ? '#000' : '#E5E5E5'}` }}>
                  <input type="checkbox" checked={d.etapes[it.key]} onChange={e => updateEtape(it.key, e.target.checked)} style={{ accentColor: '#000' }} />
                  <span style={{ color: d.etapes[it.key] ? '#000' : '#737373' }}>{it.label}</span>
                </label>
              ))}
            </div>
          </div>

          {/* Client */}
          <div className="pt-3 border-t border-line">
            <Kicker className="mb-3">Coordonnées client</Kicker>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className={labelCls}>Téléphone</label>
                <input type="text" value={d.telephone} onChange={e => update('telephone', e.target.value)} className={fieldCls} />
              </div>
              <div>
                <label className={labelCls}>Email</label>
                <input type="email" value={d.email} onChange={e => update('email', e.target.value)} className={fieldCls} />
              </div>
              <div className="col-span-2">
                <label className={labelCls}>Adresse</label>
                <input type="text" value={d.adresse} onChange={e => update('adresse', e.target.value)} className={fieldCls} />
              </div>
            </div>
          </div>

          {/* Lien + comm */}
          <div>
            <label className={labelCls}>Lien dossier OneDrive</label>
            <input type="text" value={d.lien} onChange={e => update('lien', e.target.value)} placeholder="%ONEDRIVE%\..."
                   className="w-full px-3 py-2 bg-bg border border-ink font-mono text-[12px] text-ink" />
          </div>
          <div>
            <label className={labelCls}>Commentaires</label>
            <textarea value={d.comm} onChange={e => update('comm', e.target.value)} rows={3}
                      className="w-full px-3 py-2 bg-bg border border-ink font-sans text-[13px] text-ink resize-none" />
          </div>

          {/* Fiche PDF */}
          <div className="pt-3 border-t border-line">
            <label className={labelCls}>Fiche PDF</label>
            {isNew ? (
              <p className="font-sans text-[13px] text-muted">Disponible après création du dossier.</p>
            ) : d.fiche_pdf ? (
              <div className="flex items-center gap-2 flex-wrap">
                <a href={`/api/pdf?dossier_id=${d.id}`} target="_blank" rel="noreferrer"
                   className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-ink text-surface font-sans text-[13px]">
                  <FileText size={12} /> Ouvrir la fiche
                </a>
                <label className="inline-flex items-center gap-1.5 px-3 py-1.5 border border-ink font-sans text-[13px] text-muted cursor-pointer">
                  <input type="file" accept=".pdf" className="hidden" onChange={e => uploadPdf(e.target.files[0])} />
                  Remplacer
                </label>
                <button onClick={deletePdf} className="px-3 py-1.5 border border-ink font-sans text-[13px] text-ink">Supprimer</button>
                {pdfLoading && <span className="font-mono text-[11px] text-muted">Envoi…</span>}
              </div>
            ) : (
              <div className="flex items-center gap-2">
                <label className="inline-flex items-center gap-2 px-3 py-2 border border-ink font-sans text-[13px] text-muted cursor-pointer">
                  <input type="file" accept=".pdf" className="hidden" onChange={e => uploadPdf(e.target.files[0])} />
                  <FileText size={12} /> Joindre une fiche PDF
                </label>
                {pdfLoading && <span className="font-mono text-[11px] text-muted">Envoi…</span>}
              </div>
            )}
          </div>
        </div>

        {/* Footer */}
        <div className="px-6 py-4 flex items-center justify-between border-t border-line bg-bg">
          <div>
            {!isNew && (
              <Btn variant="danger" onClick={() => onDelete(d.id)}>
                <Trash2 size={12} /> Supprimer
              </Btn>
            )}
          </div>
          <div className="flex gap-2">
            <Btn variant="outline" onClick={onClose}>Annuler</Btn>
            <Btn onClick={handleSubmit} disabled={!d.nom_dossier.trim()}>
              {isNew ? 'Créer le dossier' : 'Enregistrer'}
            </Btn>
          </div>
        </div>
      </div>
    </div>
  );
}

function VueDossiers({ dossiers, onEdit, onNew, onFiche, rideauxFiches = [] }) {
  // Set des dossier_id qui ont une fiche rideaux liée
  const ficheRideauxIds = useMemo(
    () => new Set(rideauxFiches.filter(f => f.dossier_id).map(f => f.dossier_id)),
    [rideauxFiches]
  );
  const [search, setSearch] = useState('');
  const [clientFilter, setClientFilter] = useState('all');
  const [statutFilter, setStatutFilter] = useState('all');
  const [typeFilter, setTypeFilter] = useState('all');
  const [flagFilter, setFlagFilter] = useState('all');
  const [sortAlpha, setSortAlpha] = useState(false);

  const actifs = useMemo(() => dossiers.filter(d => d.statut !== 'Clos'), [dossiers]);

  const clientsUniques = useMemo(() =>
    [...new Set(actifs.map(d => d.client_nom).filter(Boolean))].sort(),
  [actifs]);

  const filtered = useMemo(() => {
    return actifs.filter(d => {
      if (search && !d.nom_dossier.toLowerCase().includes(search.toLowerCase()) && !d.client_nom.toLowerCase().includes(search.toLowerCase())) return false;
      if (clientFilter !== 'all' && d.client_nom !== clientFilter) return false;
      if (statutFilter !== 'all' && d.statut !== statutFilter) return false;
      if (typeFilter !== 'all' && d.type_intervention !== typeFilter) return false;
      if (flagFilter !== 'all' && !d.flags.includes(flagFilter)) return false;
      return true;
    }).sort((a, b) => {
      const sa = STATUTS.indexOf(a.statut), sb = STATUTS.indexOf(b.statut);
      if (sa !== sb) return sa - sb;
      if (sortAlpha) return a.nom_dossier.localeCompare(b.nom_dossier, 'fr', { sensitivity: 'base' });
      return (b.date_ouverture || '').localeCompare(a.date_ouverture || '');
    });
  }, [actifs, search, clientFilter, statutFilter, typeFilter, flagFilter, sortAlpha]);

  const stats = useMemo(() => {
    const out = {};
    STATUTS.filter(s => s !== 'Clos').forEach(s => out[s] = actifs.filter(d => d.statut === s).length);
    return out;
  }, [actifs]);

  const hasFilters = clientFilter !== 'all' || statutFilter !== 'all' || typeFilter !== 'all' || flagFilter !== 'all' || search || sortAlpha;

  return (
    <div>
      {/* En-tête de module */}
      <div className="flex items-end justify-between mb-6">
        <div>
          <Kicker className="mb-2">Module 01</Kicker>
          <h2 className="font-serif text-[36px] tracking-[-0.01em] leading-[1.0] text-ink">
            Pipeline dossiers
          </h2>
          <p className="font-sans text-[13px] text-muted mt-1">
            {actifs.length} dossiers en cours · pipeline atelier
          </p>
        </div>
        <Btn onClick={onNew}>
          <Plus size={16} strokeWidth={2.5} /> Nouveau dossier
        </Btn>
      </div>

      {/* Colonnes statuts — filtres cliquables */}
      <div className="grid grid-cols-5 mb-6 border border-ink">
        {STATUTS.filter(s => s !== 'Clos').map((s, idx) => {
          const style = STATUT_STYLES[s], count = stats[s] || 0, isActive = statutFilter === s;
          return (
            <button
              key={s}
              onClick={() => setStatutFilter(isActive ? 'all' : s)}
              className={`text-left p-4 ${idx > 0 ? 'border-l border-ink' : ''}`}
              style={{ background: isActive ? style.bg : '#FFF', color: isActive ? style.text : '#000' }}
            >
              <Kicker className={`mb-2 ${isActive && style.text === '#FFF' ? 'text-white/70' : ''}`}>{s}</Kicker>
              <p className="font-serif tnum text-[28px] leading-none">{count}</p>
            </button>
          );
        })}
      </div>

      {/* Barre de filtres */}
      <div className="flex gap-2 mb-2">
        <div className="relative flex-1">
          <span className="absolute left-3 top-1/2 -translate-y-1/2 font-mono text-muted text-[13px] pointer-events-none">⌕</span>
          <input
            type="text"
            value={search}
            onChange={e => setSearch(e.target.value)}
            placeholder="Rechercher un dossier ou un client…"
            className="w-full pl-8 pr-3 py-2 bg-surface border border-ink font-sans text-[13px] text-ink"
          />
        </div>
        <select
          value={clientFilter}
          onChange={e => setClientFilter(e.target.value)}
          className="px-3 py-2 border border-ink font-sans text-[13px]"
          style={{ background: clientFilter !== 'all' ? '#000' : '#FFF', color: clientFilter !== 'all' ? '#FFF' : '#000', minWidth: 180 }}
        >
          <option value="all">Tous clients</option>
          {clientsUniques.map(c => <option key={c} value={c}>{c}</option>)}
        </select>
        <select
          value={typeFilter}
          onChange={e => setTypeFilter(e.target.value)}
          className="px-3 py-2 bg-surface border border-ink font-sans text-[13px] text-ink"
          style={{ minWidth: 160 }}
        >
          <option value="all">Tous types</option>
          {TYPES.map(t => <option key={t} value={t}>{t}</option>)}
        </select>
        <select
          value={flagFilter}
          onChange={e => setFlagFilter(e.target.value)}
          className="px-3 py-2 bg-surface border border-ink font-sans text-[13px] text-ink"
          style={{ minWidth: 140 }}
        >
          <option value="all">Tous flags</option>
          {FLAGS.map(f => <option key={f} value={f}>{f}</option>)}
        </select>
        <button
          onClick={() => setSortAlpha(a => !a)}
          className="px-3 py-2 font-mono text-[11px] uppercase tracking-[0.1em] border border-ink whitespace-nowrap"
          style={{ background: sortAlpha ? '#000' : 'transparent', color: sortAlpha ? '#FFF' : '#000' }}
          title="Trier par nom A→Z (sinon : par date)"
        >
          A→Z
        </button>
      </div>

      {/* Chips filtres actifs */}
      {hasFilters && (
        <div className="flex items-center gap-2 mb-2 flex-wrap">
          <span className="font-mono text-[10px] uppercase tracking-[0.12em] text-muted">Filtres :</span>
          {search && (
            <span className="inline-flex items-center gap-1 px-2 py-0.5 font-mono text-[11px] border border-ink">
              &ldquo;{search}&rdquo;
              <button onClick={() => setSearch('')} className="ml-0.5"><X size={10} /></button>
            </span>
          )}
          {clientFilter !== 'all' && (
            <span className="inline-flex items-center gap-1 px-2 py-0.5 font-mono text-[11px] bg-ink text-surface">
              {clientFilter}
              <button onClick={() => setClientFilter('all')} className="ml-0.5"><X size={10} /></button>
            </span>
          )}
          {statutFilter !== 'all' && (
            <span className="inline-flex items-center gap-1 px-2 py-0.5 font-mono text-[11px] border border-ink">
              {statutFilter}
              <button onClick={() => setStatutFilter('all')} className="ml-0.5"><X size={10} /></button>
            </span>
          )}
          {typeFilter !== 'all' && (
            <span className="inline-flex items-center gap-1 px-2 py-0.5 font-mono text-[11px] border border-ink">
              {typeFilter}
              <button onClick={() => setTypeFilter('all')} className="ml-0.5"><X size={10} /></button>
            </span>
          )}
          {flagFilter !== 'all' && (
            <span className="inline-flex items-center gap-1 px-2 py-0.5 font-mono text-[11px] border border-ink">
              {flagFilter}
              <button onClick={() => setFlagFilter('all')} className="ml-0.5"><X size={10} /></button>
            </span>
          )}
          <button
            onClick={() => { setSearch(''); setClientFilter('all'); setStatutFilter('all'); setTypeFilter('all'); setFlagFilter('all'); setSortAlpha(false); }}
            className="font-mono text-[10px] uppercase tracking-[0.12em] text-muted underline"
          >
            Tout effacer
          </button>
        </div>
      )}

      <p className="font-mono text-[11px] text-muted mb-3 tnum">
        {filtered.length} {filtered.length > 1 ? 'dossiers affichés' : 'dossier affiché'}
      </p>

      {/* Table */}
      <div className="border border-ink bg-surface">
        <table className="w-full">
          <thead>
            <tr className="bg-bg border-b border-ink">
              {['Dossier', 'Statut', 'Type', 'Avancement', 'Date', 'H. prévues', 'Flags', ''].map((h, i) => (
                <th key={i} className="text-left px-4 py-3 font-mono text-[10px] uppercase tracking-[0.12em] text-muted">
                  {h}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {filtered.map(d => (
              <tr key={d.id} className="group hover:bg-bg border-t border-dotted border-black/30">
                <td className="px-4 py-3 cursor-pointer" onClick={() => onEdit(d)}>
                  <p className="font-serif text-[14px] text-ink">{d.nom_dossier}</p>
                  {d.client_nom && d.client_nom !== d.nom_dossier && (
                    <p className="font-sans text-[12px] text-muted mt-0.5">{d.client_nom}</p>
                  )}
                </td>
                <td className="px-4 py-3 cursor-pointer" onClick={() => onEdit(d)}>
                  <StatutBadge statut={d.statut} />
                </td>
                <td className="px-4 py-3 font-sans text-[13px] text-muted cursor-pointer" onClick={() => onEdit(d)}>
                  <span>{d.type_intervention || '—'}</span>
                  {d.type_intervention === 'Rideaux' && (
                    <span
                      className="ml-2 font-mono text-[9px] uppercase tracking-[0.1em] px-1 py-0.5 border"
                      style={ficheRideauxIds.has(d.id)
                        ? { borderColor: '#000', background: '#000', color: '#fff' }
                        : { borderColor: '#ccc', color: '#999' }}
                    >
                      {ficheRideauxIds.has(d.id) ? '✓ fiche' : '○ fiche'}
                    </span>
                  )}
                </td>
                <td className="px-4 py-3 cursor-pointer" onClick={() => onEdit(d)}>
                  <EtapesDots etapes={d.etapes} />
                </td>
                <td className="px-4 py-3 font-mono text-[11px] text-muted whitespace-nowrap tnum cursor-pointer" onClick={() => onEdit(d)}>
                  {formatDate(d.date_ouverture)}
                </td>
                <td className="px-4 py-3 cursor-pointer" onClick={() => onEdit(d)}>
                  <span className={`font-serif tnum text-[14px] ${d.heures_a_realiser > 0 ? 'text-ink' : 'text-muted'}`}>
                    {d.heures_a_realiser > 0 ? `${d.heures_a_realiser}h` : '—'}
                  </span>
                </td>
                <td className="px-4 py-3 cursor-pointer" onClick={() => onEdit(d)}>
                  <div className="flex flex-wrap gap-1.5">
                    {d.flags.map(f => <FlagBadge key={f} flag={f} />)}
                  </div>
                </td>
                <td className="px-4 py-3">
                  <div className="opacity-0 group-hover:opacity-100 flex items-center gap-1">
                    {d.fiche_pdf && (
                      <a
                        href={`/api/pdf?dossier_id=${d.id}`}
                        target="_blank" rel="noreferrer"
                        onClick={e => e.stopPropagation()}
                        title="Voir la fiche PDF"
                        className="p-1.5 text-muted"
                      >
                        <FileText size={13} />
                      </a>
                    )}
                    <button
                      onClick={e => { e.stopPropagation(); onFiche(d); }}
                      title="Fiche atelier"
                      className="p-1.5 text-muted"
                    >
                      <ClipboardList size={13} />
                    </button>
                    <button onClick={() => onEdit(d)} title="Modifier" className="p-1.5 text-muted">
                      <Pencil size={13} />
                    </button>
                  </div>
                </td>
              </tr>
            ))}
            {filtered.length === 0 && (
              <tr>
                <td colSpan={8} className="px-4 py-12 text-center font-sans text-[13px] text-muted">
                  Aucun dossier ne correspond aux filtres.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function CommandeModal({ commande, fournisseurs, onSave, onDelete, onClose }) {
  const isNew = !commande.id;
  const [c, setC] = useState({
    fournisseur: '', client: '', designation: '', reference: '', coloris: '',
    qte: '', qte_note: '', unite: 'ml', montant: '', qte_livree: '',
    commentaires: '', date_cde: '', date_livraison: '',
    ...commande,
  });
  const upd = (f, v) => setC(p => ({ ...p, [f]: v }));

  const handleSubmit = () => {
    if (!c.fournisseur.trim()) return;
    const payload = { ...c };
    if (payload.qte !== '' && payload.qte !== null) payload.qte = parseFloat(payload.qte) || null;
    if (payload.qte_livree !== '' && payload.qte_livree !== null) payload.qte_livree = parseFloat(payload.qte_livree) || null;
    onSave(payload);
  };

  const fournList = [...new Set(fournisseurs.map(f => f.nom))].sort();

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4"
         style={{ background: 'rgba(0,0,0,0.5)' }} onClick={onClose}>
      <div className="w-full max-w-xl max-h-[90vh] overflow-y-auto bg-surface border border-ink"
           onClick={e => e.stopPropagation()}>

        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-line">
          <div>
            <h2 className="font-serif text-[22px] text-ink">
              {isNew ? 'Nouvelle commande' : 'Modifier la commande'}
            </h2>
            <p className="font-mono text-[10px] text-muted mt-0.5">
              {isNew ? 'Saisir les informations matière' : `${c.fournisseur} · ${c.client}`}
            </p>
          </div>
          <button onClick={onClose} className="p-1.5 text-muted"><X size={18} /></button>
        </div>

        <div className="px-6 py-5 space-y-4">
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className={labelCls}>Fournisseur *</label>
              <input list="fourns-list" value={c.fournisseur} onChange={e => upd('fournisseur', e.target.value)}
                     className={fieldCls} />
              <datalist id="fourns-list">
                {fournList.map(f => <option key={f} value={f} />)}
              </datalist>
            </div>
            <div>
              <label className={labelCls}>Client (dossier)</label>
              <input type="text" value={c.client} onChange={e => upd('client', e.target.value)} className={fieldCls} />
            </div>
          </div>

          <div>
            <label className={labelCls}>Désignation</label>
            <input type="text" value={c.designation} onChange={e => upd('designation', e.target.value)} className={fieldCls} />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className={labelCls}>Référence</label>
              <input type="text" value={c.reference} onChange={e => upd('reference', e.target.value)}
                     className="w-full px-3 py-2 bg-bg border border-ink font-mono text-[12px] text-ink" />
            </div>
            <div>
              <label className={labelCls}>Coloris</label>
              <input type="text" value={c.coloris} onChange={e => upd('coloris', e.target.value)} className={fieldCls} />
            </div>
          </div>

          <div className="grid grid-cols-3 gap-3">
            <div>
              <label className={labelCls}>Quantité</label>
              <input type="number" step="0.1" min="0" value={c.qte} onChange={e => upd('qte', e.target.value)} className={fieldCls} />
            </div>
            <div>
              <label className={labelCls}>Unité</label>
              <select value={c.unite} onChange={e => upd('unite', e.target.value)} className={fieldCls}>
                {['ml', 'm²', 'pièce', 'lot'].map(u => <option key={u} value={u}>{u}</option>)}
              </select>
            </div>
            <div>
              <label className={labelCls}>Note qté</label>
              <input type="text" value={c.qte_note} onChange={e => upd('qte_note', e.target.value)} placeholder="ex: 2 lés"
                     className={fieldCls} />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className={labelCls}>Date commande</label>
              <input type="date" value={c.date_cde || ''} onChange={e => upd('date_cde', e.target.value)} className={fieldCls} />
            </div>
            <div>
              <label className={labelCls}>Date livraison prévue</label>
              <input type="date" value={c.date_livraison || ''} onChange={e => upd('date_livraison', e.target.value)} className={fieldCls} />
            </div>
          </div>

          <div className="pt-3 border-t border-line">
            <label className={labelCls}>Quantité livrée (0 = en attente)</label>
            <input type="number" step="0.1" min="0" value={c.qte_livree} onChange={e => upd('qte_livree', e.target.value)} className={fieldCls} />
          </div>

          <div>
            <label className={labelCls}>Commentaires</label>
            <textarea value={c.commentaires} onChange={e => upd('commentaires', e.target.value)} rows={2}
                      className="w-full px-3 py-2 bg-bg border border-ink font-sans text-[13px] text-ink resize-none" />
          </div>
        </div>

        {/* Footer */}
        <div className="px-6 py-4 flex items-center justify-between border-t border-line bg-bg">
          <div>
            {!isNew && (
              <Btn variant="danger" onClick={() => onDelete(c.id)}>
                <Trash2 size={12} /> Supprimer
              </Btn>
            )}
          </div>
          <div className="flex gap-2">
            <Btn variant="outline" onClick={onClose}>Annuler</Btn>
            <Btn onClick={handleSubmit} disabled={!c.fournisseur.trim()}>
              {isNew ? 'Enregistrer' : 'Mettre à jour'}
            </Btn>
          </div>
        </div>
      </div>
    </div>
  );
}

function VueCommandes({ commandes, fournisseurs, onNew, onEdit }) {
  const [search, setSearch] = useState('');
  const [clientFilter, setClientFilter] = useState('all');
  const [fournFilter, setFournFilter] = useState('all');
  const [statutLivFilter, setStatutLivFilter] = useState('all');
  const [sortKey, setSortKey] = useState('');
  const [sortDir, setSortDir] = useState('asc');

  const fournUniques = useMemo(() => [...new Set(commandes.map(c => c.fournisseur))].sort(), [commandes]);
  const clientsUniques = useMemo(() => [...new Set(commandes.map(c => c.client).filter(Boolean))].sort(), [commandes]);

  const toggleSort = (key) => {
    if (sortKey === key) setSortDir(d => d === 'asc' ? 'desc' : 'asc');
    else { setSortKey(key); setSortDir('asc'); }
  };

  const filtered = useMemo(() => {
    let rows = commandes.filter(c => {
      if (search && !c.client?.toLowerCase().includes(search.toLowerCase()) && !c.designation?.toLowerCase().includes(search.toLowerCase()) && !c.reference?.toLowerCase().includes(search.toLowerCase())) return false;
      if (clientFilter !== 'all' && c.client !== clientFilter) return false;
      if (fournFilter !== 'all' && c.fournisseur !== fournFilter) return false;
      const livree = c.qte_livree && c.qte_livree > 0;
      if (statutLivFilter === 'livree' && !livree) return false;
      if (statutLivFilter === 'attente' && livree) return false;
      return true;
    });
    if (sortKey) {
      rows = [...rows].sort((a, b) => {
        const va = String(a[sortKey] || ''), vb = String(b[sortKey] || '');
        return sortDir === 'asc' ? va.localeCompare(vb) : vb.localeCompare(va);
      });
    }
    return rows;
  }, [commandes, search, clientFilter, fournFilter, statutLivFilter, sortKey, sortDir]);

  const stats = useMemo(() => {
    const livrees = commandes.filter(c => c.qte_livree && c.qte_livree > 0).length;
    const totalMl = commandes.reduce((s, c) => s + (c.qte || 0), 0);
    return { total: commandes.length, livrees, attente: commandes.length - livrees, ml: Math.round(totalMl * 10) / 10 };
  }, [commandes]);

  const fournLink = (nom) => fournisseurs.find(f => f.nom === nom)?.url;
  const hasFilters = clientFilter !== 'all' || fournFilter !== 'all' || statutLivFilter !== 'all' || search;

  return (
    <div>
      {/* En-tête de module */}
      <div className="flex items-end justify-between mb-6">
        <div>
          <Kicker className="mb-2">Module 02</Kicker>
          <h2 className="font-serif text-[36px] tracking-[-0.01em] leading-[1.0] text-ink">Commandes</h2>
          <p className="font-sans text-[13px] text-muted mt-1">
            {commandes.length} commandes · {fournUniques.length} fournisseurs
          </p>
        </div>
        <Btn onClick={onNew}>
          <Plus size={16} strokeWidth={2.5} /> Nouvelle commande
        </Btn>
      </div>

      {/* Stats 4 blocs */}
      <div className="grid grid-cols-4 mb-6 border border-ink">
        <div className="p-4">
          <Kicker className="mb-2">Total commandes</Kicker>
          <p className="font-serif tnum text-[28px] leading-none text-ink">{stats.total}</p>
        </div>
        <button
          onClick={() => setStatutLivFilter(statutLivFilter === 'attente' ? 'all' : 'attente')}
          className="text-left p-4 border-l border-ink"
          style={{ background: statutLivFilter === 'attente' ? '#000' : '#FFF', color: statutLivFilter === 'attente' ? '#FFF' : '#000' }}
        >
          <Kicker className={`mb-2 ${statutLivFilter === 'attente' ? 'text-white/70' : ''}`}>En attente</Kicker>
          <p className="font-serif tnum text-[28px] leading-none">{stats.attente}</p>
        </button>
        <button
          onClick={() => setStatutLivFilter(statutLivFilter === 'livree' ? 'all' : 'livree')}
          className="text-left p-4 border-l border-ink"
          style={{ background: statutLivFilter === 'livree' ? '#000' : '#FFF', color: statutLivFilter === 'livree' ? '#FFF' : '#000' }}
        >
          <Kicker className={`mb-2 ${statutLivFilter === 'livree' ? 'text-white/70' : ''}`}>Livrées</Kicker>
          <p className="font-serif tnum text-[28px] leading-none">{stats.livrees}</p>
        </button>
        <div className="p-4 border-l border-ink bg-ink text-surface">
          <Kicker className="mb-2 text-white/70">Total commandé</Kicker>
          <p className="font-serif tnum text-[28px] leading-none">
            {stats.ml}<span className="font-mono text-[13px] ml-1">ml</span>
          </p>
        </div>
      </div>

      {/* Barre de filtres */}
      <div className="flex gap-2 mb-2">
        <div className="relative flex-1">
          <span className="absolute left-3 top-1/2 -translate-y-1/2 font-mono text-muted text-[13px] pointer-events-none">⌕</span>
          <input type="text" value={search} onChange={e => setSearch(e.target.value)}
                 placeholder="Rechercher client, désignation, référence…"
                 className="w-full pl-8 pr-3 py-2 bg-surface border border-ink font-sans text-[13px] text-ink" />
        </div>
        <select value={clientFilter} onChange={e => setClientFilter(e.target.value)}
                className="px-3 py-2 border border-ink font-sans text-[13px]"
                style={{ background: clientFilter !== 'all' ? '#000' : '#FFF', color: clientFilter !== 'all' ? '#FFF' : '#000', minWidth: 180 }}>
          <option value="all">Tous clients</option>
          {clientsUniques.map(c => <option key={c} value={c}>{c}</option>)}
        </select>
        <select value={fournFilter} onChange={e => setFournFilter(e.target.value)}
                className="px-3 py-2 bg-surface border border-ink font-sans text-[13px] text-ink"
                style={{ minWidth: 200 }}>
          <option value="all">Tous fournisseurs ({fournUniques.length})</option>
          {fournUniques.map(f => <option key={f} value={f}>{f}</option>)}
        </select>
      </div>

      {/* Chips filtres actifs */}
      {hasFilters && (
        <div className="flex items-center gap-2 mb-2 flex-wrap">
          <span className="font-mono text-[10px] uppercase tracking-[0.12em] text-muted">Filtres :</span>
          {search && (
            <span className="inline-flex items-center gap-1 px-2 py-0.5 font-mono text-[11px] border border-ink">
              &ldquo;{search}&rdquo;<button onClick={() => setSearch('')} className="ml-0.5"><X size={10} /></button>
            </span>
          )}
          {clientFilter !== 'all' && (
            <span className="inline-flex items-center gap-1 px-2 py-0.5 font-mono text-[11px] bg-ink text-surface">
              {clientFilter}<button onClick={() => setClientFilter('all')} className="ml-0.5"><X size={10} /></button>
            </span>
          )}
          {fournFilter !== 'all' && (
            <span className="inline-flex items-center gap-1 px-2 py-0.5 font-mono text-[11px] border border-ink">
              {fournFilter}<button onClick={() => setFournFilter('all')} className="ml-0.5"><X size={10} /></button>
            </span>
          )}
          {statutLivFilter !== 'all' && (
            <span className="inline-flex items-center gap-1 px-2 py-0.5 font-mono text-[11px] border border-ink">
              {statutLivFilter === 'livree' ? 'Livrées' : 'En attente'}
              <button onClick={() => setStatutLivFilter('all')} className="ml-0.5"><X size={10} /></button>
            </span>
          )}
          <button onClick={() => { setSearch(''); setClientFilter('all'); setFournFilter('all'); setStatutLivFilter('all'); }}
                  className="font-mono text-[10px] uppercase tracking-[0.12em] text-muted underline">
            Tout effacer
          </button>
        </div>
      )}

      <p className="font-mono text-[11px] text-muted mb-3 tnum">
        {filtered.length} {filtered.length > 1 ? 'commandes affichées' : 'commande affichée'}
      </p>

      {/* Table */}
      <div className="border border-ink bg-surface">
        <table className="w-full">
          <thead>
            <tr className="bg-bg border-b border-ink">
              {[
                { key: 'fournisseur', label: 'Fournisseur' },
                { key: 'client',      label: 'Client' },
                { key: 'designation', label: 'Désignation' },
                { key: 'reference',   label: 'Référence' },
                { key: 'coloris',     label: 'Coloris' },
                { key: 'qte',         label: 'Quantité' },
                { key: 'date_cde',    label: 'Date cde' },
                { key: 'date_livraison', label: 'Livraison' },
                { key: '', label: '' },
              ].map((col, i) => (
                <th
                  key={i}
                  className="text-left px-3 py-3 font-mono text-[10px] uppercase tracking-[0.12em] text-muted"
                  style={{ cursor: col.key ? 'pointer' : 'default', userSelect: 'none' }}
                  onClick={() => col.key && toggleSort(col.key)}
                >
                  {col.key ? (
                    <span className="inline-flex items-center gap-1">
                      {col.label}
                      {sortKey === col.key
                        ? (sortDir === 'asc' ? ' ↑' : ' ↓')
                        : <span style={{ color: '#ccc' }}>↕</span>}
                    </span>
                  ) : col.label}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {filtered.map((c, i) => {
              const livree = c.qte_livree && c.qte_livree > 0;
              const url = fournLink(c.fournisseur);
              return (
                <tr key={i} className="group hover:bg-bg border-t border-dotted border-black/30">
                  <td className="px-3 py-3">
                    {url
                      ? <a href={url} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1 font-serif text-[13px] text-ink">
                          {c.fournisseur} <ExternalLink size={10} />
                        </a>
                      : <span className="font-serif text-[13px] text-ink">{c.fournisseur}</span>}
                  </td>
                  <td className="px-3 py-3 font-serif text-[13px] text-ink">{c.client}</td>
                  <td className="px-3 py-3 font-sans text-[12px] text-muted">{c.designation || '—'}</td>
                  <td className="px-3 py-3 font-mono text-[11px] text-muted">{c.reference || '—'}</td>
                  <td className="px-3 py-3 font-sans text-[12px] text-muted">{c.coloris || '—'}</td>
                  <td className="px-3 py-3 font-serif tnum text-[13px] text-ink whitespace-nowrap">
                    {c.qte ? `${c.qte} ${c.unite || 'ml'}` : (c.qte_note || '—')}
                  </td>
                  <td className="px-3 py-3 font-mono tnum text-[11px] text-muted whitespace-nowrap">{formatDate(c.date_cde)}</td>
                  <td className="px-3 py-3">
                    {livree
                      ? <span className="inline-flex items-center gap-1 px-2 py-0.5 font-mono text-[10px] uppercase tracking-[0.1em] bg-ink text-surface">
                          <Check size={10} /> {c.qte_livree} {c.unite || 'ml'}
                        </span>
                      : <span className="inline-flex items-center gap-1 px-2 py-0.5 font-mono text-[10px] uppercase tracking-[0.1em] border border-ink text-muted">
                          <Truck size={10} /> En attente
                        </span>}
                  </td>
                  <td className="px-3 py-3">
                    <div className="opacity-0 group-hover:opacity-100">
                      <button onClick={() => onEdit(c)} title="Modifier" className="p-1.5 text-muted">
                        <Pencil size={13} />
                      </button>
                    </div>
                  </td>
                </tr>
              );
            })}
            {filtered.length === 0 && (
              <tr><td colSpan={9} className="px-4 py-12 text-center font-sans text-[13px] text-muted">Aucune commande ne correspond aux filtres.</td></tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function VueArchives({ dossiers, onEdit }) {
  const [search, setSearch] = useState('');
  const archives = useMemo(() => dossiers.filter(d => d.statut === 'Clos'), [dossiers]);
  const filtered = useMemo(() =>
    archives
      .filter(d => !search || d.nom_dossier.toLowerCase().includes(search.toLowerCase()) || d.client_nom?.toLowerCase().includes(search.toLowerCase()))
      .sort((a, b) => a.nom_dossier.localeCompare(b.nom_dossier, 'fr', { sensitivity: 'base' })),
  [archives, search]);

  return (
    <div>
      {/* En-tête de module */}
      <div className="flex items-end justify-between mb-6">
        <div>
          <Kicker className="mb-2">Module 03</Kicker>
          <h2 className="font-serif text-[36px] tracking-[-0.01em] leading-[1.0] text-ink">Archives</h2>
          <p className="font-sans text-[13px] text-muted mt-1">
            {archives.length} dossiers clos · historique consultable
          </p>
        </div>
      </div>

      {/* Recherche */}
      <div className="relative mb-4">
        <span className="absolute left-3 top-1/2 -translate-y-1/2 font-mono text-muted text-[13px] pointer-events-none">⌕</span>
        <input type="text" value={search} onChange={e => setSearch(e.target.value)}
               placeholder="Rechercher dans les archives…"
               className="w-full pl-8 pr-3 py-2 bg-surface border border-ink font-sans text-[13px] text-ink" />
      </div>

      <p className="font-mono text-[11px] text-muted mb-3 tnum">
        {filtered.length} {filtered.length > 1 ? 'dossiers' : 'dossier'}
      </p>

      {/* Table */}
      <div className="border border-ink bg-surface">
        <table className="w-full">
          <thead>
            <tr className="bg-bg border-b border-ink">
              {['Dossier', 'Type', 'Date', 'Lien dossier', ''].map((h, i) => (
                <th key={i} className="text-left px-4 py-3 font-mono text-[10px] uppercase tracking-[0.12em] text-muted">{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {filtered.map(d => (
              <tr key={d.id} className="cursor-pointer group hover:bg-bg border-t border-dotted border-black/30" onClick={() => onEdit(d)}>
                <td className="px-4 py-3">
                  <p className="font-serif text-[14px] text-ink">{d.nom_dossier}</p>
                  {d.client_nom && d.client_nom !== d.nom_dossier && (
                    <p className="font-sans text-[12px] text-muted mt-0.5">{d.client_nom}</p>
                  )}
                </td>
                <td className="px-4 py-3 font-sans text-[12px] text-muted">{d.type_intervention || '—'}</td>
                <td className="px-4 py-3 font-mono tnum text-[11px] text-muted whitespace-nowrap">{formatDate(d.date_ouverture)}</td>
                <td className="px-4 py-3 font-mono text-[11px] text-muted truncate max-w-md">{d.lien || '—'}</td>
                <td className="px-4 py-3 text-right">
                  <div className="opacity-0 group-hover:opacity-100 text-muted"><Pencil size={14} /></div>
                </td>
              </tr>
            ))}
            {filtered.length === 0 && (
              <tr><td colSpan={5} className="px-4 py-12 text-center font-sans text-[13px] text-muted">Aucun dossier archivé.</td></tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}

export default function Page() {
  const [dossiers, setDossiers]           = useState([]);
  const [commandes, setCommandes]         = useState([]);
  const [fournisseurs, setFournisseurs]   = useState([]);
  const [rideauxFiches, setRideauxFiches] = useState([]);
  const [loading, setLoading]             = useState(true);
  const [editing, setEditing]             = useState(null);
  const [editingCommande, setEditingCommande] = useState(null);
  const [ficheForDossier, setFicheForDossier] = useState(null);
  const [view, setView] = useState('dossiers');

  const openFiche = (d) => setFicheForDossier({
    ...d,
    nom_client: d.client_nom || d.nom_dossier,
    ref_dossier: d.nom_dossier,
  });
  const reload = async () => {
    const [d, c, f, r] = await Promise.all([
      fetch('/api/dossiers').then(r => r.json()),
      fetch('/api/commandes').then(r => r.json()),
      fetch('/api/fournisseurs').then(r => r.json()),
      fetch('/api/interventions-rideaux').then(r => r.json()),
    ]);
    setDossiers(d);
    setCommandes(c);
    setFournisseurs(f);
    setRideauxFiches(Array.isArray(r) ? r : []);
  };

  useEffect(() => {
    reload().finally(() => setLoading(false));
  }, []);

  const handleSave = async (dossier) => {
    if (dossier.id) {
      await fetch(`/api/dossiers/${dossier.id}`, { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(dossier) });
    } else {
      await fetch('/api/dossiers', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(dossier) });
    }
    await reload();
    setEditing(null);
  };

  const handleDelete = async (id) => {
    if (confirm('Supprimer définitivement ce dossier ?')) {
      await fetch(`/api/dossiers/${id}`, { method: 'DELETE' });
      await reload();
      setEditing(null);
    }
  };

  const handleSaveCommande = async (cmd) => {
    if (cmd.id) {
      await fetch(`/api/commandes/${cmd.id}`, { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(cmd) });
    } else {
      await fetch('/api/commandes', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(cmd) });
    }
    await reload();
    setEditingCommande(null);
  };

  const handleDeleteCommande = async (id) => {
    if (confirm('Supprimer définitivement cette commande ?')) {
      await fetch(`/api/commandes/${id}`, { method: 'DELETE' });
      await reload();
      setEditingCommande(null);
    }
  };

  const counts = {
    dossiers: dossiers.filter(d => d.statut !== 'Clos').length,
    commandes: commandes.length,
    archives: dossiers.filter(d => d.statut === 'Clos').length,
  };

  if (loading) return <div className="min-h-screen flex items-center justify-center bg-bg"><p className="font-sans text-[13px] text-muted">Chargement…</p></div>;

  const TABS = [
    { key: 'dossiers',  num: '01', label: 'Atelier TAP',  count: counts.dossiers },
    { key: 'rideaux',   num: '02', label: 'Atelier COUT', count: rideauxFiches.length },
    { key: 'commandes', num: '03', label: 'Commandes',    count: counts.commandes },
    { key: 'archives',  num: '04', label: 'Archives',     count: counts.archives },
    { key: 'heures',    num: '05', label: 'Heures',       count: null },
    { key: 'import',    num: '06', label: 'Export PDF',   count: null },
    { key: 'predevis',  num: '07', label: 'Prédevis',     count: null },
    { key: 'todo',      num: '08', label: 'À faire',      count: null },
  ];

  const now = new Date();
  const DAYS = ['Dim', 'Lun', 'Mar', 'Mer', 'Jeu', 'Ven', 'Sam'];
  const MONTHS = ['jan.', 'fév.', 'mar.', 'avr.', 'mai', 'juin', 'juil.', 'août', 'sep.', 'oct.', 'nov.', 'déc.'];
  const dateStr = `${DAYS[now.getDay()]} ${now.getDate()} ${MONTHS[now.getMonth()]} ${now.getFullYear()}`;
  const startOfYear = new Date(now.getFullYear(), 0, 1);
  const weekNum = Math.ceil(((now - startOfYear) / 86400000 + startOfYear.getDay() + 1) / 7);

  return (
    <div className="min-h-screen bg-bg text-ink">
      <div className="max-w-[1400px] mx-auto px-6">

        {/* Masthead — lettre à en-tête */}
        <header className="pt-6 pb-4 border-b border-ink">
          <div className="flex items-start justify-between">
            {/* Coin gauche — date */}
            <div className="font-mono text-[11px] text-muted leading-relaxed pt-1">
              <p>{dateStr}</p>
              <p>Semaine {weekNum}</p>
            </div>

            {/* Centre — branding */}
            <div className="text-center">
              <Kicker className="mb-1">Gestion · Atelier</Kicker>
              <p className="font-serif text-[34px] leading-none tracking-[-0.01em]">
                Stéphan Hamache
              </p>
              <p className="font-mono text-[10px] uppercase tracking-[0.18em] text-muted mt-1">
                Tapisserie d&apos;ameublement · Poitiers
              </p>
            </div>

            {/* Coin droit — utilisateur */}
            <div className="flex items-center gap-2 pt-1">
              <div className="text-right">
                <p className="font-serif text-[13px] text-ink">Stéphan H.</p>
                <p className="font-mono text-[10px] text-muted uppercase tracking-[0.1em]">Atelier</p>
              </div>
              <div
                className="flex items-center justify-center bg-ink text-surface"
                style={{ width: 36, height: 36 }}
              >
                <span className="font-serif text-[14px]">SH</span>
              </div>
            </div>
          </div>
        </header>

        {/* Nav — 7 modules en blocs égaux */}
        <nav className="flex border-b border-ink mb-8">
          {TABS.map(t => {
            const active = view === t.key;
            return (
              <button
                key={t.key}
                onClick={() => setView(t.key)}
                className={`flex-1 flex flex-col items-center justify-center py-3 border-r border-ink last:border-r-0 ${active ? 'bg-ink text-surface' : 'bg-surface text-ink hover:bg-bg'}`}
              >
                <span className={`font-serif text-[28px] leading-none tnum ${active ? 'text-surface' : 'text-ink'}`}>
                  {t.num}
                </span>
                <span className={`font-sans text-[12px] uppercase tracking-[0.12em] mt-0.5 ${active ? 'text-surface' : 'text-muted'}`}>
                  {t.label}
                </span>
                {t.count !== null && (
                  <span className={`font-mono text-[10px] tnum mt-0.5 ${active ? 'text-surface/70' : 'text-muted'}`}>
                    {t.count}
                  </span>
                )}
              </button>
            );
          })}
          <Link
            href="/stock"
            className="flex flex-col items-center justify-center py-3 px-4 border-l border-ink bg-surface text-ink hover:bg-bg"
          >
            <span className="font-serif text-[28px] leading-none text-muted">⊞</span>
            <span className="font-sans text-[12px] uppercase tracking-[0.12em] mt-0.5 text-muted">Stock</span>
          </Link>
        </nav>

        {view === 'dossiers'  && <VueDossiers dossiers={dossiers} onEdit={setEditing} onNew={() => setEditing({})} onFiche={openFiche} rideauxFiches={rideauxFiches} />}
        {view === 'commandes' && <VueCommandes commandes={commandes} fournisseurs={fournisseurs} onNew={() => setEditingCommande({})} onEdit={setEditingCommande} />}
        {view === 'archives'  && <VueArchives dossiers={dossiers} onEdit={setEditing} />}
        {view === 'heures'    && <HeuresModule />}
        {view === 'import'    && <ImportExportPanel onDataChanged={reload} />}
        {view === 'predevis'  && <PredevisModule />}
        {view === 'rideaux'   && <VueRideaux />}
        {view === 'todo'      && <VueTodo />}

        <footer className="mt-10 pt-4 pb-6 border-t border-ink">
          <p className="font-mono text-[10px] uppercase tracking-[0.12em] text-muted">
            Mode serveur · données partagées entre tous les postes du réseau
          </p>
        </footer>
      </div>

      {editing !== null && <DossierModal dossier={editing} onSave={handleSave} onDelete={handleDelete} onClose={() => setEditing(null)} onReload={reload} />}
      {editingCommande !== null && <CommandeModal commande={editingCommande} fournisseurs={fournisseurs} onSave={handleSaveCommande} onDelete={handleDeleteCommande} onClose={() => setEditingCommande(null)} />}
      {ficheForDossier && <FicheAtelierModal dossier={ficheForDossier} onClose={() => setFicheForDossier(null)} />}

    </div>
  );
}
