'use client';

import { useState, useEffect } from 'react';
import { Plus, Pencil, Trash2, X, Printer, ChevronDown, ChevronRight } from 'lucide-react';
import Kicker from './ui/Kicker';
import Btn from './ui/Btn';

const TYPES = [
  'Tapisserie', 'Rideaux', 'Stores',
  'Tête de lit', 'Habillage de lit', 'Coussins',
  'Galettes', 'Tenture murale', 'Pose seule', 'Autre',
];

const labelCls = 'font-mono uppercase tracking-[0.16em] text-[10px] text-muted block mb-1';
const inputCls = 'w-full px-3 py-2 bg-bg border border-ink font-sans text-[13px] text-ink';

function formatDate(d) {
  if (!d) return '—';
  const [y, m, day] = d.split('-');
  return `${day}/${m}/${y}`;
}

// ─── Grouper par section ──────────────────────────────────────────────────────
function groupBySection(schema) {
  const groups = [];
  let current = null;
  for (const field of schema) {
    if (field.sectionTitle) {
      current = { title: field.sectionTitle, fields: [field] };
      groups.push(current);
    } else if (current) {
      current.fields.push(field);
    } else {
      current = { title: null, fields: [field] };
      groups.push(current);
    }
  }
  return groups;
}

// ─── Champ dynamique selon type ───────────────────────────────────────────────
function DynField({ field, value, onChange }) {
  const val = value ?? '';

  if (field.type === 'textarea') {
    return (
      <textarea
        value={val}
        onChange={e => onChange(field.key, e.target.value)}
        rows={3}
        placeholder={field.hint || ''}
        className="w-full px-3 py-2 bg-bg border border-ink font-sans text-[13px] text-ink resize-none"
      />
    );
  }
  if (field.type === 'select') {
    return (
      <select value={val} onChange={e => onChange(field.key, e.target.value)} className={inputCls}>
        <option value="">—</option>
        {field.options.map(o => <option key={o} value={o}>{o}</option>)}
      </select>
    );
  }
  return (
    <div className="flex items-center gap-2">
      <input
        type={field.type === 'number' ? 'number' : 'text'}
        value={val}
        onChange={e => onChange(field.key, e.target.value)}
        placeholder={field.hint || ''}
        className={inputCls}
      />
      {field.unit && <span className="font-mono text-[11px] text-muted whitespace-nowrap">{field.unit}</span>}
    </div>
  );
}

