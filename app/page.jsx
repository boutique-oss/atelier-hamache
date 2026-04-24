'use client';

import { useState, useEffect, useMemo } from 'react';
import { Search, Plus, Pencil, Trash2, X, Pause, Wrench, Zap, Package, Archive, LayoutGrid, ExternalLink, Truck, Check, Clock, BarChart2, Download, FileText, ClipboardList, Layers, Calculator } from 'lucide-react';
import Link from 'next/link';
import HeuresModule from '../components/HeuresModule';
import ImportExportPanel from '../components/ImportExportPanel';
import ReportsPanel from '../components/ReportsPanel';
import FicheAtelierModal from '../components/FicheAtelierModal';
import CapaciteModule from '../components/CapaciteModule';
import PredevisModule from '../components/PredevisModule';

const STATUTS = ['Nouveau', 'Devis envoyé', 'Validé', 'En atelier', 'Prêt à poser', 'Clos'];
const FLAGS = ['Standby', 'SAV', 'Urgent'];
const TYPES = ['Tapisserie', 'Rideaux', 'Stores', 'Tête de lit', 'Habillage de lit', 'Coussins', 'Pose seule', 'Autre'];

const C = {
  bg: '#F5F5F5', surface: '#FFFFFF', ink: '#000000',
  inkSoft: '#444444', inkMuted: '#888888',
  border: '#000000', borderSoft: '#DDDDDD',
  accent: '#000000', accentSoft: '#EEEEEE',
};

const STATUT_STYLES = {
  'Nouveau':       { bg: '#FFFFFF', text: '#000', dot: '#BBBBBB' },
  'Devis envoyé':  { bg: '#EEEEEE', text: '#000', dot: '#888888' },
  'Validé':        { bg: '#E0E0E0', text: '#000', dot: '#555555' },
  'En atelier':    { bg: '#222222', text: '#FFF', dot: '#FFFFFF' },
  'Prêt à poser':  { bg: '#000000', text: '#FFF', dot: '#FFFFFF' },
  'Clos':          { bg: '#DDDDDD', text: '#666', dot: '#999999' },
};

const FLAG_STYLES = {
  'Standby': { bg: '#EEEEEE', text: '#444444', icon: Pause },
  'SAV':     { bg: '#DDDDDD', text: '#222222', icon: Wrench },
  'Urgent':  { bg: '#FF0000', text: '#FFFFFF', icon: Zap },
};

function StatutBadge({ statut }) {
  const s = STATUT_STYLES[statut] || STATUT_STYLES['Nouveau'];
  return (
    <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md text-xs font-medium whitespace-nowrap" style={{ background: s.bg, color: s.text }}>
      <span className="w-1.5 h-1.5 rounded-full" style={{ background: s.dot }}></span>
      {statut}
    </span>
  );
}

function FlagBadge({ flag }) {
  const s = FLAG_STYLES[flag];
  if (!s) return null;
  const Icon = s.icon;
  return (
    <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-xs font-medium" style={{ background: s.bg, color: s.text }}>
      <Icon size={11} strokeWidth={2.5} /> {flag}
    </span>
  );
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
        <div key={it.key} title={`${it.label} : ${etapes[it.key] ? 'fait' : 'à faire'}`}
             className="w-2.5 h-2.5 rounded-sm"
             style={{ background: etapes[it.key] ? C.accent : 'transparent', border: `1px solid ${etapes[it.key] ? C.accent : C.border}` }}>
        </div>
      ))}
    </div>
  );
}

