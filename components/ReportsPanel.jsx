'use client';
import { useState, useEffect } from 'react';
import { BarChart2, TrendingUp, Clock, AlertTriangle, Euro, Package, RefreshCw } from 'lucide-react';

const INK    = '#000000';
const ACCENT = '#000000';
const SOFT   = '#EEEEEE';
const BG     = '#F5F5F5';

const STATUT_COLORS = {
  'Nouveau':       '#BBBBBB',
  'Devis envoyé':  '#888888',
  'Validé':        '#555555',
  'En atelier':    '#222222',
  'Prêt à poser':  '#000000',
  'Clos':          '#DDDDDD',
};

function KpiCard({ icon: Icon, label, value, sub, color = ACCENT }) {
  return (
    <div style={{ background: '#fff', border: '1px solid #E5E5E5', padding: '16px 18px', flex: 1, minWidth: 140 }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 8 }}>
        <Icon size={16} color={color} />
        <span style={{ fontSize: 11, color: '#888', textTransform: 'uppercase', letterSpacing: .5 }}>{label}</span>
      </div>
      <div style={{ fontSize: 26, fontWeight: 800, color: INK, lineHeight: 1 }}>{value}</div>
      {sub && <div style={{ fontSize: 12, color: '#888', marginTop: 4 }}>{sub}</div>}
    </div>
  );
}

