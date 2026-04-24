'use client';

import { useState, useEffect, useMemo, useCallback } from 'react';
import { ArrowLeft, Zap, Pause, Calendar, X, Clock, Plus, Check } from 'lucide-react';
import Link from 'next/link';

const C = {
  bg: '#F5F5F5', ink: '#000000', inkSoft: '#444444', inkMuted: '#888888',
  surface: '#FFFFFF', border: '#000000', borderSoft: '#E5E5E5', accentSoft: '#EEEEEE',
};

const OPERATEURS    = ['Stéphan', 'Christophe', 'Morgane', 'Vivianne'];
const HEURES_PAR_JOUR = 8;

// ── Utilitaires mois ────────────────────────────────────────────────────────
function joursTravailDuMois(year, month) {
  let count = 0;
  const d = new Date(year, month, 1);
  while (d.getMonth() === month) {
    const dow = d.getDay();
    if (dow !== 0 && dow !== 6) count++;
    d.setDate(d.getDate() + 1);
  }
  return count;
}
function capaciteMois(year, month) {
  return OPERATEURS.length * joursTravailDuMois(year, month) * HEURES_PAR_JOUR;
}
function moisLabel(y, m) {
  return new Date(y, m, 1).toLocaleString('fr-FR', { month: 'long', year: 'numeric' });
}
function moisKey(y, m) { return `${y}-${String(m + 1).padStart(2, '0')}`; }
function parseKey(key) { const [y, m] = key.split('-').map(Number); return { year: y, month: m - 1 }; }

function buildColumns() {
  const now = new Date();
  const cols = [{ key: 'sans-date', label: 'Non planifié', capacite: null }];
  for (let i = -1; i <= 7; i++) {
    const d = new Date(now.getFullYear(), now.getMonth() + i, 1);
    const y = d.getFullYear(), mo = d.getMonth();
    cols.push({ key: moisKey(y, mo), label: moisLabel(y, mo), capacite: capaciteMois(y, mo), joursOuvres: joursTravailDuMois(y, mo) });
  }
  return cols;
}

function parseFlags(raw) {
  try { return JSON.parse(raw || '[]'); } catch { return []; }
}

// ── Popup saisie heures rapide ──────────────────────────────────────────────
function PopupHeures({ dossier, onClose, onSaved }) {
  const today = new Date().toISOString().split('T')[0];
  const [date, setDate]     = useState(today);
  const [lignes, setLignes] = useState(OPERATEURS.map(op => ({ operateur: op, heures: '' })));
  const [saving, setSaving] = useState(false);

  const setH = (i, val) => setLignes(ls => ls.map((l, j) => j === i ? { ...l, heures: val } : l));
  const valides = lignes.filter(l => parseFloat(l.heures) > 0);

  const save = async () => {
    if (!valides.length) return;
    setSaving(true);
    await Promise.all(valides.map(l =>
      fetch('/api/heures', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ dossier_id: dossier.id, operateur: l.operateur, date, heures_passees: parseFloat(l.heures), type_travail: 'Atelier', description: '' }),
      })
    ));
    setSaving(false);
    onSaved();
  };

  return (
    <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)', zIndex: 200, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
      <div style={{ background: '#fff', border: '2px solid #000', padding: 24, width: 380, maxWidth: '95vw' }}>
        <div className="flex items-center justify-between mb-4">
          <div>
            <p className="text-xs uppercase tracking-widest mb-0.5" style={{ color: C.inkMuted }}>Saisie heures</p>
            <p className="font-semibold" style={{ color: C.ink }}>{dossier.nom_dossier}</p>
          </div>
          <button onClick={onClose} style={{ background: 'none', border: 'none', cursor: 'pointer' }}><X size={18} /></button>
        </div>

        <div className="mb-4">
          <label className="text-xs uppercase tracking-wide mb-1 block" style={{ color: C.inkMuted }}>Date</label>
          <input type="date" value={date} onChange={e => setDate(e.target.value)}
                 className="w-full px-3 py-2 text-sm" style={{ border: `1px solid ${C.borderSoft}`, color: C.ink }} />
        </div>

        <div className="grid grid-cols-2 gap-2 mb-4">
          {lignes.map((l, i) => {
            const actif = parseFloat(l.heures) > 0;
            return (
              <div key={l.operateur} className="p-3" style={{ border: `1.5px solid ${actif ? '#000' : C.borderSoft}`, background: actif ? C.accentSoft : '#fff' }}>
                <p className="text-xs font-bold mb-2" style={{ color: actif ? C.ink : C.inkMuted }}>{l.operateur}</p>
                <input type="number" step="0.5" min="0" placeholder="—" value={l.heures} onChange={e => setH(i, e.target.value)}
                       className="w-full text-center font-bold text-lg"
                       style={{ border: `1px solid ${actif ? '#000' : C.borderSoft}`, padding: '4px', background: 'transparent', color: C.ink }} />
                {actif && <p className="text-xs text-center mt-1" style={{ color: C.inkMuted }}>{l.heures}h</p>}
              </div>
            );
          })}
        </div>

        <div className="flex items-center justify-between">
          <span className="text-xs" style={{ color: C.inkMuted }}>
            {valides.length > 0 ? valides.map(l => `${l.operateur} ${l.heures}h`).join(' · ') : 'Aucune saisie'}
          </span>
          <button onClick={save} disabled={saving || !valides.length}
                  className="flex items-center gap-2 px-4 py-2 text-sm font-semibold"
                  style={{ background: valides.length ? '#000' : '#ccc', color: '#fff', border: 'none', cursor: valides.length ? 'pointer' : 'default' }}>
            <Plus size={14} />
            {saving ? 'Enregistrement…' : 'Enregistrer'}
          </button>
        </div>
      </div>
    </div>
  );
}

