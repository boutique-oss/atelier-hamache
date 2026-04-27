'use client';
import { useState, useEffect } from 'react';
import { RefreshCw } from 'lucide-react';
import Kicker from './ui/Kicker';
import Btn from './ui/Btn';

function KpiCard({ label, value, sub }) {
  return (
    <div className="bg-surface border border-line p-5 flex-1" style={{ minWidth: 160 }}>
      <Kicker className="mb-2">{label}</Kicker>
      <p className="font-serif tnum text-[44px] leading-none text-ink">{value}</p>
      {sub && <p className="font-mono text-[10px] text-muted mt-2 tnum">{sub}</p>}
    </div>
  );
}

function TableStatuts({ data }) {
  return (
    <div className="bg-surface border border-line p-5 flex-1">
      <Kicker className="mb-3">Répartition par statut</Kicker>
      <table className="w-full">
        <thead>
          <tr className="border-b border-ink">
            {['Statut', 'Nb', 'CA HT', 'H prévues'].map((h, i) => (
              <th key={i} className={`py-2 font-mono text-[10px] uppercase tracking-[0.12em] text-muted ${i > 0 ? 'text-right' : 'text-left'}`}>{h}</th>
            ))}
          </tr>
        </thead>
        <tbody>
          {data.map(row => (
            <tr key={row.statut} className="border-t border-dotted border-black/30">
              <td className="py-2 font-serif text-[13px] text-ink">{row.statut}</td>
              <td className="py-2 text-right font-serif tnum text-[14px] text-ink">{row.nb}</td>
              <td className="py-2 text-right font-mono tnum text-[11px] text-muted">
                {(row.total_ht || 0).toLocaleString('fr-FR', { style: 'currency', currency: 'EUR' })}
              </td>
              <td className="py-2 text-right font-mono tnum text-[11px] text-muted">{row.heures_prevues || 0}h</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function TableHeuresComparaison({ data }) {
  if (!data || data.length === 0) return (
    <div className="bg-bg border border-ink p-5 flex-1">
      <Kicker className="mb-2">Heures prévues vs réelles</Kicker>
      <p className="font-sans text-[13px] text-muted mt-2">
        Aucune saisie d&apos;heures pour le moment.{' '}
        Va dans un dossier et clique <strong>«&nbsp;Saisir des heures&nbsp;»</strong> pour démarrer.
      </p>
    </div>
  );

  return (
    <div className="bg-surface border border-line p-5 flex-1">
      <Kicker className="mb-3">Heures prévues vs réelles — dossiers actifs</Kicker>
      <table className="w-full">
        <thead>
          <tr className="border-b border-ink">
            {['Client', 'Statut', 'H.prévues', 'CA prévu', 'H.réelles', 'CA réel', 'Écart'].map((h, i) => (
              <th key={i} className={`py-2 font-mono text-[10px] uppercase tracking-[0.12em] text-muted ${i > 1 ? 'text-right' : 'text-left'}`}>{h}</th>
            ))}
          </tr>
        </thead>
        <tbody>
          {data.slice(0, 12).map(row => {
            const depasse = row.ecart > 0;
            const manque  = row.prevues > 0 && row.reelles === 0;
            return (
              <tr key={row.id} className="border-t border-dotted border-black/30">
                <td className="py-1.5">
                  <p className="font-serif text-[13px] text-ink">{row.nom_client}</p>
                  <p className="font-mono text-[10px] text-muted">{row.ref_dossier}</p>
                </td>
                <td className="py-1.5">
                  <span className="font-mono text-[10px] uppercase tracking-[0.12em] border border-line px-1.5 py-0.5 text-muted">
                    {row.statut}
                  </span>
                </td>
                <td className="py-1.5 text-right font-serif tnum text-[13px] text-ink">{row.prevues}h</td>
                <td className="py-1.5 text-right font-mono tnum text-[11px] text-muted">
                  {row.ca_prevu > 0 ? row.ca_prevu.toLocaleString('fr-FR', { style: 'currency', currency: 'EUR', maximumFractionDigits: 0 }) : '—'}
                </td>
                <td className="py-1.5 text-right font-serif tnum text-[13px] text-ink">
                  {row.reelles > 0 ? `${row.reelles}h` : '—'}
                </td>
                <td className="py-1.5 text-right font-mono tnum text-[11px] text-muted">
                  {row.ca_reel > 0 ? row.ca_reel.toLocaleString('fr-FR', { style: 'currency', currency: 'EUR', maximumFractionDigits: 0 }) : '—'}
                </td>
                <td className="py-1.5 text-right font-mono tnum text-[11px]"
                    style={{ color: manque ? '#737373' : depasse ? '#FF0000' : '#000', fontWeight: depasse ? 700 : 400 }}>
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

function BarresTypes({ data }) {
  const max = Math.max(...data.map(d => d.nb), 1);
  return (
    <div className="bg-surface border border-line p-5 flex-1" style={{ minWidth: 220 }}>
      <Kicker className="mb-4">Par type d&apos;intervention</Kicker>
      {data.map(row => (
        <div key={row.type_intervention} className="mb-3">
          <div className="flex justify-between font-sans text-[13px] mb-1">
            <span className="text-ink">{row.type_intervention}</span>
            <span className="font-mono tnum text-[11px] text-muted">{row.nb} dossiers</span>
          </div>
          <div className="bg-line h-1.5">
            <div className="h-full bg-ink" style={{ width: `${(row.nb / max) * 100}%` }} />
          </div>
        </div>
      ))}
    </div>
  );
}

function TableFournisseurs({ data }) {
  return (
    <div className="bg-surface border border-line p-5 flex-1" style={{ minWidth: 240 }}>
      <Kicker className="mb-3">Top fournisseurs</Kicker>
      {data.map((f, i) => (
        <div key={f.fournisseur} className="flex justify-between items-center py-2 border-t border-dotted border-black/30 first:border-0">
          <div className="flex items-center gap-3">
            <span className="font-serif text-[18px] tnum text-muted w-6">{i + 1}</span>
            <span className="font-serif text-[13px] text-ink">{f.fournisseur}</span>
          </div>
          <span className="font-mono text-[11px] tnum text-muted">{f.nb_cmd} cmd.</span>
        </div>
      ))}
    </div>
  );
}

export default function ReportsPanel() {
  const [data, setData]       = useState(null);
  const [loading, setLoading] = useState(true);

  const load = async () => {
    setLoading(true);
    const r = await fetch('/api/reports');
    setData(await r.json());
    setLoading(false);
  };

  useEffect(() => { load(); }, []);

  if (loading) return (
    <div className="p-10 text-center font-sans text-[13px] text-muted">Chargement des rapports…</div>
  );
  if (!data) return null;

  const { kpi, parStatut, parType, heuresComparaison, heuresParOp, topFournisseurs } = data;

  return (
    <div>
      {/* En-tête */}
      <div className="flex items-end justify-between mb-6">
        <div>
          <Kicker className="mb-2">Module 05</Kicker>
          <h2 className="font-serif text-[36px] tracking-[-0.01em] leading-[1.0] text-ink">Rapports</h2>
        </div>
        <Btn variant="outline" onClick={load}>
          <RefreshCw size={12} /> Actualiser
        </Btn>
      </div>

      {/* 4 KPI géants */}
      <div className="flex gap-3 flex-wrap mb-5">
        <KpiCard label="Dossiers actifs"  value={kpi.dossiers_actifs}
          sub={`${kpi.total_dossiers} au total`} />
        <KpiCard label="CA prévu (devis)"
          value={(kpi.ca_pipeline || 0).toLocaleString('fr-FR', { style: 'currency', currency: 'EUR' })}
          sub={`${kpi.total_heures_prevues || 0}h × 55€ HT`} />
        <KpiCard label="CA réalisé"
          value={(kpi.ca_realise || 0).toLocaleString('fr-FR', { style: 'currency', currency: 'EUR' })}
          sub={`${kpi.total_heures_reelles || 0}h réelles`} />
        <KpiCard label="Opérateurs"
          value={kpi.nb_operateurs || 0}
          sub={`${kpi.dossiers_avec_heures || 0} dossiers avec saisies`} />
        {kpi.nb_urgent > 0 && (
          <KpiCard label="Urgents" value={kpi.nb_urgent} sub={`${kpi.nb_sav} SAV`} />
        )}
      </div>

      {/* Statuts + types */}
      <div className="flex gap-4 flex-wrap mb-4">
        <TableStatuts data={parStatut} />
        <BarresTypes data={parType} />
      </div>

      {/* Heures comparaison */}
      <div className="flex gap-4 flex-wrap mb-4">
        <TableHeuresComparaison data={heuresComparaison} />
      </div>

      {/* Opérateurs + fournisseurs */}
      <div className="flex gap-4 flex-wrap">
        {heuresParOp.length > 0 && (
          <div className="bg-surface border border-line p-5 flex-1" style={{ minWidth: 220 }}>
            <Kicker className="mb-3">Heures par opérateur</Kicker>
            {heuresParOp.map(op => (
              <div key={op.operateur} className="mb-4">
                <div className="flex justify-between items-baseline mb-0.5">
                  <span className="font-serif text-[14px] text-ink">{op.operateur}</span>
                  <span className="font-serif tnum text-[20px] text-ink">{op.total}h</span>
                </div>
                <p className="font-mono text-[10px] text-muted">
                  {op.nb_saisies} saisies · {op.nb_dossiers} dossiers · dernière le {op.derniere_saisie}
                </p>
              </div>
            ))}
          </div>
        )}
        <TableFournisseurs data={topFournisseurs} />
      </div>
    </div>
  );
}
