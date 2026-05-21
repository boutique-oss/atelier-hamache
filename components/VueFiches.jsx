'use client';

import { useState, useEffect } from 'react';
import { Plus, Pencil, Trash2, X, Printer } from 'lucide-react';
import Kicker from './ui/Kicker';
import Btn from './ui/Btn';

const TYPES = ['Tapisserie', 'Rideaux', 'Stores', 'Tête de lit', 'Habillage de lit', 'Coussins', 'Pose seule', 'Autre'];

const TYPE_COLORS = {
  'Tapisserie':       '#000',
  'Rideaux':          '#333',
  'Stores':           '#444',
  'Tête de lit':      '#555',
  'Habillage de lit': '#666',
  'Coussins':         '#777',
  'Pose seule':       '#888',
  'Autre':            '#999',
};

const labelCls = 'font-mono uppercase tracking-[0.16em] text-[10px] text-muted block mb-1';
const inputCls = 'w-full px-3 py-2 bg-bg border border-ink font-sans text-[13px] text-ink';

function formatDate(d) {
  if (!d) return '—';
  const [y, m, day] = d.split('-');
  return `${day}/${m}/${y}`;
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
        className={inputCls}
      />
      {field.unit && <span className="font-mono text-[11px] text-muted whitespace-nowrap">{field.unit}</span>}
    </div>
  );
}

// ─── Modal éditeur ────────────────────────────────────────────────────────────
function FicheModal({ fiche, schemas, onSave, onDelete, onClose }) {
  const isNew = !fiche.id;
  const [type, setType] = useState(fiche.type_intervention || '');
  const [contenu, setContenu] = useState(() => {
    try { return typeof fiche.contenu_json === 'string' ? JSON.parse(fiche.contenu_json) : (fiche.contenu_json || {}); }
    catch { return {}; }
  });
  const [notes, setNotes] = useState(fiche.notes_libres || '');
  const [saving, setSaving] = useState(false);

  const setField = (key, val) => setContenu(p => ({ ...p, [key]: val }));
  const schema = schemas[type] || [];

  const handleSave = async () => {
    if (!type) return;
    setSaving(true);
    await onSave({ id: fiche.id, type_intervention: type, contenu_json: contenu, notes_libres: notes });
    setSaving(false);
  };

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

        <div className="px-6 py-5 space-y-5">

          {/* Champs communs */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className={labelCls}>Client *</label>
              <input type="text" value={contenu.client_nom || ''} onChange={e => setField('client_nom', e.target.value)} className={inputCls} />
            </div>
            <div>
              <label className={labelCls}>Téléphone</label>
              <input type="text" value={contenu.client_tel || ''} onChange={e => setField('client_tel', e.target.value)} className={inputCls} />
            </div>
            <div>
              <label className={labelCls}>Date prévue</label>
              <input type="date" value={contenu.date_prevue || ''} onChange={e => setField('date_prevue', e.target.value)} className={inputCls} />
            </div>
            <div>
              <label className={labelCls}>Heures estimées</label>
              <input type="number" step="0.5" min="0" value={contenu.heures_estimees || ''} onChange={e => setField('heures_estimees', e.target.value)} className={inputCls} />
            </div>
          </div>

          {/* Sélecteur de type */}
          <div>
            <label className={labelCls}>Type d&apos;intervention *</label>
            <div className="grid grid-cols-4 gap-2">
              {TYPES.map(t => (
                <button key={t} type="button" onClick={() => setType(t)}
                  className="px-2 py-2 font-mono text-[10px] uppercase tracking-[0.08em] text-center"
                  style={{ background: type === t ? '#000' : 'transparent', color: type === t ? '#fff' : '#444', border: '1px solid #000' }}>
                  {t}
                </button>
              ))}
            </div>
          </div>

          {/* Champs spécifiques au type */}
          {type && schema.length > 0 && (
            <div className="pt-3 border-t border-ink">
              <Kicker className="mb-4">{type}</Kicker>
              <div className="grid grid-cols-2 gap-3">
                {schema.map(field => (
                  <div key={field.key} className={field.type === 'textarea' ? 'col-span-2' : ''}>
                    <label className={labelCls}>{field.label}{field.unit ? ` (${field.unit})` : ''}</label>
                    <DynField field={field} value={contenu[field.key]} onChange={setField} />
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Notes libres */}
          <div className="pt-3 border-t border-ink">
            <label className={labelCls}>Instructions / notes libres</label>
            <textarea value={notes} onChange={e => setNotes(e.target.value)} rows={3}
                      className="w-full px-3 py-2 bg-bg border border-ink font-sans text-[13px] text-ink resize-none" />
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
    const client = (f.contenu_json ? JSON.parse(f.contenu_json).client_nom : '') || '';
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
              {['Type', 'Client', 'Date prévue', 'Heures', 'Notes', ''].map((h, i) => (
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
                  <td className="px-4 py-3 font-sans text-[12px] text-muted max-w-xs truncate">
                    {f.notes_libres || '—'}
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