// ─── Modal éditeur ────────────────────────────────────────────────────────────
function FicheModal({ fiche, schemas, onSave, onDelete, onClose }) {
  const isNew = !fiche.id;

  const initContenu = (() => {
    try { return typeof fiche.contenu_json === 'string' ? JSON.parse(fiche.contenu_json) : (fiche.contenu_json || {}); }
    catch { return {}; }
  })();

  const [type, setType]           = useState(fiche.type_intervention || '');
  const [contenu, setContenu]     = useState(initContenu);
  const [notes, setNotes]         = useState(fiche.notes_libres || '');
  const [saving, setSaving]       = useState(false);
  const [collapsed, setCollapsed] = useState({});
  const [etapes, setEtapes]           = useState(Array.isArray(initContenu.etapes_custom) ? initContenu.etapes_custom : []);
  const [tissus, setTissus]           = useState(Array.isArray(initContenu.tissus_list) ? initContenu.tissus_list : []);
  const [fournitures, setFournitures] = useState(Array.isArray(initContenu.fournitures_list) ? initContenu.fournitures_list : []);
  const [intervenants, setIntervenants] = useState(Array.isArray(initContenu.intervenants_list) ? initContenu.intervenants_list : []);

  useEffect(() => { setCollapsed({}); }, [type]);

  const setField = (key, val) => setContenu(p => ({ ...p, [key]: val }));
  const schema = schemas[type] || [];
  const groups = groupBySection(schema);
  const toggleSection = (title) => setCollapsed(p => ({ ...p, [title]: !p[title] }));

  // ── Étapes ──
  const addEtape       = () => setEtapes(e => [...e, { etape: '', type: '' }]);
  const setEtapeField  = (i, k, v) => setEtapes(e => e.map((x, j) => j === i ? { ...x, [k]: v } : x));
  const delEtape       = (i) => setEtapes(e => e.filter((_, j) => j !== i));
  const moveEtape      = (i, dir) => setEtapes(e => {
    const a = [...e]; const ni = i + dir;
    if (ni < 0 || ni >= a.length) return a;
    [a[i], a[ni]] = [a[ni], a[i]]; return a;
  });

  // ── Tissus ──
  const addTissu       = () => setTissus(t => [...t, { ref: '', coloris: '', placement: '', metrage: '' }]);
  const setTissuField  = (i, k, v) => setTissus(t => t.map((x, j) => j === i ? { ...x, [k]: v } : x));
  const delTissu       = (i) => setTissus(t => t.filter((_, j) => j !== i));

  // ── Intervenants ──
  const addIntervenant       = () => setIntervenants(v => [...v, { nom: '', heures: '' }]);
  const setIntervenantField  = (i, k, v) => setIntervenants(a => a.map((x, j) => j === i ? { ...x, [k]: v } : x));
  const delIntervenant       = (i) => setIntervenants(a => a.filter((_, j) => j !== i));

  // ── Fournitures ──
  const addFourniture      = () => setFournitures(f => [...f, { ref: '', coloris: '', placement: '', metrage: '' }]);
  const setFournitureField = (i, k, v) => setFournitures(f => f.map((x, j) => j === i ? { ...x, [k]: v } : x));
  const delFourniture      = (i) => setFournitures(f => f.filter((_, j) => j !== i));

  const handleSave = async () => {
    if (!type) return;
    setSaving(true);
    const contenuComplet = { ...contenu, etapes_custom: etapes, tissus_list: tissus, fournitures_list: fournitures, intervenants_list: intervenants };
    await onSave({ id: fiche.id, type_intervention: type, contenu_json: contenuComplet, notes_libres: notes });
    setSaving(false);
  };

  const sectionHd = 'flex items-center justify-between px-4 py-2 border-b border-line bg-bg';
  const sectionLbl = 'font-mono uppercase tracking-[0.16em] text-[10px] text-muted';
  const addBtn = 'flex items-center justify-center w-5 h-5 border border-ink text-ink hover:bg-ink hover:text-surface transition-colors';
  const fieldCls = 'w-full px-3 py-2 bg-surface border border-ink font-sans text-[13px] text-ink';

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4"
         style={{ background: 'rgba(0,0,0,0.6)' }} onClick={onClose}>
      <div className="w-full max-w-2xl max-h-[90vh] overflow-y-auto bg-surface border border-ink"
           onClick={e => e.stopPropagation()}>

        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-ink">
          <div>
            <h2 className="font-serif text-[22px] text-ink">{isNew ? 'Nouvelle fiche atelier' : 'Modifier la fiche'}</h2>
            {!isNew && <p className="font-mono text-[10px] text-muted mt-0.5">#{fiche.id}</p>}
          </div>
          <button onClick={onClose} className="p-1.5 text-muted"><X size={18} /></button>
        </div>

        <div className="px-6 py-5 space-y-0">

          {/* ── Infos client ─────────────────────────────────────────────── */}
          <div className="pb-5">
            <Kicker className="mb-3">Intervention</Kicker>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className={labelCls}>Client *</label>
                <input type="text" value={contenu.client_nom || ''} onChange={e => setField('client_nom', e.target.value)} className={inputCls} />
              </div>
              <div>
                <label className={labelCls}>Téléphone</label>
                <input type="text" value={contenu.client_tel || ''} onChange={e => setField('client_tel', e.target.value)} className={inputCls} />
              </div>
              <div style={{ gridColumn: 'span 2' }}>
                <label className={labelCls}>Adresse</label>
                <input type="text" value={contenu.client_adresse || ''} onChange={e => setField('client_adresse', e.target.value)} className={inputCls} />
              </div>
              <div>
                <label className={labelCls}>Email</label>
                <input type="email" value={contenu.client_email || ''} onChange={e => setField('client_email', e.target.value)} className={inputCls} />
              </div>
              <div>
                <label className={labelCls}>Date d&apos;impression</label>
                <input type="date" value={contenu.date_impression || ''} onChange={e => setField('date_impression', e.target.value)} className={inputCls} />
              </div>
              <div>
                <label className={labelCls}>Heures estimées</label>
                <input type="number" step="0.5" min="0" value={contenu.heures_estimees || ''} onChange={e => setField('heures_estimees', e.target.value)} className={inputCls} />
              </div>
            </div>
          </div>

          {/* ── Type d'intervention ──────────────────────────────────────── */}
          <div className="py-5 border-t border-ink">
            <label className={labelCls}>Type d&apos;intervention *</label>
            <div className="grid grid-cols-5 gap-1.5 mt-1">
              {TYPES.map(t => (
                <button key={t} type="button" onClick={() => setType(t)}
                  className="px-1.5 py-2 font-mono text-[10px] uppercase tracking-[0.06em] text-center leading-tight"
                  style={{
                    background: type === t ? '#000' : 'transparent',
                    color: type === t ? '#fff' : '#444',
                    border: '1px solid #000',
                  }}>
                  {t}
                </button>
              ))}
            </div>
          </div>

          {/* ── Sections dépliables ──────────────────────────────────────── */}
          {type && groups.map(group => (
            <div key={group.title || '__top__'} className="border-t border-ink">
              {group.title ? (
                <button
                  type="button"
                  onClick={() => toggleSection(group.title)}
                  className="flex items-center justify-between w-full py-3 hover:opacity-60 transition-opacity"
                >
                  <Kicker>{group.title}</Kicker>
                  <span className="text-muted flex-shrink-0">
                    {collapsed[group.title]
                      ? <ChevronRight size={14} />
                      : <ChevronDown size={14} />}
                  </span>
                </button>
              ) : (
                <div className="py-3" />
              )}

              {!collapsed[group.title] && (
                <div className="pb-4 grid grid-cols-2 gap-3">
                  {group.fields.map(field => (
                    <div key={field.key}
                         className={field.type === 'textarea' ? 'col-span-2' : ''}>
                      <label className={labelCls}>
                        {field.label}{field.unit ? ` (${field.unit})` : ''}
                      </label>
                      <DynField field={field} value={contenu[field.key]} onChange={setField} />
                    </div>
                  ))}
                </div>
              )}
            </div>
          ))}

          {/* ── Tissus ─────────────────────────────────────────────────────── */}
          <div className="border-t border-ink pt-4 pb-2">
            <div className={sectionHd} style={{ margin: '0 0 0 0' }}>
              <span className={sectionLbl}>Tissus</span>
              <button onClick={addTissu} className={addBtn} title="Ajouter un tissu"><Plus size={11} /></button>
            </div>
            <div className="pt-3 space-y-2">
              {tissus.length === 0 && <p className="font-sans text-[12px] text-muted px-1">Aucun tissu.</p>}
              {tissus.map((t, i) => (
                <div key={i} className="grid gap-2" style={{ gridTemplateColumns: '1fr 1fr 1fr 72px 20px', alignItems: 'end' }}>
                  <div><label className={labelCls}>Référence</label><input className={fieldCls} value={t.ref} onChange={e => setTissuField(i, 'ref', e.target.value)} placeholder="Ex: VELOURS-42" /></div>
                  <div><label className={labelCls}>Coloris</label><input className={fieldCls} value={t.coloris || ''} onChange={e => setTissuField(i, 'coloris', e.target.value)} /></div>
                  <div><label className={labelCls}>Placement</label><input className={fieldCls} value={t.placement || ''} onChange={e => setTissuField(i, 'placement', e.target.value)} /></div>
                  <div><label className={labelCls}>Métrage</label><input type="number" step="0.1" className={fieldCls} value={t.metrage || ''} onChange={e => setTissuField(i, 'metrage', e.target.value)} /></div>
                  <button onClick={() => delTissu(i)} className="text-muted self-end pb-0.5"><Trash2 size={13} /></button>
                </div>
              ))}
            </div>
          </div>

          {/* ── Fournitures ─────────────────────────────────────────────────── */}
          <div className="border-t border-ink pt-4 pb-2">
            <div className={sectionHd}>
              <span className={sectionLbl}>Fournitures diverses</span>
              <button onClick={addFourniture} className={addBtn} title="Ajouter une fourniture"><Plus size={11} /></button>
            </div>
            <div className="pt-3 space-y-2">
              {fournitures.length === 0 && <p className="font-sans text-[12px] text-muted px-1">Aucune fourniture.</p>}
              {fournitures.map((f, i) => (
                <div key={i} className="grid gap-2" style={{ gridTemplateColumns: '1fr 1fr 1fr 72px 20px', alignItems: 'end' }}>
                  <div><label className={labelCls}>Référence</label><input className={fieldCls} value={f.ref} onChange={e => setFournitureField(i, 'ref', e.target.value)} /></div>
                  <div><label className={labelCls}>Coloris</label><input className={fieldCls} value={f.coloris || ''} onChange={e => setFournitureField(i, 'coloris', e.target.value)} /></div>
                  <div><label className={labelCls}>Placement</label><input className={fieldCls} value={f.placement || ''} onChange={e => setFournitureField(i, 'placement', e.target.value)} /></div>
                  <div><label className={labelCls}>Métrage</label><input type="number" step="0.1" className={fieldCls} value={f.metrage || ''} onChange={e => setFournitureField(i, 'metrage', e.target.value)} /></div>
                  <button onClick={() => delFourniture(i)} className="text-muted self-end pb-0.5"><Trash2 size={13} /></button>
                </div>
              ))}
            </div>
          </div>

          {/* ── Étapes ──────────────────────────────────────────────────────── */}
          <div className="border-t border-ink pt-4 pb-2">
            <div className={sectionHd}>
              <span className={sectionLbl}>Étapes</span>
              <button onClick={addEtape} className={addBtn} title="Ajouter une étape"><Plus size={11} /></button>
            </div>
            <div className="pt-3 space-y-1.5">
              {etapes.length === 0 && <p className="font-sans text-[12px] text-muted px-1">Aucune étape.</p>}
              {etapes.length > 0 && (
                <div className="flex gap-2 mb-1">
                  <span className="flex-[2] font-mono text-[9px] uppercase tracking-[0.14em] text-muted pl-1">Désignation</span>
                  <span className="flex-1 font-mono text-[9px] uppercase tracking-[0.14em] text-muted pl-1">Précision</span>
                  <span style={{ width: 72 }} />
                </div>
              )}
              {etapes.map((e, i) => (
                <div key={i} className="flex gap-2 items-center">
                  <input value={e.etape} onChange={ev => setEtapeField(i, 'etape', ev.target.value)} placeholder="Désignation"
                    className="flex-[2] px-3 py-2 bg-surface border border-ink font-mono text-[11px] text-ink uppercase tracking-[0.08em]" />
                  <input value={e.type} onChange={ev => setEtapeField(i, 'type', ev.target.value)} placeholder="Précision"
                    className="flex-1 px-3 py-2 bg-surface border border-ink font-sans text-[13px] text-ink" />
                  <button onClick={() => moveEtape(i, -1)} disabled={i === 0} className="px-1.5 py-1 font-mono text-[12px] text-muted disabled:opacity-25 hover:text-ink">↑</button>
                  <button onClick={() => moveEtape(i, 1)} disabled={i === etapes.length - 1} className="px-1.5 py-1 font-mono text-[12px] text-muted disabled:opacity-25 hover:text-ink">↓</button>
                  <button onClick={() => delEtape(i)} className="p-1 text-muted hover:text-ink"><Trash2 size={12} /></button>
                </div>
              ))}
            </div>
          </div>

          {/* ── Notes libres ─────────────────────────────────────────────── */}
          <div className="py-5 border-t border-ink">
            <label className={labelCls}>Instructions / notes libres</label>
            <textarea value={notes} onChange={e => setNotes(e.target.value)} rows={3}
                      className="w-full px-3 py-2 bg-bg border border-ink font-sans text-[13px] text-ink resize-none" />
          </div>

          {/* ── Intervenants ─────────────────────────────────────────────── */}
          <div className="border-t border-ink pt-4 pb-5">
            <div className={sectionHd}>
              <span className={sectionLbl}>Heures réalisées &amp; intervenants</span>
              <button onClick={addIntervenant} className={addBtn} title="Ajouter un intervenant"><Plus size={11} /></button>
            </div>
            <div className="pt-3">
              {intervenants.length === 0 && <p className="font-sans text-[12px] text-muted px-1">Aucun intervenant.</p>}
              {intervenants.length > 0 && (
                <table className="w-full border-collapse">
                  <thead>
                    <tr>
                      <th className="text-left px-3 py-1.5 font-mono text-[9px] uppercase tracking-[0.14em] text-muted border border-line bg-bg">Nom intervenant</th>
                      <th className="text-left px-3 py-1.5 font-mono text-[9px] uppercase tracking-[0.14em] text-muted border border-line bg-bg" style={{ width: 120 }}>Heures réalisées</th>
                      <th style={{ width: 28 }} />
                    </tr>
                  </thead>
                  <tbody>
                    {intervenants.map((v, i) => (
                      <tr key={i}>
                        <td className="border border-line p-0">
                          <input value={v.nom} onChange={e => setIntervenantField(i, 'nom', e.target.value)}
                            placeholder="Nom"
                            className="w-full px-3 py-2 bg-surface font-sans text-[13px] text-ink border-0 outline-none" />
                        </td>
                        <td className="border border-line p-0">
                          <input type="number" step="0.5" min="0" value={v.heures} onChange={e => setIntervenantField(i, 'heures', e.target.value)}
                            placeholder="0"
                            className="w-full px-3 py-2 bg-surface font-mono text-[13px] text-ink border-0 outline-none" />
                        </td>
                        <td className="pl-1">
                          <button onClick={() => delIntervenant(i)} className="p-1 text-muted hover:text-ink"><Trash2 size={12} /></button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="px-6 py-4 flex items-center justify-between border-t border-ink bg-bg">
          <div>
            {!isNew && (
              <Btn variant="danger" onClick={() => onDelete(fiche.id)}>
                <Trash2 size={12} /> Supprimer
              </Btn>
            )}
          </div>
          <div className="flex gap-2">
            {!isNew && (
              <a href={`/fiche-atelier/${fiche.id}/print`} target="_blank" rel="noreferrer">
                <Btn variant="outline"><Printer size={12} /> Imprimer</Btn>
              </a>
            )}
            <Btn variant="outline" onClick={onClose}>Annuler</Btn>
            <Btn onClick={handleSave} disabled={!type || !contenu.client_nom || saving}>
              {saving ? 'Enregistrement…' : isNew ? 'Créer' : 'Enregistrer'}
            </Btn>
          </div>
        </div>
      </div>
    </div>
  );
}

// ─── Vue principale ───────────────────────────────────────────────────────────
export default function VueFiches() {
  const [fiches, setFiches] = useState([]);
  const [schemas, setSchemas] = useState({});
  const [loading, setLoading] = useState(true);
  const [editing, setEditing] = useState(null);
  const [search, setSearch] = useState('');

  const reload = async () => {
    const [f, s] = await Promise.all([
      fetch('/api/fiches').then(r => r.json()),
      fetch('/api/fiches?schemas=1').then(r => r.json()),
    ]);
    setFiches(Array.isArray(f) ? f : []);
    setSchemas(s.schemas || {});
  };

  useEffect(() => { reload().finally(() => setLoading(false)); }, []);

  const handleSave = async (data) => {
    if (data.id) {
      await fetch(`/api/fiches/${data.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data),
      });
    } else {
      await fetch('/api/fiches', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data),
      });
    }
    await reload();
    setEditing(null);
  };

  const handleDelete = async (id) => {
    if (!confirm('Supprimer cette fiche ?')) return;
    await fetch(`/api/fiches/${id}`, { method: 'DELETE' });
    await reload();
    setEditing(null);
  };

  const filtered = fiches.filter(f => {
    if (!search) return true;
    const c = (() => { try { return JSON.parse(f.contenu_json); } catch { return {}; } })();
    const client = c.client_nom || '';
    return client.toLowerCase().includes(search.toLowerCase())
      || f.type_intervention.toLowerCase().includes(search.toLowerCase());
  });

  if (loading) return <p className="font-sans text-[13px] text-muted">Chargement…</p>;

  return (
    <div>
      <div className="flex items-end justify-between mb-6">
        <div>
          <Kicker className="mb-2">Module 03</Kicker>
          <h2 className="font-serif text-[36px] tracking-[-0.01em] leading-[1.0] text-ink">Fiches atelier</h2>
          <p className="font-sans text-[13px] text-muted mt-1">{fiches.length} fiche{fiches.length > 1 ? 's' : ''}</p>
        </div>
        <Btn onClick={() => setEditing({})}>
          <Plus size={16} strokeWidth={2.5} /> Nouvelle fiche
        </Btn>
      </div>

      {/* Recherche */}
      <div className="relative mb-4">
        <span className="absolute left-3 top-1/2 -translate-y-1/2 font-mono text-muted text-[13px] pointer-events-none">⌕</span>
        <input type="text" value={search} onChange={e => setSearch(e.target.value)}
               placeholder="Rechercher par client ou type…"
               className="w-full pl-8 pr-3 py-2 bg-surface border border-ink font-sans text-[13px] text-ink" />
      </div>

      {/* Table */}
      <div className="border border-ink bg-surface">
        <table className="w-full">
          <thead>
            <tr className="bg-bg border-b border-ink">
              {['Type', 'Client', 'Date prévue', 'Heures', ''].map((h, i) => (
                <th key={i} className="text-left px-4 py-3 font-mono text-[10px] uppercase tracking-[0.12em] text-muted">{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {filtered.map(f => {
              const c = (() => { try { return JSON.parse(f.contenu_json); } catch { return {}; } })();

              return (
                <tr key={f.id} className="group hover:bg-bg border-t border-dotted border-black/30 cursor-pointer" onClick={() => setEditing(f)}>
                  <td className="px-4 py-3">
                    <span className="font-mono text-[10px] uppercase tracking-[0.12em] px-2 py-0.5 border border-ink">
                      {f.type_intervention}
                    </span>
                  </td>
                  <td className="px-4 py-3">
                    <p className="font-serif text-[14px] text-ink">{c.client_nom || '—'}</p>
                    {c.client_tel && <p className="font-mono text-[11px] text-muted">{c.client_tel}</p>}
                  </td>
                  <td className="px-4 py-3 font-mono text-[11px] text-muted whitespace-nowrap">
                    {formatDate(c.date_prevue)}
                  </td>
                  <td className="px-4 py-3 font-serif text-[14px] text-ink">
                    {c.heures_estimees ? `${c.heures_estimees}h` : '—'}
                  </td>
                  <td className="px-4 py-3">
                    <div className="opacity-0 group-hover:opacity-100 flex items-center gap-1">
                      <a href={`/fiche-atelier/${f.id}/print`} target="_blank" rel="noreferrer"
                         onClick={e => e.stopPropagation()}
                         className="p-1.5 text-muted" title="Imprimer">
                        <Printer size={13} />
                      </a>
                      <button onClick={() => setEditing(f)} className="p-1.5 text-muted" title="Modifier">
                        <Pencil size={13} />
                      </button>
                    </div>
                  </td>
                </tr>
              );
            })}
            {filtered.length === 0 && (
              <tr><td colSpan={6} className="px-4 py-12 text-center font-sans text-[13px] text-muted">
                {search ? 'Aucune fiche ne correspond.' : 'Aucune fiche. Crée la première.'}
              </td></tr>
            )}
          </tbody>
        </table>
      </div>

      {editing !== null && (
        <FicheModal
          fiche={editing}
          schemas={schemas}
          onSave={handleSave}
          onDelete={handleDelete}
          onClose={() => setEditing(null)}
        />
      )}
    </div>
  );
}
