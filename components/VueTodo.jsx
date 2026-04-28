'use client';
import { useState, useEffect, useMemo } from 'react';
import { Plus, Trash2, Check, ChevronDown, ChevronUp, X } from 'lucide-react';
import Kicker from './ui/Kicker';
import Btn from './ui/Btn';

const TYPES = [
  { key: 'dossiers',  label: 'Dossier' },
  { key: 'commande',  label: 'Commande' },
  { key: 'rideaux',   label: 'Rideaux interv.' },
  { key: 'predevis',  label: 'Prédevis' },
  { key: 'heures',    label: 'Heures passées' },
];

const fieldCls = 'w-full px-3 py-2 bg-bg border border-ink font-sans text-[13px] text-ink';
const labelCls = 'font-mono uppercase tracking-[0.16em] text-[10px] text-muted block mb-1';

const formatDate = (d) => {
  if (!d) return '—';
  const dt = new Date(d);
  return `${String(dt.getDate()).padStart(2,'0')}/${String(dt.getMonth()+1).padStart(2,'0')}/${dt.getFullYear()}`;
};

export default function VueTodo() {
  const [tasks, setTasks]           = useState([]);
  const [loading, setLoading]       = useState(true);
  const [showForm, setShowForm]     = useState(false);
  const [newTask, setNewTask]       = useState({ titre: '', type: 'dossiers', notes: '' });
  const [filterType, setFilterType] = useState('all');
  const [filterStatut, setFilterStatut] = useState('pending');
  const [sortKey, setSortKey]       = useState('created_at');
  const [sortDir, setSortDir]       = useState('desc');

  const load = async () => {
    setLoading(true);
    const r = await fetch('/api/tasks');
    setTasks(await r.json());
    setLoading(false);
  };

  useEffect(() => { load(); }, []);

  const handleAdd = async () => {
    if (!newTask.titre.trim()) return;
    await fetch('/api/tasks', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(newTask),
    });
    setNewTask({ titre: '', type: 'dossiers', notes: '' });
    setShowForm(false);
    load();
  };

  const toggleDone = async (task) => {
    await fetch(`/api/tasks?id=${task.id}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ statut: task.statut === 'done' ? 'pending' : 'done' }),
    });
    load();
  };

  const handleDelete = async (id) => {
    if (!confirm('Supprimer cette tâche ?')) return;
    await fetch(`/api/tasks?id=${id}`, { method: 'DELETE' });
    load();
  };

  const toggleSort = (key) => {
    if (sortKey === key) setSortDir(d => d === 'asc' ? 'desc' : 'asc');
    else { setSortKey(key); setSortDir('asc'); }
  };

  const counts = useMemo(() => ({
    pending: tasks.filter(t => t.statut === 'pending').length,
    done:    tasks.filter(t => t.statut === 'done').length,
  }), [tasks]);

  const filtered = useMemo(() => {
    let rows = tasks.filter(t => {
      if (filterType !== 'all' && t.type !== filterType) return false;
      if (filterStatut !== 'all' && t.statut !== filterStatut) return false;
      return true;
    });
    return [...rows].sort((a, b) => {
      const va = String(a[sortKey] || ''), vb = String(b[sortKey] || '');
      return sortDir === 'asc' ? va.localeCompare(vb) : vb.localeCompare(va);
    });
  }, [tasks, filterType, filterStatut, sortKey, sortDir]);

  function SortIcon({ k }) {
    if (sortKey !== k) return <span className="text-[#ccc] ml-0.5">↕</span>;
    return sortDir === 'asc' ? <ChevronUp size={10} /> : <ChevronDown size={10} />;
  }

  const COLS = [
    { key: 'titre',      label: 'Tâche' },
    { key: 'type',       label: 'Type' },
    { key: 'notes',      label: 'Notes' },
    { key: 'created_at', label: 'Créée le' },
  ];

  if (loading) return <div className="p-5 font-sans text-[13px] text-muted">Chargement…</div>;

  return (
    <div>
      {/* En-tête */}
      <div className="flex justify-between items-end mb-6">
        <div>
          <Kicker className="mb-2">Module 09</Kicker>
          <h2 className="font-serif text-[36px] tracking-[-0.01em] leading-[1.0] text-ink">À faire</h2>
          <p className="font-sans text-[13px] text-muted mt-1">
            <span className="font-serif tnum text-ink">{counts.pending}</span> en attente ·{' '}
            <span className="font-serif tnum">{counts.done}</span> terminée{counts.done !== 1 ? 's' : ''}
          </p>
        </div>
        <Btn onClick={() => setShowForm(f => !f)}>
          {showForm ? <><X size={14} /> Fermer</> : <><Plus size={14} /> Nouvelle tâche</>}
        </Btn>
      </div>

      {/* Formulaire */}
      {showForm && (
        <div className="bg-surface border border-ink p-5 mb-5">
          <Kicker className="mb-4">Ajouter une tâche à rentrer</Kicker>
          <div className="grid grid-cols-3 gap-3 mb-3">
            <div className="col-span-2">
              <label className={labelCls}>Titre *</label>
              <input
                type="text" value={newTask.titre}
                onChange={e => setNewTask(p => ({ ...p, titre: e.target.value }))}
                placeholder="Ex : Rentrer devis Dupont"
                className={fieldCls}
                onKeyDown={e => e.key === 'Enter' && handleAdd()}
              />
            </div>
            <div>
              <label className={labelCls}>Type</label>
              <select
                value={newTask.type}
                onChange={e => setNewTask(p => ({ ...p, type: e.target.value }))}
                className={fieldCls}
              >
                {TYPES.map(t => <option key={t.key} value={t.key}>{t.label}</option>)}
              </select>
            </div>
          </div>
          <div className="mb-4">
            <label className={labelCls}>Notes (optionnel)</label>
            <textarea
              value={newTask.notes}
              onChange={e => setNewTask(p => ({ ...p, notes: e.target.value }))}
              rows={2}
              className="w-full px-3 py-2 bg-bg border border-ink font-sans text-[13px] text-ink resize-none"
            />
          </div>
          <div className="flex justify-end gap-2">
            <Btn variant="outline" onClick={() => setShowForm(false)}>Annuler</Btn>
            <Btn onClick={handleAdd} disabled={!newTask.titre.trim()}>Ajouter</Btn>
          </div>
        </div>
      )}

      {/* Filtres statut */}
      <div className="flex gap-2 mb-4 flex-wrap">
        {[
          { key: 'pending', label: `En attente (${counts.pending})` },
          { key: 'done',    label: `Terminées (${counts.done})` },
          { key: 'all',     label: 'Toutes' },
        ].map(opt => (
          <button
            key={opt.key}
            onClick={() => setFilterStatut(opt.key)}
            className="px-3 py-1.5 font-mono text-[10px] uppercase tracking-[0.12em] border border-ink"
            style={{
              background: filterStatut === opt.key ? '#000' : '#fff',
              color:      filterStatut === opt.key ? '#fff' : '#000',
            }}
          >
            {opt.label}
          </button>
        ))}

        <div className="w-px bg-ink mx-1 self-stretch" />

        {TYPES.map(t => (
          <button
            key={t.key}
            onClick={() => setFilterType(filterType === t.key ? 'all' : t.key)}
            className="px-3 py-1.5 font-mono text-[10px] uppercase tracking-[0.12em] border border-ink"
            style={{
              background: filterType === t.key ? '#000' : '#fff',
              color:      filterType === t.key ? '#fff' : '#555',
            }}
          >
            {t.label}
          </button>
        ))}

        {filterType !== 'all' && (
          <button
            onClick={() => setFilterType('all')}
            className="font-mono text-[10px] uppercase tracking-[0.12em] text-muted underline px-2"
          >
            Effacer type
          </button>
        )}
      </div>

      <p className="font-mono text-[11px] text-muted mb-3 tnum">
        {filtered.length} {filtered.length !== 1 ? 'tâches affichées' : 'tâche affichée'}
      </p>

      {/* Table */}
      <div className="border border-ink bg-surface">
        <table className="w-full">
          <thead>
            <tr className="bg-bg border-b border-ink">
              <th className="w-10 px-3 py-3"></th>
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
              <th className="w-10 px-3 py-3"></th>
            </tr>
          </thead>
          <tbody>
            {filtered.map(t => {
              const done      = t.statut === 'done';
              const typeLabel = TYPES.find(x => x.key === t.type)?.label || t.type;
              return (
                <tr
                  key={t.id}
                  className="group border-t border-dotted border-black/30 hover:bg-bg"
                  style={{ opacity: done ? 0.5 : 1 }}
                >
                  <td className="px-3 py-3">
                    <button
                      onClick={() => toggleDone(t)}
                      className="w-5 h-5 border border-ink flex items-center justify-center"
                      style={{ background: done ? '#000' : '#fff' }}
                      title={done ? 'Remettre en attente' : 'Marquer terminé'}
                    >
                      {done && <Check size={11} color="#fff" />}
                    </button>
                  </td>
                  <td className="px-3 py-3">
                    <p
                      className="font-serif text-[14px] text-ink"
                      style={{ textDecoration: done ? 'line-through' : 'none' }}
                    >
                      {t.titre}
                    </p>
                  </td>
                  <td className="px-3 py-3">
                    <span className="inline-block px-2 py-0.5 font-mono text-[10px] uppercase tracking-[0.1em] border border-ink">
                      {typeLabel}
                    </span>
                  </td>
                  <td className="px-3 py-3 font-sans text-[12px] text-muted max-w-xs truncate">
                    {t.notes || '—'}
                  </td>
                  <td className="px-3 py-3 font-mono text-[11px] text-muted tnum whitespace-nowrap">
                    {formatDate(t.created_at)}
                  </td>
                  <td className="px-3 py-3">
                    <button
                      onClick={() => handleDelete(t.id)}
                      className="p-1.5 text-muted opacity-0 group-hover:opacity-100"
                    >
                      <Trash2 size={13} />
                    </button>
                  </td>
                </tr>
              );
            })}
            {filtered.length === 0 && (
              <tr>
                <td colSpan={6} className="px-4 py-12 text-center font-sans text-[13px] text-muted">
                  {tasks.length === 0
                    ? 'Aucune tâche — commence par en créer une.'
                    : 'Aucune tâche ne correspond aux filtres.'}
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
