'use client';

import { useState, useEffect, useMemo } from 'react';
import { Plus, Pencil, Trash2, X, ExternalLink, Truck, Check } from 'lucide-react';
import VueTodo from '../components/VueTodo';
import VueFiches from '../components/VueFiches';
import Kicker from '../components/ui/Kicker';
import Btn from '../components/ui/Btn';


const formatDate = (d) => {
  if (!d) return '—';
  const [y, m, day] = d.split('-');
  return `${day}/${m}/${y}`;
};

const labelCls = 'font-mono uppercase tracking-[0.16em] text-[10px] text-muted block mb-1';
const fieldCls = 'w-full px-3 py-2 bg-bg border border-ink font-sans text-[13px] text-ink';



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


export default function Page() {
  const [commandes, setCommandes]         = useState([]);
  const [fournisseurs, setFournisseurs]   = useState([]);
  const [loading, setLoading]             = useState(true);
  const [editingCommande, setEditingCommande] = useState(null);
  const [view, setView] = useState('commandes');

  const reload = async () => {
    const [c, f] = await Promise.all([
      fetch('/api/commandes').then(r => r.json()),
      fetch('/api/fournisseurs').then(r => r.json()),
    ]);
    setCommandes(c);
    setFournisseurs(f);
  };

  useEffect(() => {
    reload().finally(() => setLoading(false));
  }, []);

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

  if (loading) return <div className="min-h-screen flex items-center justify-center bg-bg"><p className="font-sans text-[13px] text-muted">Chargement…</p></div>;

  const TABS = [
    { key: 'commandes', num: '01', label: 'Commandes', count: commandes.length },
    { key: 'todo',      num: '02', label: 'Todo',      count: null },
    { key: 'fiches',    num: '03', label: 'Fiches',    count: null },
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
        </nav>

        {view === 'commandes' && <VueCommandes commandes={commandes} fournisseurs={fournisseurs} onNew={() => setEditingCommande({})} onEdit={setEditingCommande} />}
        {view === 'todo'      && <VueTodo />}
        {view === 'fiches'    && <VueFiches />}

        <footer className="mt-10 pt-4 pb-6 border-t border-ink">
          <p className="font-mono text-[10px] uppercase tracking-[0.12em] text-muted">
            Mode serveur · données partagées entre tous les postes du réseau
          </p>
        </footer>
      </div>

      {editingCommande !== null && <CommandeModal commande={editingCommande} fournisseurs={fournisseurs} onSave={handleSaveCommande} onDelete={handleDeleteCommande} onClose={() => setEditingCommande(null)} />}

    </div>
  );
}