const formatDate = (d) => {
  if (!d) return '—';
  const [y, m, day] = d.split('-');
  return `${day}/${m}/${y}`;
};

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
      <div className="w-full max-w-2xl max-h-[90vh] overflow-y-auto"
           style={{ background: C.surface, border: `1px solid ${C.border}` }} onClick={e => e.stopPropagation()}>
        <div className="flex items-center justify-between px-6 py-4" style={{ borderBottom: `1px solid ${C.borderSoft}` }}>
          <div>
            <h2 style={{ fontFamily: "'Fraunces', serif", fontSize: 20, fontWeight: 500, color: C.ink }}>
              {isNew ? 'Nouveau dossier' : d.nom_dossier}
            </h2>
            <p className="text-xs mt-0.5" style={{ color: C.inkMuted }}>
              {isNew ? 'Saisis les informations principales' : 'Modifier ce dossier'}
            </p>
          </div>
          <button onClick={onClose} className="p-1.5 rounded-md hover:bg-stone-100"><X size={18} style={{ color: C.inkSoft }} /></button>
        </div>

        <div className="px-6 py-5 space-y-5">
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-medium mb-1.5" style={{ color: C.inkSoft }}>Nom du dossier *</label>
              <input type="text" value={d.nom_dossier} onChange={e => update('nom_dossier', e.target.value)}
                     className="w-full px-3 py-2 rounded-md text-sm" style={{ background: C.bg, border: `1px solid ${C.border}`, color: C.ink }} />
            </div>
            <div>
              <label className="block text-xs font-medium mb-1.5" style={{ color: C.inkSoft }}>Type d'intervention</label>
              <select value={d.type_intervention} onChange={e => update('type_intervention', e.target.value)}
                      className="w-full px-3 py-2 rounded-md text-sm" style={{ background: C.bg, border: `1px solid ${C.border}`, color: C.ink }}>
                {TYPES.map(t => <option key={t} value={t}>{t}</option>)}
              </select>
            </div>
          </div>

          {/* Heures prévues (devis) */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-medium mb-1.5" style={{ color: C.inkSoft }}>Heures prévues (devis)</label>
              <input type="number" step="0.5" min="0" placeholder="ex: 8.5"
                     value={d.heures_a_realiser || ''}
                     onChange={e => update('heures_a_realiser', parseFloat(e.target.value) || 0)}
                     className="w-full px-3 py-2 rounded-md text-sm" style={{ background: C.bg, border: `1px solid ${C.border}`, color: C.ink }} />
              <p className="text-xs mt-1" style={{ color: C.inkMuted }}>Sera comparé aux heures saisies réellement</p>
            </div>
            <div>
              <label className="block text-xs font-medium mb-1.5" style={{ color: C.inkSoft }}>Date d'ouverture</label>
              <input type="date" value={d.date_ouverture || ''} onChange={e => update('date_ouverture', e.target.value)}
                     className="w-full px-3 py-2 rounded-md text-sm" style={{ background: C.bg, border: `1px solid ${C.border}`, color: C.ink }} />
            </div>
          </div>

          <div>
            <label className="block text-xs font-medium mb-1.5" style={{ color: C.inkSoft }}>Statut dans le pipeline</label>
            <div className="grid grid-cols-3 gap-2">
              {STATUTS.map(s => {
                const style = STATUT_STYLES[s]; const active = d.statut === s;
                return (
                  <button key={s} type="button" onClick={() => update('statut', s)}
                          className="flex items-center gap-2 px-3 py-2 rounded-md text-xs font-medium"
                          style={{ background: active ? style.bg : 'transparent', color: active ? style.text : C.inkSoft, border: `1px solid ${active ? style.dot : C.border}` }}>
                    <span className="w-1.5 h-1.5 rounded-full" style={{ background: style.dot }}></span>{s}
                  </button>
                );
              })}
            </div>
          </div>

          <div>
            <label className="block text-xs font-medium mb-1.5" style={{ color: C.inkSoft }}>Flags (cumulables)</label>
            <div className="flex gap-2 flex-wrap">
              {FLAGS.map(f => {
                const style = FLAG_STYLES[f]; const Icon = style.icon; const active = d.flags.includes(f);
                return (
                  <button key={f} type="button" onClick={() => toggleFlag(f)}
                          className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-medium"
                          style={{ background: active ? style.bg : 'transparent', color: active ? style.text : C.inkSoft, border: `1px solid ${active ? style.text : C.border}` }}>
                    <Icon size={12} strokeWidth={2.5} /> {f}
                  </button>
                );
              })}
            </div>
          </div>

          <div>
            <label className="block text-xs font-medium mb-2" style={{ color: C.inkSoft }}>Jalons d'avancement</label>
            <div className="grid grid-cols-5 gap-2">
              {[
                { key: 'devis', label: 'Devis signé' }, { key: 'cmde', label: 'Commande' },
                { key: 'atelier', label: 'Fiche atelier' }, { key: 'print', label: 'Print' },
                { key: 'realise', label: 'Réalisé' },
              ].map(it => (
                <label key={it.key} className="flex items-center gap-2 px-2.5 py-2 rounded-md cursor-pointer text-xs"
                       style={{ background: C.bg, border: `1px solid ${d.etapes[it.key] ? C.accent : C.border}` }}>
                  <input type="checkbox" checked={d.etapes[it.key]} onChange={e => updateEtape(it.key, e.target.checked)} style={{ accentColor: C.accent }} />
                  <span style={{ color: d.etapes[it.key] ? C.ink : C.inkSoft }}>{it.label}</span>
                </label>
              ))}
            </div>
          </div>

          <div className="pt-3" style={{ borderTop: `1px solid ${C.borderSoft}` }}>
            <p className="text-xs font-medium mb-3" style={{ color: C.inkSoft }}>Coordonnées client</p>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-xs mb-1" style={{ color: C.inkMuted }}>Téléphone</label>
                <input type="text" value={d.telephone} onChange={e => update('telephone', e.target.value)}
                       className="w-full px-3 py-2 rounded-md text-sm" style={{ background: C.bg, border: `1px solid ${C.border}`, color: C.ink }} />
              </div>
              <div>
                <label className="block text-xs mb-1" style={{ color: C.inkMuted }}>Email</label>
                <input type="email" value={d.email} onChange={e => update('email', e.target.value)}
                       className="w-full px-3 py-2 rounded-md text-sm" style={{ background: C.bg, border: `1px solid ${C.border}`, color: C.ink }} />
              </div>
              <div className="col-span-2">
                <label className="block text-xs mb-1" style={{ color: C.inkMuted }}>Adresse</label>
                <input type="text" value={d.adresse} onChange={e => update('adresse', e.target.value)}
                       className="w-full px-3 py-2 rounded-md text-sm" style={{ background: C.bg, border: `1px solid ${C.border}`, color: C.ink }} />
              </div>
            </div>
          </div>

          <div>
            <label className="block text-xs font-medium mb-1.5" style={{ color: C.inkSoft }}>Lien dossier OneDrive</label>
            <input type="text" value={d.lien} onChange={e => update('lien', e.target.value)} placeholder="%ONEDRIVE%\..."
                   className="w-full px-3 py-2 rounded-md text-sm font-mono" style={{ background: C.bg, border: `1px solid ${C.border}`, color: C.ink }} />
          </div>

          <div>
            <label className="block text-xs font-medium mb-1.5" style={{ color: C.inkSoft }}>Commentaires</label>
            <textarea value={d.comm} onChange={e => update('comm', e.target.value)} rows={3}
                      className="w-full px-3 py-2 rounded-md text-sm resize-none" style={{ background: C.bg, border: `1px solid ${C.border}`, color: C.ink }} />
          </div>

          {/* ── Fiche PDF ── */}
          <div className="pt-3" style={{ borderTop: `1px solid ${C.borderSoft}` }}>
            <label className="block text-xs font-medium mb-2" style={{ color: C.inkSoft }}>
              <FileText size={12} style={{ display: 'inline', marginRight: 4 }} />
              Fiche PDF
            </label>
            {isNew ? (
              <p className="text-xs" style={{ color: C.inkMuted }}>Disponible après création du dossier.</p>
            ) : d.fiche_pdf ? (
              <div className="flex items-center gap-2 flex-wrap">
                <a href={`/api/pdf?dossier_id=${d.id}`} target="_blank" rel="noreferrer"
                   className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium"
                   style={{ background: C.ink, color: C.surface }}>
                  <FileText size={12} /> Ouvrir la fiche
                </a>
                <label className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs cursor-pointer"
                       style={{ border: `1px solid ${C.border}`, color: C.inkSoft }}>
                  <input type="file" accept=".pdf" className="hidden"
                         onChange={e => uploadPdf(e.target.files[0])} />
                  Remplacer
                </label>
                <button onClick={deletePdf} className="px-3 py-1.5 text-xs"
                        style={{ border: '1px solid #000', color: '#000' }}>
                  Supprimer
                </button>
                {pdfLoading && <span className="text-xs" style={{ color: C.inkMuted }}>Envoi…</span>}
              </div>
            ) : (
              <div className="flex items-center gap-2">
                <label className="inline-flex items-center gap-2 px-3 py-2 text-xs cursor-pointer"
                       style={{ border: `1px solid ${C.border}`, color: C.inkSoft }}>
                  <input type="file" accept=".pdf" className="hidden"
                         onChange={e => uploadPdf(e.target.files[0])} />
                  <FileText size={12} /> Joindre une fiche PDF
                </label>
                {pdfLoading && <span className="text-xs" style={{ color: C.inkMuted }}>Envoi…</span>}
              </div>
            )}
          </div>
        </div>

        <div className="px-6 py-4 flex items-center justify-between" style={{ borderTop: `1px solid ${C.borderSoft}`, background: C.bg }}>
          <div>
            {!isNew && (
              <button onClick={() => onDelete(d.id)} className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium" style={{ color: '#000', border: '1px solid #000' }}>
                <Trash2 size={12} /> Supprimer
              </button>
            )}
          </div>
          <div className="flex gap-2">
            <button onClick={onClose} className="px-4 py-1.5 rounded-md text-sm font-medium" style={{ color: C.inkSoft, border: `1px solid ${C.border}` }}>Annuler</button>
            <button onClick={handleSubmit} disabled={!d.nom_dossier.trim()} className="px-4 py-1.5 rounded-md text-sm font-medium disabled:opacity-40" style={{ background: C.ink, color: C.bg }}>
              {isNew ? 'Créer le dossier' : 'Enregistrer'}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

function VueDossiers({ dossiers, onEdit, onNew, onFiche }) {
  const [search, setSearch] = useState('');
  const [statutFilter, setStatutFilter] = useState('all');
  const [typeFilter, setTypeFilter] = useState('all');
  const [flagFilter, setFlagFilter] = useState('all');

  const actifs = useMemo(() => dossiers.filter(d => d.statut !== 'Clos'), [dossiers]);

  const filtered = useMemo(() => {
    return actifs.filter(d => {
      if (search && !d.nom_dossier.toLowerCase().includes(search.toLowerCase()) && !d.client_nom.toLowerCase().includes(search.toLowerCase())) return false;
      if (statutFilter !== 'all' && d.statut !== statutFilter) return false;
      if (typeFilter !== 'all' && d.type_intervention !== typeFilter) return false;
      if (flagFilter !== 'all' && !d.flags.includes(flagFilter)) return false;
      return true;
    }).sort((a, b) => {
      const sa = STATUTS.indexOf(a.statut), sb = STATUTS.indexOf(b.statut);
      if (sa !== sb) return sa - sb;
      return (b.date_ouverture || '').localeCompare(a.date_ouverture || '');
    });
  }, [actifs, search, statutFilter, typeFilter, flagFilter]);

  const stats = useMemo(() => {
    const out = {};
    STATUTS.filter(s => s !== 'Clos').forEach(s => out[s] = actifs.filter(d => d.statut === s).length);
    return out;
  }, [actifs]);

  return (
    <div>
      <div className="flex items-end justify-between mb-6">
        <div>
          <h2 style={{ fontFamily: "'Fraunces', serif", fontSize: 28, fontWeight: 500, color: C.ink, lineHeight: 1.1 }}>Dossiers actifs</h2>
          <p className="text-sm mt-1" style={{ color: C.inkSoft }}>{actifs.length} dossiers en cours · pipeline atelier</p>
        </div>
        <button onClick={onNew} className="inline-flex items-center gap-2 px-4 py-2.5 rounded-md text-sm font-medium" style={{ background: C.ink, color: C.bg }}>
          <Plus size={16} strokeWidth={2.5} /> Nouveau dossier
        </button>
      </div>

      <div className="grid grid-cols-5 gap-2 mb-6">
        {STATUTS.filter(s => s !== 'Clos').map(s => {
          const style = STATUT_STYLES[s], count = stats[s] || 0, isActive = statutFilter === s;
          return (
            <button key={s} onClick={() => setStatutFilter(isActive ? 'all' : s)}
                    className="text-left p-4 rounded-lg" style={{ background: isActive ? style.bg : C.surface, border: `1px solid ${isActive ? style.dot : C.border}` }}>
              <div className="flex items-center gap-1.5 mb-2">
                <span className="w-1.5 h-1.5 rounded-full" style={{ background: style.dot }}></span>
                <p className="text-xs" style={{ color: C.inkSoft }}>{s}</p>
              </div>
              <p style={{ fontFamily: "'Fraunces', serif", fontSize: 26, fontWeight: 500, color: style.text, lineHeight: 1 }}>{count}</p>
            </button>
          );
        })}
      </div>

      <div className="flex gap-2 mb-3">
        <div className="relative flex-1">
          <Search size={14} style={{ color: C.inkMuted, position: 'absolute', left: 12, top: '50%', transform: 'translateY(-50%)' }} />
          <input type="text" value={search} onChange={e => setSearch(e.target.value)} placeholder="Rechercher un dossier ou un client…"
                 className="w-full pl-9 pr-3 py-2 rounded-md text-sm" style={{ background: C.surface, border: `1px solid ${C.border}`, color: C.ink }} />
        </div>
        <select value={typeFilter} onChange={e => setTypeFilter(e.target.value)} className="px-3 py-2 rounded-md text-sm" style={{ background: C.surface, border: `1px solid ${C.border}`, color: C.ink, minWidth: 160 }}>
          <option value="all">Tous types</option>
          {TYPES.map(t => <option key={t} value={t}>{t}</option>)}
        </select>
        <select value={flagFilter} onChange={e => setFlagFilter(e.target.value)} className="px-3 py-2 rounded-md text-sm" style={{ background: C.surface, border: `1px solid ${C.border}`, color: C.ink, minWidth: 140 }}>
          <option value="all">Tous flags</option>
          {FLAGS.map(f => <option key={f} value={f}>{f}</option>)}
        </select>
      </div>

      <p className="text-xs mb-3" style={{ color: C.inkMuted }}>{filtered.length} {filtered.length > 1 ? 'dossiers affichés' : 'dossier affiché'}</p>

      <div className="rounded-lg overflow-hidden" style={{ background: C.surface, border: `1px solid ${C.border}` }}>
        <table className="w-full">
          <thead>
            <tr style={{ background: C.bg, borderBottom: `1px solid ${C.border}` }}>
              {['Dossier','Statut','Type','Avancement','Date','H. prévues','Flags',''].map((h,i) => (
                <th key={i} className="text-left px-4 py-3 text-xs font-medium uppercase" style={{ color: C.inkMuted, letterSpacing: '0.05em' }}>{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {filtered.map(d => (
              <tr key={d.id} className="group hover:bg-neutral-50" style={{ borderTop: `1px solid ${C.borderSoft}` }}>
                <td className="px-4 py-3 cursor-pointer" onClick={() => onEdit(d)}><p className="font-medium text-sm" style={{ color: C.ink }}>{d.nom_dossier}</p></td>
                <td className="px-4 py-3 cursor-pointer" onClick={() => onEdit(d)}><StatutBadge statut={d.statut} /></td>
                <td className="px-4 py-3 text-xs cursor-pointer" style={{ color: C.inkSoft }} onClick={() => onEdit(d)}>{d.type_intervention || '—'}</td>
                <td className="px-4 py-3 cursor-pointer" onClick={() => onEdit(d)}><EtapesDots etapes={d.etapes} /></td>
                <td className="px-4 py-3 text-xs whitespace-nowrap cursor-pointer" style={{ color: C.inkSoft }} onClick={() => onEdit(d)}>{formatDate(d.date_ouverture)}</td>
                <td className="px-4 py-3 text-xs cursor-pointer" style={{ color: d.heures_a_realiser > 0 ? C.accent : C.inkMuted, fontWeight: d.heures_a_realiser > 0 ? 600 : 400 }} onClick={() => onEdit(d)}>
                  {d.heures_a_realiser > 0 ? `${d.heures_a_realiser}h` : '—'}
                </td>
                <td className="px-4 py-3 cursor-pointer" onClick={() => onEdit(d)}><div className="flex flex-wrap gap-1">{d.flags.map(f => <FlagBadge key={f} flag={f} />)}</div></td>
                <td className="px-4 py-3">
                  <div className="opacity-0 group-hover:opacity-100 flex items-center gap-1">
                    {d.fiche_pdf && (
                      <a href={`/api/pdf?dossier_id=${d.id}`} target="_blank" rel="noreferrer"
                         onClick={e => e.stopPropagation()} title="Voir la fiche PDF"
                         className="p-1.5" style={{ color: C.inkSoft }}>
                        <FileText size={13} />
                      </a>
                    )}
                    <button onClick={e => { e.stopPropagation(); onFiche(d); }} title="Fiche atelier"
                      className="p-1.5" style={{ color: C.inkSoft }}>
                      <ClipboardList size={13} />
                    </button>
                    <button onClick={() => onEdit(d)} title="Modifier"
                      className="p-1.5" style={{ color: C.inkSoft }}>
                      <Pencil size={13} />
                    </button>
                  </div>
                </td>
              </tr>
            ))}
            {filtered.length === 0 && <tr><td colSpan={8} className="px-4 py-12 text-center text-sm" style={{ color: C.inkMuted }}>Aucun dossier ne correspond aux filtres.</td></tr>}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function VueCommandes({ commandes, fournisseurs }) {
  const [search, setSearch] = useState('');
  const [fournFilter, setFournFilter] = useState('all');
  const [statutLivFilter, setStatutLivFilter] = useState('all');

  const fournUniques = useMemo(() => [...new Set(commandes.map(c => c.fournisseur))].sort(), [commandes]);

  const filtered = useMemo(() => {
    return commandes.filter(c => {
      if (search && !c.client.toLowerCase().includes(search.toLowerCase()) && !c.designation.toLowerCase().includes(search.toLowerCase()) && !c.reference.toLowerCase().includes(search.toLowerCase())) return false;
      if (fournFilter !== 'all' && c.fournisseur !== fournFilter) return false;
      const livree = c.qte_livree && c.qte_livree > 0;
      if (statutLivFilter === 'livree' && !livree) return false;
      if (statutLivFilter === 'attente' && livree) return false;
      return true;
    });
  }, [commandes, search, fournFilter, statutLivFilter]);

  const stats = useMemo(() => {
    const livrees = commandes.filter(c => c.qte_livree && c.qte_livree > 0).length;
    const totalMl = commandes.reduce((s, c) => s + (c.qte || 0), 0);
    return { total: commandes.length, livrees, attente: commandes.length - livrees, ml: Math.round(totalMl * 10) / 10 };
  }, [commandes]);

  const fournLink = (nom) => fournisseurs.find(f => f.nom === nom)?.url;

  return (
    <div>
      <div className="flex items-end justify-between mb-6">
        <div>
          <h2 style={{ fontFamily: "'Fraunces', serif", fontSize: 28, fontWeight: 500, color: C.ink, lineHeight: 1.1 }}>Commandes</h2>
          <p className="text-sm mt-1" style={{ color: C.inkSoft }}>{commandes.length} commandes · {fournUniques.length} fournisseurs</p>
        </div>
      </div>

      <div className="grid grid-cols-4 gap-2 mb-6">
        <div className="p-4 rounded-lg" style={{ background: C.surface, border: `1px solid ${C.border}` }}>
          <p className="text-xs mb-2" style={{ color: C.inkSoft }}>Total commandes</p>
          <p style={{ fontFamily: "'Fraunces', serif", fontSize: 26, fontWeight: 500, color: C.ink, lineHeight: 1 }}>{stats.total}</p>
        </div>
        <button onClick={() => setStatutLivFilter(statutLivFilter === 'attente' ? 'all' : 'attente')} className="text-left p-4" style={{ background: statutLivFilter === 'attente' ? '#000' : C.surface, border: `1px solid ${statutLivFilter === 'attente' ? '#000' : C.borderSoft}`, color: statutLivFilter === 'attente' ? '#FFF' : C.ink }}>
          <div className="flex items-center gap-1.5 mb-2"><Truck size={11} /><p className="text-xs">En attente</p></div>
          <p style={{ fontFamily: "'Fraunces', serif", fontSize: 26, fontWeight: 500, lineHeight: 1 }}>{stats.attente}</p>
        </button>
        <button onClick={() => setStatutLivFilter(statutLivFilter === 'livree' ? 'all' : 'livree')} className="text-left p-4" style={{ background: statutLivFilter === 'livree' ? '#000' : C.surface, border: `1px solid ${statutLivFilter === 'livree' ? '#000' : C.borderSoft}`, color: statutLivFilter === 'livree' ? '#FFF' : C.ink }}>
          <div className="flex items-center gap-1.5 mb-2"><Check size={11} /><p className="text-xs">Livrées</p></div>
          <p style={{ fontFamily: "'Fraunces', serif", fontSize: 26, fontWeight: 500, lineHeight: 1 }}>{stats.livrees}</p>
        </button>
        <div className="p-4 rounded-lg" style={{ background: C.accentSoft, border: `1px solid ${C.accent}` }}>
          <p className="text-xs mb-2" style={{ color: C.inkSoft }}>Total commandé</p>
          <p style={{ fontFamily: "'Fraunces', serif", fontSize: 26, fontWeight: 500, color: C.accent, lineHeight: 1 }}>{stats.ml}<span className="text-sm ml-1">ml</span></p>
        </div>
      </div>

      <div className="flex gap-2 mb-3">
        <div className="relative flex-1">
          <Search size={14} style={{ color: C.inkMuted, position: 'absolute', left: 12, top: '50%', transform: 'translateY(-50%)' }} />
          <input type="text" value={search} onChange={e => setSearch(e.target.value)} placeholder="Rechercher client, désignation, référence…"
                 className="w-full pl-9 pr-3 py-2 rounded-md text-sm" style={{ background: C.surface, border: `1px solid ${C.border}`, color: C.ink }} />
        </div>
        <select value={fournFilter} onChange={e => setFournFilter(e.target.value)} className="px-3 py-2 rounded-md text-sm" style={{ background: C.surface, border: `1px solid ${C.border}`, color: C.ink, minWidth: 200 }}>
          <option value="all">Tous fournisseurs ({fournUniques.length})</option>
          {fournUniques.map(f => <option key={f} value={f}>{f}</option>)}
        </select>
      </div>

      <p className="text-xs mb-3" style={{ color: C.inkMuted }}>{filtered.length} {filtered.length > 1 ? 'commandes affichées' : 'commande affichée'}</p>

      <div className="rounded-lg overflow-hidden" style={{ background: C.surface, border: `1px solid ${C.border}` }}>
        <table className="w-full">
          <thead>
            <tr style={{ background: C.bg, borderBottom: `1px solid ${C.border}` }}>
              {['Fournisseur','Client','Désignation','Référence','Coloris','Quantité','Date cde','Livraison'].map((h,i) => (
                <th key={i} className="text-left px-3 py-3 text-xs font-medium uppercase" style={{ color: C.inkMuted, letterSpacing: '0.05em' }}>{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {filtered.map((c, i) => {
              const livree = c.qte_livree && c.qte_livree > 0;
              const url = fournLink(c.fournisseur);
              return (
                <tr key={i} className="hover:bg-stone-50" style={{ borderTop: `1px solid ${C.borderSoft}` }}>
                  <td className="px-3 py-3 text-xs">
                    {url ? <a href={url} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1 font-medium" style={{ color: C.accent }}>{c.fournisseur} <ExternalLink size={10} /></a> : <span className="font-medium" style={{ color: C.ink }}>{c.fournisseur}</span>}
                  </td>
                  <td className="px-3 py-3 text-xs font-medium" style={{ color: C.ink }}>{c.client}</td>
                  <td className="px-3 py-3 text-xs" style={{ color: C.inkSoft }}>{c.designation || '—'}</td>
                  <td className="px-3 py-3 text-xs font-mono" style={{ color: C.inkSoft }}>{c.reference || '—'}</td>
                  <td className="px-3 py-3 text-xs" style={{ color: C.inkSoft }}>{c.coloris || '—'}</td>
                  <td className="px-3 py-3 text-xs whitespace-nowrap" style={{ color: C.ink }}>{c.qte ? `${c.qte} ${c.unite || 'ml'}` : (c.qte_note || '—')}</td>
                  <td className="px-3 py-3 text-xs whitespace-nowrap" style={{ color: C.inkSoft }}>{formatDate(c.date_cde)}</td>
                  <td className="px-3 py-3 text-xs">
                    {livree ? <span className="inline-flex items-center gap-1 px-2 py-0.5 text-xs font-medium" style={{ background: '#000', color: '#FFF' }}><Check size={10} /> {c.qte_livree} ml</span>
                            : <span className="inline-flex items-center gap-1 px-2 py-0.5 text-xs font-medium" style={{ background: '#EEE', color: '#000' }}><Truck size={10} /> En attente</span>}
                  </td>
                </tr>
              );
            })}
            {filtered.length === 0 && <tr><td colSpan={8} className="px-4 py-12 text-center text-sm" style={{ color: C.inkMuted }}>Aucune commande ne correspond aux filtres.</td></tr>}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function VueArchives({ dossiers, onEdit }) {
  const [search, setSearch] = useState('');
  const archives = useMemo(() => dossiers.filter(d => d.statut === 'Clos'), [dossiers]);
  const filtered = useMemo(() => archives.filter(d => !search || d.nom_dossier.toLowerCase().includes(search.toLowerCase()) || d.client_nom.toLowerCase().includes(search.toLowerCase())), [archives, search]);

  return (
    <div>
      <div className="flex items-end justify-between mb-6">
        <div>
          <h2 style={{ fontFamily: "'Fraunces', serif", fontSize: 28, fontWeight: 500, color: C.ink, lineHeight: 1.1 }}>Archives</h2>
          <p className="text-sm mt-1" style={{ color: C.inkSoft }}>{archives.length} dossiers clos · historique consultable</p>
        </div>
      </div>

      <div className="relative mb-4">
        <Search size={14} style={{ color: C.inkMuted, position: 'absolute', left: 12, top: '50%', transform: 'translateY(-50%)' }} />
        <input type="text" value={search} onChange={e => setSearch(e.target.value)} placeholder="Rechercher dans les archives…"
               className="w-full pl-9 pr-3 py-2 rounded-md text-sm" style={{ background: C.surface, border: `1px solid ${C.border}`, color: C.ink }} />
      </div>

      <div className="rounded-lg overflow-hidden" style={{ background: C.surface, border: `1px solid ${C.border}` }}>
        <table className="w-full">
          <thead>
            <tr style={{ background: C.bg, borderBottom: `1px solid ${C.border}` }}>
              {['Dossier','Type','Date','Lien dossier',''].map((h,i) => (
                <th key={i} className="text-left px-4 py-3 text-xs font-medium uppercase" style={{ color: C.inkMuted, letterSpacing: '0.05em' }}>{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {filtered.map(d => (
              <tr key={d.id} className="cursor-pointer group hover:bg-stone-50" style={{ borderTop: `1px solid ${C.borderSoft}` }} onClick={() => onEdit(d)}>
                <td className="px-4 py-3"><p className="font-medium text-sm" style={{ color: C.ink }}>{d.nom_dossier}</p></td>
                <td className="px-4 py-3 text-xs" style={{ color: C.inkSoft }}>{d.type_intervention || '—'}</td>
                <td className="px-4 py-3 text-xs whitespace-nowrap" style={{ color: C.inkSoft }}>{formatDate(d.date_ouverture)}</td>
                <td className="px-4 py-3 text-xs font-mono truncate max-w-md" style={{ color: C.inkMuted }}>{d.lien || '—'}</td>
                <td className="px-4 py-3 text-right"><div className="opacity-0 group-hover:opacity-100"><Pencil size={14} style={{ color: C.inkSoft }} /></div></td>
              </tr>
            ))}
            {filtered.length === 0 && <tr><td colSpan={5} className="px-4 py-12 text-center text-sm" style={{ color: C.inkMuted }}>Aucun dossier archivé.</td></tr>}
          </tbody>
        </table>
      </div>
    </div>
  );
}

export default function Page() {
  const [dossiers, setDossiers] = useState([]);
  const [commandes, setCommandes] = useState([]);
  const [fournisseurs, setFournisseurs] = useState([]);
  const [loading, setLoading] = useState(true);
  const [editing, setEditing] = useState(null);
  const [ficheForDossier, setFicheForDossier] = useState(null);
  const [view, setView] = useState('dossiers');

  const openFiche = (d) => setFicheForDossier({
    ...d,
    nom_client: d.client_nom || d.nom_dossier,
    ref_dossier: d.nom_dossier,
  });
  const reload = async () => {
    const [d, c, f] = await Promise.all([
      fetch('/api/dossiers').then(r => r.json()),
      fetch('/api/commandes').then(r => r.json()),
      fetch('/api/fournisseurs').then(r => r.json()),
    ]);
    setDossiers(d);
    setCommandes(c);
    setFournisseurs(f);
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

  const counts = {
    dossiers: dossiers.filter(d => d.statut !== 'Clos').length,
    commandes: commandes.length,
    archives: dossiers.filter(d => d.statut === 'Clos').length,
  };

  if (loading) return <div className="min-h-screen flex items-center justify-center" style={{ background: C.bg }}><p style={{ color: C.inkSoft }}>Chargement…</p></div>;

  const TABS = [
    { key: 'dossiers',  label: 'Dossiers',        icon: LayoutGrid, count: counts.dossiers },
    { key: 'commandes', label: 'Commandes',        icon: Package,    count: counts.commandes },
    { key: 'archives',  label: 'Archives',         icon: Archive,    count: counts.archives },
    { key: 'heures',    label: 'Heures',           icon: Clock,      count: null },
    { key: 'rapports',  label: 'Rapports',         icon: BarChart2,  count: null },
    { key: 'import',    label: 'Export PDF',        icon: Download,   count: null },
    { key: 'predevis',  label: 'Prédevis',          icon: Calculator, count: null },
  ];

  return (
    <div className="min-h-screen" style={{ background: C.bg, color: C.ink }}>
      <div className="max-w-7xl mx-auto px-6 py-8">
        <header className="flex items-end justify-between mb-2">
          <p className="text-xs uppercase tracking-widest" style={{ color: C.accent, letterSpacing: '0.15em' }}>Atelier Stéphan Hamache</p>
          <p className="text-xs" style={{ color: C.inkMuted }}>Connecté à la base atelier.db</p>
        </header>

        <nav className="flex items-center gap-1 mb-8 pb-1 flex-wrap" style={{ borderBottom: `1px solid ${C.border}` }}>
          {TABS.map(t => {
            const Icon = t.icon, active = view === t.key;
            return (
              <button key={t.key} onClick={() => setView(t.key)}
                      className="inline-flex items-center gap-2 px-4 py-2.5 text-sm font-medium relative"
                      style={{ color: active ? C.ink : C.inkSoft, borderBottom: active ? `2px solid ${C.accent}` : '2px solid transparent', marginBottom: '-1px' }}>
                <Icon size={15} /> {t.label}
                {t.count !== null && (
                  <span className="text-xs px-1.5 py-0.5 rounded" style={{ background: active ? C.accentSoft : C.borderSoft, color: active ? C.accent : C.inkMuted }}>{t.count}</span>
                )}
              </button>
            );
          })}
          <Link href="/stock"
                className="inline-flex items-center gap-2 px-4 py-2.5 text-sm font-medium relative ml-auto"
                style={{ color: C.inkSoft, borderBottom: '2px solid transparent', marginBottom: '-1px' }}>
            <Layers size={15} /> Stock Kanban
          </Link>
        </nav>

        {view === 'dossiers'  && <VueDossiers dossiers={dossiers} onEdit={setEditing} onNew={() => setEditing({})} onFiche={openFiche} />}
        {view === 'commandes' && <VueCommandes commandes={commandes} fournisseurs={fournisseurs} />}
        {view === 'archives'  && <VueArchives dossiers={dossiers} onEdit={setEditing} />}
        {view === 'heures'    && <HeuresModule />}
        {view === 'rapports'  && <ReportsPanel />}
        {view === 'import'    && <ImportExportPanel onDataChanged={reload} />}
        {view === 'predevis'  && <PredevisModule />}

        <footer className="mt-10 pt-6" style={{ borderTop: `1px solid ${C.border}` }}>
          <p className="text-xs" style={{ color: C.inkMuted }}>Mode serveur · données partagées entre tous les postes du réseau</p>
        </footer>
      </div>

      {editing !== null && <DossierModal dossier={editing} onSave={handleSave} onDelete={handleDelete} onClose={() => setEditing(null)} onReload={reload} />}
      {ficheForDossier && <FicheAtelierModal dossier={ficheForDossier} onClose={() => setFicheForDossier(null)} />}

      <CapaciteModule />
    </div>
  );
}
