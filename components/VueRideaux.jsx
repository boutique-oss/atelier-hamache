'use client';
import { useState, useEffect, useMemo } from 'react';
import { Plus, Printer, Trash2, ChevronDown, ChevronUp, X, Pencil } from 'lucide-react';
import Link from 'next/link';
import Kicker from './ui/Kicker';
import Btn from './ui/Btn';

const TYPES_TETE = [
  'Vague', 'Pince simple', 'Pince triple', 'Œillets',
  'Ruban fronceur', 'Accordéon', 'Passants', 'Fixe',
];

const emptyPiece = () => ({ baie: '', nb_rideaux: '', dimensions: '' });

const fieldCls = 'w-full px-3 py-2 bg-bg border border-ink font-sans text-[13px] text-ink';
const labelCls = 'font-mono uppercase tracking-[0.16em] text-[10px] text-muted block mb-1';

function FormulaireRideaux({ initial, onSaved, onCancel }) {
  const today = new Date().toISOString().split('T')[0];
  const [f, setF] = useState(() => initial || {
    client: '', telephone: '', adresse: '',
    date: today,
    pieces: [emptyPiece(), emptyPiece(), emptyPiece()],
    tissu: '', ref_tissu: '', coloris: '', metrage: '',
    type_tete: 'Vague', heures: '', notes: '',
  });
  const [saving, setSaving] = useState(false);

  const upd = (k, v) => setF(p => ({ ...p, [k]: v }));
  const updPiece = (i, k, v) =>
    setF(p => ({ ...p, pieces: p.pieces.map((row, j) => j === i ? { ...row, [k]: v } : row) }));
  const addPiece = () => setF(p => ({ ...p, pieces: [...p.pieces, emptyPiece()] }));
  const delPiece = (i) => setF(p => ({ ...p, pieces: p.pieces.filter((_, j) => j !== i) }));

  const save = async () => {
    if (!f.client.trim()) return;
    setSaving(true);
    const isEdit = Boolean(f.id);
    const url = isEdit ? `/api/interventions-rideaux?id=${f.id}` : '/api/interventions-rideaux';
    await fetch(url, {
      method: isEdit ? 'PUT' : 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ ...f, pieces_json: JSON.stringify(f.pieces) }),
    });
    setSaving(false);
    onSaved();
  };

  return (
    <div className="bg-surface border border-ink p-6 mb-6">
      <div className="flex justify-between items-center mb-5">
        <Kicker>{f.id ? 'Modifier la fiche' : 'Nouvelle fiche rideaux'}</Kicker>
        <button onClick={onCancel} className="p-1 text-muted"><X size={16} /></button>
      </div>

      {/* Client + date */}
      <div className="grid grid-cols-3 gap-3 mb-4">
        <div className="col-span-2">
          <label className={labelCls}>Client *</label>
          <input type="text" value={f.client} onChange={e => upd('client', e.target.value)} className={fieldCls} />
        </div>
        <div>
          <label className={labelCls}>Date</label>
          <input type="date" value={f.date} onChange={e => upd('date', e.target.value)} className={fieldCls} />
        </div>
        <div>
          <label className={labelCls}>Téléphone</label>
          <input type="text" value={f.telephone} onChange={e => upd('telephone', e.target.value)} className={fieldCls} />
        </div>
        <div className="col-span-2">
          <label className={labelCls}>Adresse</label>
          <input type="text" value={f.adresse} onChange={e => upd('adresse', e.target.value)} className={fieldCls} />
        </div>
      </div>

      {/* Tableau pièces */}
      <div className="mb-4">
        <div className="flex items-center justify-between mb-2">
          <label className="font-mono uppercase tracking-[0.16em] text-[10px] text-muted">Pièces / Fenêtres</label>
          <button
            onClick={addPiece}
            className="inline-flex items-center gap-1 px-2 py-1 font-mono text-[10px] uppercase tracking-[0.12em] text-muted border border-ink"
          >
            <Plus size={10} /> Ajouter
          </button>
        </div>
        <div className="border border-ink bg-bg">
          <table className="w-full">
            <thead>
              <tr className="border-b border-ink">
                {['N°', 'Baie / Fenêtre', 'Nb rideaux', 'Dimensions (L×H cm)', ''].map((h, i) => (
                  <th key={i} className="text-left px-3 py-2 font-mono text-[10px] uppercase tracking-[0.12em] text-muted">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {f.pieces.map((row, i) => (
                <tr key={i} className="border-t border-dotted border-black/20">
                  <td className="px-3 py-1.5 font-mono text-[11px] text-muted w-8">{i + 1}</td>
                  <td className="px-2 py-1.5">
                    <input
                      type="text" value={row.baie}
                      onChange={e => updPiece(i, 'baie', e.target.value)}
                      placeholder="Fenêtre"
                      className="w-full px-2 py-1 bg-surface border border-line font-sans text-[13px] text-ink"
                    />
                  </td>
                  <td className="px-2 py-1.5 w-28">
                    <input
                      type="number" value={row.nb_rideaux}
                      onChange={e => updPiece(i, 'nb_rideaux', e.target.value)}
                      placeholder="—"
                      className="w-full px-2 py-1 bg-surface border border-line font-sans text-[13px] text-ink text-center"
                    />
                  </td>
                  <td className="px-2 py-1.5">
                    <input
                      type="text" value={row.dimensions}
                      onChange={e => updPiece(i, 'dimensions', e.target.value)}
                      placeholder="ex : 140×260"
                      className="w-full px-2 py-1 bg-surface border border-line font-sans text-[13px] text-ink"
                    />
                  </td>
                  <td className="px-2 py-1.5 w-8">
                    {f.pieces.length > 1 && (
                      <button onClick={() => delPiece(i)} className="p-0.5 text-muted">
                        <Trash2 size={12} />
                      </button>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Tissu */}
      <div className="grid grid-cols-4 gap-3 mb-4">
        <div className="col-span-2">
          <label className={labelCls}>Tissu</label>
          <input type="text" value={f.tissu} onChange={e => upd('tissu', e.target.value)} className={fieldCls} />
        </div>
        <div>
          <label className={labelCls}>Référence</label>
          <input type="text" value={f.ref_tissu} onChange={e => upd('ref_tissu', e.target.value)} className={fieldCls} />
        </div>
        <div>
          <label className={labelCls}>Coloris</label>
          <input type="text" value={f.coloris} onChange={e => upd('coloris', e.target.value)} className={fieldCls} />
        </div>
        <div>
          <label className={labelCls}>Métrage</label>
          <input type="text" value={f.metrage} onChange={e => upd('metrage', e.target.value)} placeholder="ex : 8.5ml" className={fieldCls} />
        </div>
        <div>
          <label className={labelCls}>Type de tête</label>
          <select value={f.type_tete} onChange={e => upd('type_tete', e.target.value)} className={fieldCls}>
            {TYPES_TETE.map(t => <option key={t} value={t}>{t}</option>)}
          </select>
        </div>
        <div>
          <label className={labelCls}>Heures estimées</label>
          <input
            type="number" step="0.5" min="0"
            value={f.heures}
            onChange={e => upd('heures', e.target.value)}
            placeholder="—"
            className={fieldCls}
          />
        </div>
      </div>

      {/* Notes */}
      <div className="mb-5">
        <label className={labelCls}>Notes</label>
        <textarea
          value={f.notes} onChange={e => upd('notes', e.target.value)} rows={3}
          className="w-full px-3 py-2 bg-bg border border-ink font-sans text-[13px] text-ink resize-none"
        />
      </div>

      <div className="flex justify-end gap-2">
        <Btn variant="outline" onClick={onCancel}>Annuler</Btn>
        <Btn onClick={save} disabled={saving || !f.client.trim()}>
          {saving ? 'Enregistrement…' : f.id ? 'Enregistrer' : 'Créer la fiche'}
        </Btn>
      </div>
    </div>
  );
}

const formatDate = (d) => {
  if (!d) return '—';
  const [y, m, day] = d.split('-');
  return `${day}/${m}/${y}`;
};

export default function VueRideaux() {
  const [fiches, setFiches] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [editing, setEditing] = useState(null);
  const [search, setSearch] = useState('');
  const [sortKey, setSortKey] = useState('date');
  const [sortDir, setSortDir] = useState('desc');

  const load = async () => {
    setLoading(true);
    const r = await fetch('/api/interventions-rideaux');
    setFiches(await r.json());
    setLoading(false);
  };

  useEffect(() => { load(); }, []);

  const handleDelete = async (id) => {
    if (!confirm('Supprimer cette fiche rideaux ?')) return;
    await fetch(`/api/interventions-rideaux?id=${id}`, { method: 'DELETE' });
    load();
  };

  const toggleSort = (key) => {
    if (sortKey === key) setSortDir(d => d === 'asc' ? 'desc' : 'asc');
    else { setSortKey(key); setSortDir('asc'); }
  };

  const filtered = useMemo(() => {
    let rows = fiches.filter(f =>
      !search ||
      f.client.toLowerCase().includes(search.toLowerCase()) ||
      (f.tissu || '').toLowerCase().includes(search.toLowerCase()) ||
      (f.coloris || '').toLowerCase().includes(search.toLowerCase())
    );
    rows = [...rows].sort((a, b) => {
      const va = String(a[sortKey] || ''), vb = String(b[sortKey] || '');
      return sortDir === 'asc' ? va.localeCompare(vb) : vb.localeCompare(va);
    });
    return rows;
  }, [fiches, search, sortKey, sortDir]);

  function SortIcon({ k }) {
    if (sortKey !== k) return <span className="text-[#ccc] ml-0.5">↕</span>;
    return sortDir === 'asc' ? <ChevronUp size={10} /> : <ChevronDown size={10} />;
  }

  const COLS = [
    { key: 'client',    label: 'Client' },
    { key: 'date',      label: 'Date' },
    { key: 'telephone', label: 'Téléphone' },
    { key: 'tissu',     label: 'Tissu' },
    { key: 'coloris',   label: 'Coloris' },
    { key: 'type_tete', label: 'Type de tête' },
    { key: 'heures',    label: 'Heures' },
  ];

  if (loading) return <div className="p-5 font-sans text-[13px] text-muted">Chargement…</div>;

  return (
    <div>
      {/* En-tête */}
      <div className="flex justify-between items-end mb-6">
        <div>
          <Kicker className="mb-2">Module 08</Kicker>
          <h2 className="font-serif text-[36px] tracking-[-0.01em] leading-[1.0] text-ink">Rideaux</h2>
          <p className="font-sans text-[13px] text-muted mt-1">
            {fiches.length} fiche{fiches.length !== 1 ? 's' : ''} d&apos;intervention
          </p>
        </div>
        <Btn onClick={() => { setShowForm(true); setEditing(null); }}>
          <Plus size={14} /> Nouvelle fiche
        </Btn>
      </div>

      {/* Formulaire */}
      {(showForm || editing) && (
        <FormulaireRideaux
          initial={editing}
          onSaved={() => { load(); setShowForm(false); setEditing(null); }}
          onCancel={() => { setShowForm(false); setEditing(null); }}
        />
      )}

      {/* Recherche */}
      <div className="relative mb-3">
        <span className="absolute left-3 top-1/2 -translate-y-1/2 font-mono text-muted text-[13px] pointer-events-none">⌕</span>
        <input
          type="text" value={search} onChange={e => setSearch(e.target.value)}
          placeholder="Rechercher client, tissu, coloris…"
          className="w-full pl-8 pr-3 py-2 bg-surface border border-ink font-sans text-[13px] text-ink"
        />
      </div>

      <p className="font-mono text-[11px] text-muted mb-3 tnum">
        {filtered.length} {filtered.length !== 1 ? 'fiches affichées' : 'fiche affichée'}
      </p>

      {/* Table */}
      <div className="border border-ink bg-surface">
        <table className="w-full">
          <thead>
            <tr className="bg-bg border-b border-ink">
              {COLS.map(col => (
                <th
                  key={col.key}
                  className="text-left px-3 py-3 font-mono text-[10px] uppercase tracking-[0.12em] text-muted cursor-pointer select-none"
                  onClick={() => toggleSort(col.key)}
                >
                  <span className="inline-flex items-center gap-1">
                    {col.label} <SortIcon k={col.key} />
                  </span>
                </th>
              ))}
              <th className="px-3 py-3 w-24"></th>
            </tr>
          </thead>
          <tbody>
            {filtered.map(f => (
              <tr key={f.id} className="group border-t border-dotted border-black/30 hover:bg-bg">
                <td className="px-3 py-3 font-serif text-[14px] text-ink">{f.client}</td>
                <td className="px-3 py-3 font-mono text-[11px] text-muted tnum whitespace-nowrap">{formatDate(f.date)}</td>
                <td className="px-3 py-3 font-mono text-[11px] text-muted">{f.telephone || '—'}</td>
                <td className="px-3 py-3 font-sans text-[12px] text-muted">{f.tissu || '—'}</td>
                <td className="px-3 py-3 font-sans text-[12px] text-muted">{f.coloris || '—'}</td>
                <td className="px-3 py-3 font-sans text-[12px] text-muted">{f.type_tete || '—'}</td>
                <td className="px-3 py-3 font-serif tnum text-[14px] text-ink">
                  {f.heures ? `${f.heures}h` : '—'}
                </td>
                <td className="px-3 py-3">
                  <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100">
                    <Link
                      href={`/rideaux/${f.id}/print`}
                      target="_blank"
                      className="p-1.5 text-muted"
                      title="Imprimer"
                    >
                      <Printer size={13} />
                    </Link>
                    <button
                      onClick={() => {
                        setEditing({ ...f, pieces: JSON.parse(f.pieces_json || '[]') });
                        setShowForm(false);
                      }}
                      className="p-1.5 text-muted"
                      title="Modifier"
                    >
                      <Pencil size={13} />
                    </button>
                    <button
                      onClick={() => handleDelete(f.id)}
                      className="p-1.5 text-muted"
                      title="Supprimer"
                    >
                      <Trash2 size={13} />
                    </button>
                  </div>
                </td>
              </tr>
            ))}
            {filtered.length === 0 && (
              <tr>
                <td colSpan={8} className="px-4 py-12 text-center font-sans text-[13px] text-muted">
                  {fiches.length === 0
                    ? 'Aucune fiche rideaux — crée la première.'
                    : 'Aucun résultat pour cette recherche.'}
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
