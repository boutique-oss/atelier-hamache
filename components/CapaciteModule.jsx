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

  const { totalPrevues, heuresRestantes, chargePercent, joursEstimes, joursOuvres, critique } = capacite;

  return (
    <div style={{
      position: 'fixed', bottom: 20, right: 20,
      background: '#fff', border: `2px solid ${critique ? '#FF0000' : '#000'}`,
      padding: 16, width: 260, fontFamily: 'DM Sans, sans-serif', zIndex: 100,
    }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 12 }}>
        {critique && <AlertTriangle size={16} color="#FF0000" />}
        <span style={{ fontWeight: 700, fontSize: 14, color: INK }}>Charge atelier</span>
        <span style={{ fontSize: 11, color: '#888', marginLeft: 'auto' }}>{joursOuvres}j ouvrés/mois</span>
      </div>

      <div style={{ marginBottom: 14 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 12, marginBottom: 4 }}>
          <span style={{ color: '#888' }}>Utilisation capacité</span>
          <span style={{ fontWeight: 700, color: critique ? '#FF0000' : ACCENT }}>{chargePercent}%</span>
        </div>
        <div style={{ background: '#E5E5E5', height: 6 }}>
          <div style={{ width: `${Math.min(chargePercent, 100)}%`, background: critique ? '#FF0000' : '#444', height: '100%' }} />
        </div>
      </div>

      <div style={{ background: BG, border: '1px solid #E5E5E5', padding: 12 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 6 }}>
          <Clock size={13} color={ACCENT} />
          <span style={{ fontSize: 11, color: '#888', fontWeight: 600, textTransform: 'uppercase' }}>Stock heures</span>
        </div>
        <div style={{ fontSize: 22, fontWeight: 800, color: INK }}>{heuresRestantes}h</div>
        <div style={{ fontSize: 11, color: '#888', marginTop: 4 }}>
          {totalPrevues}h prévues · {joursEstimes}j estimés · {OPERATEURS.length} opérateurs × 8h/j
        </div>
      </div>

      {critique && (
        <div style={{ marginTop: 10, background: '#FFF5F5', border: '1px solid #FF0000', padding: 10, fontSize: 11, color: '#000', display: 'flex', gap: 8, alignItems: 'flex-start' }}>
          <AlertTriangle size={14} color="#FF0000" style={{ flexShrink: 0 }} />
          <span>Charge dépasse 100 %. Capacité insuffisante.</span>
        </div>
      )}
    </div>
  );
}
