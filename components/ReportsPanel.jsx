'use client';
import { useState, useEffect } from 'react';
import { RefreshCw, TrendingDown, TrendingUp } from 'lucide-react';
import Kicker from './ui/Kicker';
import Btn from './ui/Btn';

const PIPELINE = ['Nouveau', 'Devis envoyé', 'Validé', 'En atelier', 'Prêt à poser'];
const QUOTAS   = { 'Nouveau': 6, 'Devis envoyé': 5, 'Validé': 4, 'En atelier': 10, 'Prêt à poser': 6 };
const TAUX     = 55;

// ── Hook count-up ────────────────────────────────────────────────────────────
function useCountUp(target, active, ms = 700) {
  const [val, setVal] = useState(0);
  useEffect(() => {
    if (!active) { setVal(0); return; }
    let elapsed = 0;
    const id = setInterval(() => {
      elapsed += 16;
      const p = Math.min(elapsed / ms, 1);
      const ease = 1 - Math.pow(1 - p, 3);
      setVal(Math.round(ease * target));
      if (p >= 1) clearInterval(id);
    }, 16);
    return () => clearInterval(id);
  }, [target, active, ms]);
  return val;
}

// ── Barre quota animée ───────────────────────────────────────────────────────
function QuotaBar({ ratio, danger, delay }) {
  const [w, setW] = useState(0);
  useEffect(() => {
    const t = setTimeout(() => setW(Math.min(ratio * 100, 100)), delay + 200);
    return () => clearTimeout(t);
  }, [ratio, delay]);
  return (
    <div style={{ height: 3, background: '#E5E5E5', marginTop: 8 }}>
      <div style={{
        height: '100%',
        width: `${w}%`,
        backgroundColor: danger ? '#FF0000' : '#000',
        transition: 'width 0.9s cubic-bezier(0.4,0,0.2,1)',
      }} />
    </div>
  );
}

// ── Carte statut ─────────────────────────────────────────────────────────────
function StatutCard({ statut, nb, heures, quota, delay, visible }) {
  const animNb = useCountUp(nb, visible, 650);
  const ratio  = quota > 0 ? nb / quota : 0;
  const danger = ratio > 1;
  return (
    <div style={{
      flex: 1, minWidth: 130,
      padding: 16,
      border: `1px solid ${danger ? '#FF0000' : '#E5E5E5'}`,
      background: '#FAFAFA',
      opacity: visible ? 1 : 0,
      transform: visible ? 'translateY(0)' : 'translateY(10px)',
      transition: `opacity 0.45s ease ${delay}ms, transform 0.45s ease ${delay}ms`,
    }}>
      <Kicker className="mb-2">{statut}</Kicker>
      <div style={{ display: 'flex', alignItems: 'baseline', gap: 6 }}>
        <span style={{
          fontFamily: 'Georgia, serif',
          fontSize: 44,
          lineHeight: 1,
          color: danger ? '#FF0000' : '#000',
          fontVariantNumeric: 'tabular-nums',
        }}>{animNb}</span>
        <span style={{ fontFamily: 'monospace', fontSize: 10, color: '#737373' }}>dossiers</span>
      </div>
      <p style={{ fontFamily: 'monospace', fontSize: 10, color: '#737373', marginTop: 4 }}>
        {heures}h prévues
      </p>
      <QuotaBar ratio={ratio} danger={danger} delay={delay} />
      <p style={{ fontFamily: 'monospace', fontSize: 9, marginTop: 5, color: danger ? '#FF0000' : '#aaa' }}>
        {nb} / {quota} quota{danger ? ' — SEUIL DÉPASSÉ' : ''}
      </p>
    </div>
  );
}