function TableStatuts({ data }) {
  return (
    <div style={{ background: '#fff', border: '1px solid #E5E5E5', padding: 18, flex: 1 }}>
      <div style={{ fontWeight: 700, fontSize: 14, color: INK, marginBottom: 12 }}>Répartition par statut</div>
      <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
        <thead>
          <tr style={{ borderBottom: '2px solid #E5E5E5' }}>
            <th style={{ textAlign: 'left', padding: '4px 8px', color: '#888', fontWeight: 600 }}>Statut</th>
            <th style={{ textAlign: 'right', padding: '4px 8px', color: '#888', fontWeight: 600 }}>Nb</th>
            <th style={{ textAlign: 'right', padding: '4px 8px', color: '#888', fontWeight: 600 }}>CA HT</th>
            <th style={{ textAlign: 'right', padding: '4px 8px', color: '#888', fontWeight: 600 }}>H prévues</th>
          </tr>
        </thead>
        <tbody>
          {data.map(row => (
            <tr key={row.statut} style={{ borderBottom: '1px solid #E5E5E5' }}>
              <td style={{ padding: '7px 8px' }}>
                <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}>
                  <span style={{ width: 10, height: 10, borderRadius: '50%', background: STATUT_COLORS[row.statut] || '#AAA', display: 'inline-block' }} />
                  {row.statut}
                </span>
              </td>
              <td style={{ textAlign: 'right', padding: '7px 8px', fontWeight: 700 }}>{row.nb}</td>
              <td style={{ textAlign: 'right', padding: '7px 8px', color: ACCENT }}>{(row.total_ht || 0).toLocaleString('fr-FR', { style: 'currency', currency: 'EUR' })}</td>
              <td style={{ textAlign: 'right', padding: '7px 8px', color: '#888' }}>{row.heures_prevues || 0}h</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function TableHeuresComparaison({ data }) {
  if (!data || data.length === 0) return (
    <div style={{ background: '#F5F5F5', border: '1px solid #000', padding: 18, flex: 1 }}>
      <div style={{ fontWeight: 700, fontSize: 14, color: INK, marginBottom: 8 }}>Heures prévues vs réelles</div>
      <div style={{ fontSize: 13, color: '#888' }}>Aucune saisie d'heures pour le moment.<br/>
        Va dans un dossier et clique <b>"Saisir des heures"</b> pour démarrer le suivi.</div>
    </div>
  );

  return (
    <div style={{ background: '#fff', border: '1px solid #E5E5E5', padding: 18, flex: 1 }}>
      <div style={{ fontWeight: 700, fontSize: 14, color: INK, marginBottom: 12, display: 'flex', alignItems: 'center', gap: 8 }}>
        <Clock size={14} color={ACCENT} /> Heures prévues vs réelles (dossiers actifs)
      </div>
      <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12 }}>
        <thead>
          <tr style={{ borderBottom: '2px solid #E5E5E5' }}>
            <th style={{ textAlign: 'left', padding: '4px 6px', color: '#888', fontWeight: 600 }}>Client</th>
            <th style={{ textAlign: 'left', padding: '4px 6px', color: '#888', fontWeight: 600 }}>Statut</th>
            <th style={{ textAlign: 'right', padding: '4px 6px', color: '#888', fontWeight: 600 }}>H.prévues</th>
            <th style={{ textAlign: 'right', padding: '4px 6px', color: '#888', fontWeight: 600 }}>CA prévu</th>
            <th style={{ textAlign: 'right', padding: '4px 6px', color: '#888', fontWeight: 600 }}>H.réelles</th>
            <th style={{ textAlign: 'right', padding: '4px 6px', color: '#888', fontWeight: 600 }}>CA réel</th>
            <th style={{ textAlign: 'right', padding: '4px 6px', color: '#888', fontWeight: 600 }}>Écart H.</th>
          </tr>
        </thead>
        <tbody>
          {data.slice(0, 12).map(row => {
            const depasse = row.ecart > 0;
            const manque  = row.prevues > 0 && row.reelles === 0;
            return (
              <tr key={row.id} style={{ borderBottom: '1px solid #E5E5E5' }}>
                <td style={{ padding: '6px 6px' }}>
                  <div style={{ fontWeight: 600 }}>{row.nom_client}</div>
                  <div style={{ fontSize: 10, color: '#888' }}>{row.ref_dossier}</div>
                </td>
                <td style={{ padding: '6px 6px' }}>
                  <span style={{ fontSize: 11, background: SOFT, color: '#666', borderRadius: 4, padding: '2px 6px' }}>{row.statut}</span>
                </td>
                <td style={{ textAlign: 'right', padding: '6px 6px', fontWeight: 600 }}>{row.prevues}h</td>
                <td style={{ textAlign: 'right', padding: '6px 6px', fontSize: 11, color: '#000' }}>
                  {row.ca_prevu > 0 ? (row.ca_prevu).toLocaleString('fr-FR', { style: 'currency', currency: 'EUR', maximumFractionDigits: 0 }) : '—'}
                </td>
                <td style={{ textAlign: 'right', padding: '6px 6px' }}>{row.reelles > 0 ? `${row.reelles}h` : '—'}</td>
                <td style={{ textAlign: 'right', padding: '6px 6px', fontSize: 11, color: '#000', fontWeight: row.ca_reel > 0 ? 700 : 400 }}>
                  {row.ca_reel > 0 ? (row.ca_reel).toLocaleString('fr-FR', { style: 'currency', currency: 'EUR', maximumFractionDigits: 0 }) : '—'}
                </td>
                <td style={{ textAlign: 'right', padding: '6px 6px', fontWeight: 700,
                  color: manque ? '#888' : depasse ? '#000' : '#000', fontWeight: depasse ? 700 : 600 }}>
                  {manque ? '—' : depasse ? `+${row.ecart}h` : `-${Math.abs(row.ecart)}h`}
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}

function TableFournisseurs({ data }) {
  return (
    <div style={{ background: '#fff', border: '1px solid #E5E5E5', padding: 18, flex: 1, minWidth: 240 }}>
      <div style={{ fontWeight: 700, fontSize: 14, color: INK, marginBottom: 12 }}>Top fournisseurs</div>
      {data.map((f, i) => (
        <div key={f.fournisseur} style={{ display: 'flex', justifyContent: 'space-between', padding: '6px 0', borderBottom: '1px solid #E5E5E5', fontSize: 13 }}>
          <span style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <span style={{ width: 20, height: 20, borderRadius: '50%', background: SOFT, color: ACCENT, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 11, fontWeight: 700 }}>{i + 1}</span>
            {f.fournisseur}
          </span>
          <span style={{ color: '#888' }}>{f.nb_cmd} cmd.</span>
        </div>
      ))}
    </div>
  );
}

function BarresTypes({ data }) {
  const max = Math.max(...data.map(d => d.nb), 1);
  return (
    <div style={{ background: '#fff', border: '1px solid #E5E5E5', padding: 18, flex: 1, minWidth: 220 }}>
      <div style={{ fontWeight: 700, fontSize: 14, color: INK, marginBottom: 12 }}>Par type d'intervention</div>
      {data.map(row => (
        <div key={row.type_intervention} style={{ marginBottom: 10 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 12, marginBottom: 3 }}>
            <span style={{ color: INK }}>{row.type_intervention}</span>
            <span style={{ color: '#888' }}>{row.nb} dossiers</span>
          </div>
          <div style={{ background: '#E5E5E5', borderRadius: 4, height: 6 }}>
            <div style={{ width: `${(row.nb / max) * 100}%`, background: ACCENT, height: '100%', borderRadius: 4 }} />
          </div>
        </div>
      ))}
    </div>
  );
}

// ── Composant principal ───────────────────────────────────────────────────
export default function ReportsPanel() {
  const [data, setData]     = useState(null);
  const [loading, setLoading] = useState(true);

  const load = async () => {
    setLoading(true);
    const r = await fetch('/api/reports');
    setData(await r.json());
    setLoading(false);
  };

  useEffect(() => { load(); }, []);

  if (loading) return <div style={{ padding: 40, textAlign: 'center', color: '#888', fontFamily: 'DM Sans, sans-serif' }}>Chargement des rapports…</div>;
  if (!data)   return null;

  const { kpi, parStatut, parType, heuresComparaison, heuresParOp, topFournisseurs } = data;

  return (
    <div style={{ fontFamily: 'DM Sans, sans-serif', maxWidth: 1100 }}>
      {/* KPIs */}
      <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap', marginBottom: 20 }}>
        <KpiCard icon={Package}    label="Dossiers actifs"  value={kpi.dossiers_actifs} sub={`${kpi.total_dossiers} au total`} />
        <KpiCard icon={Euro}       label="CA prévu (devis)" value={(kpi.ca_pipeline || 0).toLocaleString('fr-FR', { style: 'currency', currency: 'EUR' })} sub={`${kpi.total_heures_prevues || 0}h × 55€ HT`} />
        <KpiCard icon={TrendingUp} label="CA réalisé"       value={(kpi.ca_realise || 0).toLocaleString('fr-FR', { style: 'currency', currency: 'EUR' })} sub={`${kpi.total_heures_reelles || 0}h réelles saisies`} color="#000" />
        <KpiCard icon={Clock}      label="Opérateurs"       value={kpi.nb_operateurs || 0} sub={`${kpi.dossiers_avec_heures || 0} dossiers avec saisies`} />
        {kpi.nb_urgent > 0 && <KpiCard icon={AlertTriangle} label="Urgents" value={kpi.nb_urgent} sub={`${kpi.nb_sav} SAV`} color="#000" />}
      </div>

      {/* Ligne 1 */}
      <div style={{ display: 'flex', gap: 14, flexWrap: 'wrap', marginBottom: 14 }}>
        <TableStatuts data={parStatut} />
        <BarresTypes data={parType} />
      </div>

      {/* Ligne 2 : heures */}
      <div style={{ display: 'flex', gap: 14, flexWrap: 'wrap', marginBottom: 14 }}>
        <TableHeuresComparaison data={heuresComparaison} />
      </div>

      {/* Ligne 3 : opérateurs + fournisseurs */}
      <div style={{ display: 'flex', gap: 14, flexWrap: 'wrap' }}>
        {heuresParOp.length > 0 && (
          <div style={{ background: '#fff', border: '1px solid #E5E5E5', padding: 18, flex: 1, minWidth: 220 }}>
            <div style={{ fontWeight: 700, fontSize: 14, color: INK, marginBottom: 12 }}>Heures par opérateur</div>
            {heuresParOp.map(op => (
              <div key={op.operateur} style={{ marginBottom: 10 }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 13, marginBottom: 2 }}>
                  <span style={{ fontWeight: 600 }}>{op.operateur}</span>
                  <span style={{ color: ACCENT, fontWeight: 700 }}>{op.total}h</span>
                </div>
                <div style={{ fontSize: 11, color: '#AAA' }}>
                  {op.nb_saisies} saisies · {op.nb_dossiers} dossiers · dernière le {op.derniere_saisie}
                </div>
              </div>
            ))}
          </div>
        )}
        <TableFournisseurs data={topFournisseurs} />
      </div>

      <div style={{ marginTop: 16, display: 'flex', justifyContent: 'flex-end' }}>
        <button onClick={load} style={{
          background: 'none', border: '1px solid #E5E5E5', borderRadius: 6, padding: '6px 14px',
          fontSize: 12, color: '#888', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 6,
        }}>
          <RefreshCw size={12} /> Actualiser
        </button>
      </div>
    </div>
  );
}
