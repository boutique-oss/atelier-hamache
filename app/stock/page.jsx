'use client';

import { useState, useEffect, useMemo, useCallback } from 'react';
import { ArrowLeft, X, Plus } from 'lucide-react';
import Link from 'next/link';
import Kicker from '../../components/ui/Kicker';
import Btn from '../../components/ui/Btn';

const C = {
  bg: '#F5F5F5', ink: '#000000', inkSoft: '#444444', inkMuted: '#737373',
  surface: '#FFFFFF', border: '#000000', borderSoft: '#E5E5E5',
};

const OPERATEURS    = ['Stéphan', 'Christophe', 'Morgane', 'Vivianne'];
const HEURES_PAR_JOUR = 8;

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
function capaciteMois(year, month) { return OPERATEURS.length * joursTravailDuMois(year, month) * HEURES_PAR_JOUR; }
function moisLabel(y, m) { return new Date(y, m, 1).toLocaleString('fr-FR', { month: 'long', year: 'numeric' }); }
function moisKey(y, m) { return `${y}-${String(m + 1).padStart(2, '0')}`; }
function parseKey(key) { const [y, m] = key.split('-').map(Number); return { year: y, month: m - 1 }; }
function parseFlags(raw) { try { return JSON.parse(raw || '[]'); } catch { return []; } }

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
    <div className="fixed inset-0 z-[200] flex items-center justify-center" style={{ background: 'rgba(0,0,0,0.5)' }}>
      <div className="bg-surface border-2 border-ink p-6 w-[380px] max-w-[95vw]">
        <div className="flex items-start justify-between mb-4">
          <div>
            <Kicker className="mb-1">Saisie heures</Kicker>
            <p className="font-serif text-[16px] text-ink">{dossier.nom_dossier}</p>
          </div>
          <button onClick={onClose} className="text-muted"><X size={18} /></button>
        </div>

        <div className="mb-4">
          <label className="font-mono uppercase tracking-[0.16em] text-[10px] text-muted block mb-1">Date</label>
          <input type="date" value={date} onChange={e => setDate(e.target.value)}
                 className="w-full px-3 py-2 bg-surface border border-ink font-sans text-[13px] text-ink" />
        </div>

        <div className="grid grid-cols-2 gap-2 mb-4">
          {lignes.map((l, i) => {
            const actif = parseFloat(l.heures) > 0;
            return (
              <div key={l.operateur} className="p-3" style={{ border: `1.5px solid ${actif ? '#000' : C.borderSoft}`, background: actif ? C.bg : '#fff' }}>
                <p className="font-mono text-[10px] uppercase tracking-[0.12em] mb-2" style={{ color: actif ? C.ink : C.inkMuted }}>{l.operateur}</p>
                <input
                  type="number" step="0.5" min="0" placeholder="—"
                  value={l.heures}
                  onChange={e => setH(i, e.target.value)}
                  className="w-full text-center font-serif tnum"
                  style={{ fontSize: 20, border: `1px solid ${actif ? '#000' : C.borderSoft}`, padding: '4px', background: 'transparent', color: C.ink, outline: 'none' }}
                />
                {actif && <p className="font-mono text-[10px] text-muted text-center mt-1">{l.heures}h</p>}
              </div>
            );
          })}
        </div>

        <div className="flex items-center justify-between">
          <span className="font-mono text-[10px] text-muted">
            {valides.length > 0 ? valides.map(l => `${l.operateur} ${l.heures}h`).join(' · ') : 'Aucune saisie'}
          </span>
          <Btn onClick={save} disabled={saving || !valides.length}>
            <Plus size={14} />
            {saving ? 'Enregistrement…' : 'Enregistrer'}
          </Btn>
        </div>
      </div>
    </div>
  );
}

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
    <div className="mb-2 bg-surface" style={{ border: `1px solid ${urgent ? '#FF0000' : C.borderSoft}` }}>
      {/* Onglet manille */}
      <div className="flex items-center justify-between px-2 pt-2 pb-1 border-b border-dotted border-black/20">
        <span className="font-serif text-[13px] text-ink leading-tight">{d.nom_dossier}</span>
        <span className="w-2 h-2 bg-ink flex-shrink-0" />
      </div>

      <div className="px-2 py-2">
        {d.client_nom && d.client_nom !== d.nom_dossier && (
          <p className="font-sans text-[11px] text-muted mb-1">{d.client_nom}</p>
        )}

        {/* Flags */}
        <div className="flex items-center gap-1 flex-wrap mb-2">
          <span className="font-mono text-[9px] uppercase tracking-[0.1em] border border-line px-1 py-0 text-muted">{d.statut}</span>
          {urgent  && <span className="font-serif italic text-[10px] border border-urgent text-urgent px-1 -rotate-3">URGENT</span>}
          {standby && <span className="font-serif italic text-[10px] border border-ink text-ink px-1 -rotate-3">STANDBY</span>}
        </div>

        {/* Barre heures */}
        {prevues > 0 && (
          <div className="mb-2">
            <div className="flex justify-between font-mono text-[10px] mb-0.5" style={{ color: depasse ? '#FF0000' : C.inkMuted }}>
              <span className="tnum"><span className="text-ink">{heuresEffectuees}h</span> / {prevues}h</span>
              <span className="tnum" style={{ fontWeight: depasse ? 700 : 400 }}>
                {depasse ? `+${(heuresEffectuees - prevues).toFixed(1)}h` : `${restant}h rest.`}
              </span>
            </div>
            <div className="bg-line h-1">
              <div className="h-full" style={{ width: `${pct}%`, background: depasse ? '#FF0000' : '#000' }} />
            </div>
          </div>
        )}
        {prevues === 0 && <p className="font-mono text-[10px] text-muted mb-2">Pas d&apos;heures prévues</p>}

        {/* Actions */}
        <div className="flex gap-1">
          <button
            onClick={() => onSaisirHeures(d)}
            className="flex items-center gap-1 px-2 py-1 font-mono text-[10px] flex-1 justify-center bg-ink text-surface"
          >
            + Heures
          </button>
          <div className="relative flex-1">
            <button
              onClick={() => setOpenMove(o => !o)}
              className="flex items-center gap-1 px-2 py-1 font-mono text-[10px] w-full justify-center border border-line text-muted bg-bg"
            >
              → Mois
            </button>
            {openMove && (
              <div className="absolute z-10 left-0 top-full mt-1 w-48 bg-surface border border-ink max-h-48 overflow-y-auto">
                {columns.map(col => (
                  <button
                    key={col.key}
                    onClick={() => { onMove(d.id, col.key); setOpenMove(false); }}
                    className="w-full text-left px-3 py-1.5 font-sans text-[12px] text-ink border-b border-dotted border-black/20 hover:bg-bg"
                  >
                    {col.label}
                  </button>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

export default function StockPage() {
  const [dossiers, setDossiers]         = useState([]);
  const [heuresMap, setHeuresMap]       = useState({});
  const [loading, setLoading]           = useState(true);
  const [statutFilter, setStatutFilter] = useState('actifs');
  const [popupDossier, setPopupDossier] = useState(null);
  const columns = useMemo(() => buildColumns(), []);

  const loadHeures = useCallback(async () => {
    const r = await fetch('/api/heures');
    const { heures } = await r.json();
    const map = {};
    heures.forEach(h => { map[h.dossier_id] = (map[h.dossier_id] || 0) + h.heures_passees; });
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
    const actifs       = dossiers.filter(d => d.statut !== 'Clos').length;
    const planifies    = filtered.filter(d => d.date_planifiee).length;
    const nonPlanifies = filtered.filter(d => !d.date_planifiee).length;
    return { actifs, planifies, nonPlanifies };
  }, [dossiers, filtered]);

  const now = new Date();

  if (loading) return (
    <div className="min-h-screen flex items-center justify-center bg-bg">
      <p className="font-sans text-[13px] text-muted">Chargement…</p>
    </div>
  );

  return (
    <div className="min-h-screen bg-bg text-ink">
      <div className="px-6 py-6 border-b border-ink mb-4">

        {/* Header */}
        <div className="flex items-start justify-between mb-0">
          <div className="flex items-center gap-4">
            <Link href="/" className="flex items-center gap-2 font-mono text-[11px] text-muted uppercase tracking-[0.12em]">
              <ArrowLeft size={13} /> Retour
            </Link>
            <div>
              <Kicker className="mb-1">Planning mensuel</Kicker>
              <h1 className="font-serif text-[28px] leading-none text-ink">Stock Kanban</h1>
            </div>
          </div>

          <div className="flex items-center gap-2 flex-wrap">
            {['actifs', 'tous', 'clos'].map(f => (
              <button
                key={f}
                onClick={() => setStatutFilter(f)}
                className="px-3 py-1.5 font-mono text-[10px] uppercase tracking-[0.1em]"
                style={{ background: statutFilter === f ? '#000' : '#FFF', color: statutFilter === f ? '#FFF' : C.inkMuted, border: `1px solid ${statutFilter === f ? '#000' : C.borderSoft}` }}
              >
                {f === 'actifs' ? 'Actifs' : f === 'tous' ? 'Tous' : 'Clos'}
              </button>
            ))}
            <div className="flex gap-1 ml-2">
              {[['Actifs', stats.actifs, false], ['Planifiés', stats.planifies, false], ['Non planifiés', stats.nonPlanifies, true]].map(([label, val, inverted]) => (
                <div key={label} className="px-3 py-1.5" style={{ border: `1px solid ${inverted ? '#000' : C.borderSoft}`, background: inverted ? '#000' : '#FFF', color: inverted ? '#FFF' : C.inkMuted }}>
                  <span className="font-mono text-[10px] uppercase tracking-[0.1em]">{label} </span>
                  <span className="font-serif tnum text-[14px]">{val}</span>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>

      {/* Kanban */}
      <div className="px-6 pb-6 flex gap-3 overflow-x-auto" style={{ alignItems: 'flex-start' }}>
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

          const capacite      = col.capacite || 0;
          const totalPrevues  = cards.reduce((s, d) => s + (d.heures_a_realiser || 0), 0);
          const totalEffectuees = cards.reduce((s, d) => s + (heuresMap[d.id] || 0), 0);
          const totalRestant  = Math.max(0, totalPrevues - totalEffectuees);
          const chargePct     = capacite > 0 ? Math.min(Math.round((totalRestant / capacite) * 100), 100) : 0;
          const surcharge     = capacite > 0 && totalRestant > capacite;

          const headerBg = isCurrentMonth ? '#000' : isSansDate ? '#444' : isPast ? '#DDD' : '#FFF';
          const headerColor = (isCurrentMonth || isSansDate) ? '#FFF' : isPast ? '#888' : '#000';

          return (
            <div key={col.key} className="flex-shrink-0" style={{ width: 195 }}>
              <div className="px-3 pt-2 pb-2 mb-1 border border-ink" style={{ background: headerBg }}>
                <div className="flex items-center justify-between mb-1">
                  <span className="font-mono text-[10px] uppercase tracking-[0.1em]" style={{ color: headerColor }}>
                    {col.label}
                  </span>
                  <span className="font-serif tnum text-[18px]" style={{ color: headerColor }}>{cards.length}</span>
                </div>
                {!isSansDate && col.capacite && (
                  <div>
                    <div className="flex justify-between font-mono text-[9px] mb-0.5" style={{ color: isCurrentMonth ? 'rgba(255,255,255,0.6)' : isPast ? '#aaa' : C.inkMuted }}>
                      <span className="tnum">{totalRestant}h rest.</span>
                      <span className="tnum" style={{ color: surcharge ? '#FF0000' : 'inherit' }}>{chargePct}%</span>
                    </div>
                    <div style={{ background: 'rgba(0,0,0,0.15)', height: 2 }}>
                      <div style={{ width: `${chargePct}%`, background: surcharge ? '#FF0000' : isCurrentMonth ? '#FFF' : '#000', height: '100%' }} />
                    </div>
                    <p className="font-mono text-[9px] mt-0.5" style={{ color: isCurrentMonth ? 'rgba(255,255,255,0.4)' : isPast ? '#bbb' : C.inkMuted }}>
                      cap. {capacite}h · {col.joursOuvres}j
                    </p>
                  </div>
                )}
              </div>

              <div>
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
                  <div className="p-3 text-center font-mono text-[10px] text-muted border border-dashed border-line">—</div>
                )}
              </div>
            </div>
          );
        })}
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