// ── Graphique barres heures ──────────────────────────────────────────────────
function HeuresChart({ parStatut, visible }) {
  const actifs = PIPELINE.map(s => parStatut.find(r => r.statut === s) || { statut: s, heures_prevues: 0 });
  const max    = Math.max(...actifs.map(s => s.heures_prevues || 0), 1);
  const [heights, setHeights] = useState(actifs.map(() => 0));

  useEffect(() => {
    if (!visible) return;
    const t = setTimeout(() => {
      setHeights(actifs.map(s => ((s.heures_prevues || 0) / max) * 56));
    }, 300);
    return () => clearTimeout(t);
  }, [visible]); // eslint-disable-line

  return (
    <div style={{ background: '#FAFAFA', border: '1px solid #E5E5E5', padding: 20 }}>
      <Kicker className="mb-5">Heures prévues par statut</Kicker>
      <div style={{ display: 'flex', alignItems: 'flex-end', gap: 10, height: 72 }}>
        {actifs.map((s, i) => (
          <div key={s.statut} style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 4 }}>
            <span style={{ fontFamily: 'monospace', fontSize: 9, color: '#737373' }}>
              {s.heures_prevues || 0}h
            </span>
            <div style={{
              width: '100%',
              height: `${heights[i]}px`,
              backgroundColor: '#000',
              minHeight: 1,
              transition: 'height 0.9s cubic-bezier(0.4,0,0.2,1)',
            }} />
            <span style={{ fontFamily: 'monospace', fontSize: 8, color: '#737373', textAlign: 'center', lineHeight: 1.3 }}>
              {s.statut.replace('envoyé', 'env.').replace('atelier', 'atl.')}
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}

// ── Carte pertes / rentables ─────────────────────────────────────────────────
function FluxCard({ title, icon: Icon, items, mode }) {
  const isPertes = mode === 'pertes';
  return (
    <div style={{ flex: 1, background: '#FAFAFA', border: '1px solid #E5E5E5', padding: 20 }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 16 }}>
        <Icon size={13} />
        <Kicker>{title}</Kicker>
      </div>
      {items.length === 0 && (
        <p style={{ fontFamily: 'monospace', fontSize: 11, color: '#737373' }}>
          {isPertes ? 'Aucun dépassement d\'heures' : 'Aucun dossier en avance'}
        </p>
      )}
      {items.map(d => {
        const montant = Math.abs(d.ecart) * TAUX;
        return (
          <div key={d.id} style={{
            display: 'flex', justifyContent: 'space-between', alignItems: 'baseline',
            padding: '10px 0',
            borderTop: '1px dotted #ccc',
          }}>
            <div>
              <p style={{ fontFamily: 'Georgia, serif', fontSize: 14, color: '#000', margin: 0 }}>{d.nom_client}</p>
              <p style={{ fontFamily: 'monospace', fontSize: 10, color: '#737373', margin: 0 }}>{d.ref_dossier}</p>
            </div>
            <span style={{
              fontFamily: 'Georgia, serif',
              fontSize: 20,
              fontVariantNumeric: 'tabular-nums',
              color: isPertes ? '#FF0000' : '#000',
            }}>
              {isPertes ? '−' : '+'}{montant.toLocaleString('fr-FR', { style: 'currency', currency: 'EUR', maximumFractionDigits: 0 })}
            </span>
          </div>
        );
      })}
    </div>
  );
}

// ── Composant principal ──────────────────────────────────────────────────────
export default function ReportsPanel() {
  const [data, setData]       = useState(null);
  const [loading, setLoading] = useState(true);
  const [visible, setVisible] = useState(false);

  const load = async () => {
    setLoading(true);
    setVisible(false);
    const r = await fetch('/api/reports');
    setData(await r.json());
    setLoading(false);
    setTimeout(() => setVisible(true), 40);
  };

  useEffect(() => { load(); }, []);

  if (loading) return (
    <div style={{ padding: 40, textAlign: 'center', fontFamily: 'monospace', fontSize: 13, color: '#737373' }}>
      Chargement…
    </div>
  );
  if (!data) return null;

  const { parStatut = [], heuresComparaison = [] } = data;
  const statutMap = Object.fromEntries((parStatut).map(s => [s.statut, s]));

  const pertes = heuresComparaison
    .filter(d => d.ecart > 0 && d.reelles > 0)
    .sort((a, b) => b.ecart - a.ecart)
    .slice(0, 3);

  const rentables = heuresComparaison
    .filter(d => d.ecart < 0 && d.reelles > 0)
    .sort((a, b) => a.ecart - b.ecart)
    .slice(0, 3);

  const today = new Date().toLocaleDateString('fr-FR', { weekday: 'long', day: 'numeric', month: 'long' });

  return (
    <div>
      {/* En-tête */}
      <div className="flex items-end justify-between mb-6">
        <div>
          <Kicker className="mb-2">Module 05 — Pilotage hebdo</Kicker>
          <h2 className="font-serif text-[36px] tracking-[-0.01em] leading-[1.0] text-ink capitalize">{today}</h2>
        </div>
        <Btn variant="outline" onClick={load}>
          <RefreshCw size={12} /> Actualiser
        </Btn>
      </div>

      {/* 5 cartes statut pipeline */}
      <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap', marginBottom: 14 }}>
        {PIPELINE.map((statut, i) => {
          const s = statutMap[statut] || { nb: 0, heures_prevues: 0 };
          return (
            <StatutCard
              key={statut}
              statut={statut}
              nb={s.nb || 0}
              heures={s.heures_prevues || 0}
              quota={QUOTAS[statut]}
              delay={i * 90}
              visible={visible}
            />
          );
        })}
      </div>

      {/* Graphique heures */}
      <div style={{ marginBottom: 14 }}>
        <HeuresChart parStatut={parStatut} visible={visible} />
      </div>

      {/* Bas : pertes + rentables */}
      <div style={{ display: 'flex', gap: 14, flexWrap: 'wrap' }}>
        <FluxCard title="3 dossiers en perte" icon={TrendingDown} items={pertes} mode="pertes" />
        <FluxCard title="3 dossiers rentables" icon={TrendingUp} items={rentables} mode="rentables" />
      </div>
    </div>
  );
}
