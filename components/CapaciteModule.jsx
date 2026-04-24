'use client';
import { useState, useEffect } from 'react';
import { AlertTriangle, Clock } from 'lucide-react';

const INK    = '#000000';
const ACCENT = '#000000';
const BG     = '#F5F5F5';

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

export default function CapaciteModule() {
  const [capacite, setCapacite] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const now = new Date();
    const joursOuvres = joursTravailDuMois(now.getFullYear(), now.getMonth());
    const capaciteMensuelle = OPERATEURS.length * joursOuvres * HEURES_PAR_JOUR;

    const calculate = (dossiers, synthese) => {
      const totalPrevues   = dossiers.reduce((s, d) => s + (d.heures_a_realiser || 0), 0);
      const totalRealisees = synthese.reelles || 0;
      const heuresRestantes = Math.max(0, totalPrevues - totalRealisees);
      const joursEstimes = joursOuvres > 0
        ? Math.ceil(heuresRestantes / (OPERATEURS.length * HEURES_PAR_JOUR))
        : 0;
      const chargePercent = totalPrevues > 0
        ? Math.round((totalPrevues / capaciteMensuelle) * 100)
        : 0;

      setCapacite({
        totalPrevues, totalRealisees, heuresRestantes,
        capaciteMensuelle, joursOuvres, joursEstimes, chargePercent,
        critique: chargePercent > 100,
      });
    };

    const eventSource = new EventSource('/api/sync?action=subscribe');
    eventSource.addEventListener('initial', e => {
      setLoading(false);
      const data = JSON.parse(e.data);
      calculate(data.dossiers, data.synthese);
    });
    eventSource.addEventListener('update', e => {
      const data = JSON.parse(e.data);
      calculate(data.dossiers, data.synthese);
    });
    eventSource.onerror = () => { eventSource.close(); setLoading(false); };
    return () => eventSource.close();
  }, []);

  if (loading || !capacite) return null;

  const { totalPrevues, totalRealisees, heuresRestantes, capaciteMensuelle, chargePercent, joursOuvres, critique } = capacite;
  // Remplissage = heures déjà réalisées ce mois / capacité totale
  const fillPct = capaciteMensuelle > 0 ? Math.min(Math.round((totalRealisees / capaciteMensuelle) * 100), 100) : 0;
  const loadPct = chargePercent; // charge prévue

  return (
    <div style={{
      position: 'fixed', bottom: 20, right: 20,
      background: '#fff', border: `2px solid ${critique ? '#FF0000' : '#000'}`,
      padding: 16, width: 240, fontFamily: 'DM Sans, sans-serif', zIndex: 100,
    }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 }}>
        <span style={{ fontWeight: 700, fontSize: 13, color: INK }}>Charge atelier</span>
        <span style={{ fontSize: 11, color: '#888' }}>{joursOuvres}j · {capaciteMensuelle}h</span>
      </div>

      {/* Jauge verticale de remplissage */}
      <div style={{ display: 'flex', gap: 10, alignItems: 'flex-end', marginBottom: 12 }}>
        {/* Cuve */}
        <div style={{ position: 'relative', width: 36, height: 90, border: '2px solid #000', background: '#F5F5F5', flexShrink: 0 }}>
          {/* Charge prévue (fond gris) */}
          <div style={{
            position: 'absolute', bottom: 0, left: 0, right: 0,
            height: `${Math.min(loadPct, 100)}%`,
            background: critique ? 'rgba(255,0,0,0.15)' : '#E5E5E5',
          }} />
          {/* Réalisé (remplissage noir) */}
          <div style={{
            position: 'absolute', bottom: 0, left: 0, right: 0,
            height: `${fillPct}%`,
            background: critique ? '#FF0000' : '#000',
            transition: 'height 0.4s ease',
          }} />
          {/* Ligne 100% */}
          <div style={{ position: 'absolute', top: 0, left: 0, right: 0, height: 1, background: '#000', opacity: 0.3 }} />
        </div>

        {/* Légende */}
        <div style={{ flex: 1 }}>
          <div style={{ fontSize: 22, fontWeight: 800, color: INK, lineHeight: 1 }}>{heuresRestantes}h</div>
          <div style={{ fontSize: 11, color: '#888', marginTop: 3 }}>restantes</div>
          <div style={{ marginTop: 8, fontSize: 11 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', color: '#888' }}>
              <span>Réalisé</span><span style={{ color: INK, fontWeight: 600 }}>{fillPct}%</span>
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between', color: '#888', marginTop: 2 }}>
              <span>Prévu</span><span style={{ color: critique ? '#FF0000' : INK, fontWeight: 600 }}>{loadPct}%</span>
            </div>
          </div>
        </div>
      </div>

      <div style={{ fontSize: 11, color: '#888', borderTop: '1px solid #E5E5E5', paddingTop: 8 }}>
        {totalPrevues}h prévues · {totalRealisees}h faites · {OPERATEURS.length}×8h/j
      </div>

      {critique && (
        <div style={{ marginTop: 8, background: '#FFF5F5', border: '1px solid #FF0000', padding: 8, fontSize: 11, color: '#000', display: 'flex', gap: 6, alignItems: 'flex-start' }}>
          <AlertTriangle size={13} color="#FF0000" style={{ flexShrink: 0 }} />
          <span>Capacité insuffisante ce mois.</span>
        </div>
      )}
    </div>
  );
}