// ── Carte dossier ────────────────────────────────────────────────────────────
function DossierCard({ d, heuresEffectuees, columns, onMove, onSaisirHeures }) {
  const [openMove, setOpenMove] = useState(false);
  const flags   = parseFlags(d.flags);
  const urgent  = flags.includes('Urgent');
  const standby = flags.includes('Standby');
  const prevues  = d.heures_a_realiser || 0;
  const restant  = Math.max(0, prevues - heuresEffectuees);
  const pct      = prevues > 0 ? Math.min((heuresEffectuees / prevues) * 100, 100) : 0;
  const depasse  = heuresEffectuees > prevues && prevues > 0;

  return (
    <div className="mb-2 p-3 text-xs" style={{ background: C.surface, border: `1px solid ${urgent ? '#FF0000' : C.borderSoft}` }}>
      {/* En-tête */}
      <div className="flex items-start justify-between gap-1 mb-1">
        <span className="font-semibold" style={{ color: C.ink, lineHeight: 1.3 }}>{d.nom_dossier}</span>
        <div style={{ width: 8, height: 8, borderRadius: '50%', background: d.statut === 'Clos' ? '#ccc' : '#000', flexShrink: 0, marginTop: 3 }} />
      </div>
      {d.client_nom && d.client_nom !== d.nom_dossier && (
        <p style={{ color: C.inkSoft }} className="mb-1">{d.client_nom}</p>
      )}

      {/* Badges */}
      <div className="flex items-center gap-1 flex-wrap mb-2">
        <span className="px-1.5 py-0.5" style={{ background: C.accentSoft, color: C.inkSoft }}>{d.statut}</span>
        {urgent  && <span className="px-1.5 py-0.5 font-bold" style={{ background: '#FF0000', color: '#FFF' }}><Zap size={9} className="inline" /> Urgent</span>}
        {standby && <span className="px-1.5 py-0.5" style={{ background: '#000', color: '#FFF' }}><Pause size={9} className="inline" /> Standby</span>}
      </div>

      {/* Barre heures */}
      {prevues > 0 && (
        <div className="mb-2">
          <div className="flex justify-between mb-0.5" style={{ color: depasse ? '#FF0000' : C.inkSoft }}>
            <span><b style={{ color: C.ink }}>{heuresEffectuees}h</b> / {prevues}h</span>
            <span style={{ fontWeight: depasse ? 700 : 400 }}>
              {depasse ? `+${(heuresEffectuees - prevues).toFixed(1)}h dépassé` : `${restant}h restant`}
            </span>
          </div>
          <div style={{ background: C.borderSoft, height: 4 }}>
            <div style={{ width: `${pct}%`, background: depasse ? '#FF0000' : '#000', height: '100%' }} />
          </div>
        </div>
      )}
      {prevues === 0 && (
        <p className="mb-2" style={{ color: C.inkMuted }}>Pas d'heures prévues</p>
      )}

      {/* Actions */}
      <div className="flex gap-1">
        <button onClick={() => onSaisirHeures(d)}
                className="flex items-center gap-1 px-2 py-1 text-xs flex-1 justify-center"
                style={{ border: `1px solid ${C.border}`, background: '#000', color: '#fff' }}>
          <Clock size={10} /> Heures
        </button>
        <div className="relative flex-1">
          <button onClick={() => setOpenMove(o => !o)}
                  className="flex items-center gap-1 px-2 py-1 text-xs w-full justify-center"
                  style={{ border: `1px solid ${C.borderSoft}`, background: C.bg, color: C.inkSoft }}>
            <Calendar size={10} /> Mois
          </button>
          {openMove && (
            <div className="absolute z-10 left-0 top-full mt-1 w-48"
                 style={{ background: C.surface, border: `1px solid ${C.border}`, maxHeight: 200, overflowY: 'auto' }}>
              {columns.map(col => (
                <button key={col.key} onClick={() => { onMove(d.id, col.key); setOpenMove(false); }}
                        className="w-full text-left px-3 py-1.5 text-xs hover:bg-gray-100"
                        style={{ color: C.ink, borderBottom: `1px solid ${C.borderSoft}` }}>
                  {col.label}
                </button>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

// ── Page principale ──────────────────────────────────────────────────────────
export default function StockPage() {
  const [dossiers, setDossiers]     = useState([]);
  const [heuresMap, setHeuresMap]   = useState({}); // { dossier_id: total_heures }
  const [loading, setLoading]       = useState(true);
  const [statutFilter, setStatutFilter] = useState('actifs');
  const [popupDossier, setPopupDossier] = useState(null);
  const columns = useMemo(() => buildColumns(), []);

  const loadHeures = useCallback(async () => {
    const r = await fetch('/api/heures');
    const { heures } = await r.json();
    const map = {};
    heures.forEach(h => {
      map[h.dossier_id] = (map[h.dossier_id] || 0) + h.heures_passees;
    });
    setHeuresMap(map);
  }, []);

  useEffect(() => {
    Promise.all([
      fetch('/api/dossiers').then(r => r.json()),
      fetch('/api/heures').then(r => r.json()),
    ]).then(([dos, hData]) => {
      setDossiers(dos);
      const map = {};
      hData.heures.forEach(h => { map[h.dossier_id] = (map[h.dossier_id] || 0) + h.heures_passees; });
      setHeuresMap(map);
      setLoading(false);
    });
  }, []);

  const filtered = useMemo(() => {
    if (statutFilter === 'actifs') return dossiers.filter(d => d.statut !== 'Clos');
    if (statutFilter === 'clos')   return dossiers.filter(d => d.statut === 'Clos');
    return dossiers;
  }, [dossiers, statutFilter]);

  const grouped = useMemo(() => {
    const map = {};
    columns.forEach(c => { map[c.key] = []; });
    filtered.forEach(d => {
      let key = 'sans-date';
      if (d.date_planifiee) {
        const dt = new Date(d.date_planifiee);
        if (!isNaN(dt)) key = moisKey(dt.getFullYear(), dt.getMonth());
      }
      if (!(key in map)) key = 'sans-date';
      map[key].push(d);
    });
    return map;
  }, [filtered, columns]);

  const handleMove = async (dossierId, colKey) => {
    let date_planifiee = null;
    if (colKey !== 'sans-date') {
      const { year, month } = parseKey(colKey);
      date_planifiee = new Date(year, month, 15).toISOString().split('T')[0];
    }
    await fetch(`/api/dossiers/${dossierId}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ date_planifiee }),
    });
    setDossiers(prev => prev.map(d => d.id === dossierId ? { ...d, date_planifiee } : d));
  };

  const stats = useMemo(() => {
    const actifs      = dossiers.filter(d => d.statut !== 'Clos').length;
    const planifies   = filtered.filter(d => d.date_planifiee).length;
    const nonPlanifies = filtered.filter(d => !d.date_planifiee).length;
    return { actifs, planifies, nonPlanifies };
  }, [dossiers, filtered]);

  const now = new Date();

  if (loading) return (
    <div className="min-h-screen flex items-center justify-center" style={{ background: C.bg }}>
      <p style={{ color: C.inkSoft }}>Chargement…</p>
    </div>
  );

  return (
    <div className="min-h-screen" style={{ background: C.bg, color: C.ink }}>
      <div className="px-6 py-8">

        <header className="flex items-center justify-between mb-6 flex-wrap gap-4">
          <div className="flex items-center gap-4">
            <Link href="/" className="flex items-center gap-2 text-sm" style={{ color: C.inkSoft }}>
              <ArrowLeft size={14} /> Retour
            </Link>
            <div>
              <p className="text-xs uppercase tracking-widest mb-1" style={{ color: C.inkMuted, letterSpacing: '0.15em' }}>Atelier Stéphan Hamache</p>
              <h1 style={{ fontFamily: "'Fraunces', serif", fontSize: 28, fontWeight: 500, color: C.ink, lineHeight: 1.1 }}>
                Planning Dossiers
              </h1>
            </div>
          </div>

          <div className="flex items-center gap-2 flex-wrap">
            {['actifs', 'tous', 'clos'].map(f => (
              <button key={f} onClick={() => setStatutFilter(f)}
                      className="px-3 py-1.5 text-xs font-medium"
                      style={{ background: statutFilter === f ? '#000' : C.surface, color: statutFilter === f ? '#FFF' : C.inkSoft, border: `1px solid ${statutFilter === f ? '#000' : C.borderSoft}` }}>
                {f === 'actifs' ? 'Actifs' : f === 'tous' ? 'Tous' : 'Clos'}
              </button>
            ))}
            <div className="flex gap-2 ml-2 text-xs">
              <div className="px-3 py-1.5" style={{ border: `1px solid ${C.borderSoft}`, background: C.surface }}>
                <span style={{ color: C.inkMuted }}>Actifs</span> <span className="font-semibold ml-1">{stats.actifs}</span>
              </div>
              <div className="px-3 py-1.5" style={{ border: `1px solid ${C.borderSoft}`, background: C.surface }}>
                <span style={{ color: C.inkMuted }}>Planifiés</span> <span className="font-semibold ml-1">{stats.planifies}</span>
              </div>
              <div className="px-3 py-1.5" style={{ border: '1px solid #000', background: '#000', color: '#FFF' }}>
                Non planifiés <span className="font-semibold ml-1">{stats.nonPlanifies}</span>
              </div>
            </div>
          </div>
        </header>

        {/* Kanban */}
        <div className="flex gap-3 overflow-x-auto pb-6" style={{ alignItems: 'flex-start' }}>
          {columns.map(col => {
            const cards = grouped[col.key] || [];
            const isSansDate = col.key === 'sans-date';
            const isCurrentMonth = !isSansDate && (() => {
              const { year, month } = parseKey(col.key);
              return year === now.getFullYear() && month === now.getMonth();
            })();
            const isPast = !isSansDate && (() => {
              const { year, month } = parseKey(col.key);
              return new Date(year, month + 1, 0) < now;
            })();

            // Capacité et charge du mois
            const capacite   = col.capacite || 0;
            const totalPrevues  = cards.reduce((s, d) => s + (d.heures_a_realiser || 0), 0);
            const totalEffectuees = cards.reduce((s, d) => s + (heuresMap[d.id] || 0), 0);
            const totalRestant  = Math.max(0, totalPrevues - totalEffectuees);
            const chargePct  = capacite > 0 ? Math.min(Math.round((totalRestant / capacite) * 100), 100) : 0;
            const surcharge  = capacite > 0 && totalRestant > capacite;

            return (
              <div key={col.key} className="flex-shrink-0" style={{ width: 195 }}>
                {/* En-tête colonne */}
                <div className="px-3 pt-2 pb-2 mb-1"
                     style={{ background: isCurrentMonth ? '#000' : isSansDate ? '#444' : isPast ? '#DDD' : C.surface, border: `1px solid ${C.border}` }}>
                  <div className="flex items-center justify-between mb-1">
                    <span className="text-xs font-semibold uppercase tracking-wide"
                          style={{ color: isCurrentMonth || isSansDate ? '#FFF' : isPast ? '#888' : C.ink }}>
                      {col.label}
                    </span>
                    <span className="text-xs px-1.5"
                          style={{ background: 'rgba(0,0,0,0.15)', color: isCurrentMonth || isSansDate ? '#FFF' : C.inkMuted }}>
                      {cards.length}
                    </span>
                  </div>
                  {!isSansDate && col.capacite && (
                    <div>
                      <div className="flex justify-between text-xs mb-0.5"
                           style={{ color: isCurrentMonth ? 'rgba(255,255,255,0.7)' : isPast ? '#aaa' : C.inkMuted }}>
                        <span>{totalRestant}h restant</span>
                        <span style={{ color: surcharge ? '#FF0000' : 'inherit' }}>{chargePct}%</span>
                      </div>
                      <div style={{ background: 'rgba(0,0,0,0.15)', height: 3 }}>
                        <div style={{ width: `${chargePct}%`, background: surcharge ? '#FF0000' : isCurrentMonth ? '#FFF' : '#000', height: '100%' }} />
                      </div>
                      <p className="text-xs mt-0.5" style={{ color: isCurrentMonth ? 'rgba(255,255,255,0.5)' : isPast ? '#bbb' : C.inkMuted }}>
                        cap. {capacite}h · {col.joursOuvres}j ouvrés
                      </p>
                    </div>
                  )}
                </div>

                {/* Cartes */}
                <div style={{ minHeight: 40 }}>
                  {cards.map(d => (
                    <DossierCard
                      key={d.id}
                      d={d}
                      heuresEffectuees={Math.round((heuresMap[d.id] || 0) * 10) / 10}
                      columns={columns}
                      onMove={handleMove}
                      onSaisirHeures={setPopupDossier}
                    />
                  ))}
                  {cards.length === 0 && (
                    <div className="p-3 text-center text-xs" style={{ color: C.inkMuted, border: `1px dashed ${C.borderSoft}` }}>—</div>
                  )}
                </div>
              </div>
            );
          })}
        </div>

      </div>

      {popupDossier && (
        <PopupHeures
          dossier={popupDossier}
          onClose={() => setPopupDossier(null)}
          onSaved={() => { loadHeures(); setPopupDossier(null); }}
        />
      )}
    </div>
  );
}
