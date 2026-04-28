'use client';
import { useState, useEffect } from 'react';
import { Download, FileText, Printer, BarChart2, RefreshCw, ExternalLink } from 'lucide-react';
import Kicker from './ui/Kicker';
import Btn from './ui/Btn';

// ── Bouton d'export avec compteur ──────────────────────────────────────────

function ExportBtn({ href, icon: Icon, label, sub, accent }) {
  return (
    <a
      href={href}
      target="_blank"
      rel="noreferrer"
      className={`flex items-start gap-3 p-4 border transition-colors group ${
        accent
          ? 'bg-ink text-surface border-ink hover:bg-black'
          : 'bg-surface text-ink border-line hover:border-ink hover:bg-bg'
      }`}
    >
      <Icon size={14} className={`mt-0.5 shrink-0 ${accent ? 'text-surface/70' : 'text-muted'}`} />
      <div className="min-w-0">
        <p className={`font-sans text-[13px] font-medium leading-tight ${accent ? 'text-surface' : 'text-ink'}`}>
          {label}
        </p>
        {sub && (
          <p className={`font-mono text-[10px] mt-0.5 ${accent ? 'text-surface/60' : 'text-muted'}`}>
            {sub}
          </p>
        )}
      </div>
      <ExternalLink size={10} className={`ml-auto shrink-0 mt-0.5 opacity-0 group-hover:opacity-60`} />
    </a>
  );
}

// ── Fiche individuelle cliquable ───────────────────────────────────────────

function FicheRow({ dossier }) {
  return (
    <a
      href={`/fiche-impression/${dossier.id}`}
      target="_blank"
      rel="noreferrer"
      className="flex items-center justify-between px-4 py-2.5 border-t border-dotted border-black/20 hover:bg-bg group"
    >
      <div className="flex items-baseline gap-3 min-w-0">
        <span className="font-serif text-[14px] text-ink truncate">{dossier.nom_dossier}</span>
        {dossier.client_nom && dossier.client_nom !== dossier.nom_dossier && (
          <span className="font-sans text-[12px] text-muted truncate hidden sm:block">{dossier.client_nom}</span>
        )}
      </div>
      <div className="flex items-center gap-3 shrink-0 ml-4">
        {dossier.heures_a_realiser > 0 && (
          <span className="font-mono tnum text-[11px] text-muted">{dossier.heures_a_realiser}h</span>
        )}
        {dossier.type_intervention && (
          <span className="font-mono text-[9px] uppercase tracking-[0.12em] text-muted border border-line px-1.5 py-0.5">
            {dossier.type_intervention}
          </span>
        )}
        <Printer size={12} className="text-muted opacity-0 group-hover:opacity-100" />
      </div>
    </a>
  );
}

// ── Composant principal ────────────────────────────────────────────────────

export default function ImportExportPanel() {
  const [counts, setCounts] = useState(null);
  const [loading, setLoading] = useState(true);

  const load = async () => {
    setLoading(true);
    try {
      const r = await fetch('/api/export-counts');
      setCounts(await r.json());
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { load(); }, []);

  return (
    <div>
      {/* En-tête module */}
      <div className="flex items-end justify-between mb-6">
        <div>
          <Kicker className="mb-2">Module 07</Kicker>
          <h2 className="font-serif text-[36px] tracking-[-0.01em] leading-[1.0] text-ink">
            Export PDF
          </h2>
          <p className="font-sans text-[13px] text-muted mt-1">
            Ouvre un aperçu mis en page dans un nouvel onglet · Imprimer ou Enregistrer en PDF
          </p>
        </div>
        <Btn variant="outline" onClick={load} disabled={loading}>
          <RefreshCw size={12} className={loading ? 'animate-spin' : ''} /> Actualiser
        </Btn>
      </div>

      {/* ── ZONE 1 — Fiches individuelles en atelier ───────────────── */}
      <section className="mb-8">
        <div className="flex items-center justify-between mb-3">
          <Kicker>Fiches individuelles — En atelier</Kicker>
          {counts && (
            <span className="font-mono text-[10px] tnum text-muted">
              {counts.dossiers.enAtelier} dossier{counts.dossiers.enAtelier !== 1 ? 's' : ''}
            </span>
          )}
        </div>

        <div className="border border-ink bg-surface">
          {loading ? (
            <p className="px-4 py-6 text-center font-sans text-[13px] text-muted">Chargement…</p>
          ) : counts?.fichesEnAtelier?.length > 0 ? (
            <>
              {counts.fichesEnAtelier.map(d => (
                <FicheRow key={d.id} dossier={d} />
              ))}
              <div className="px-4 py-2 border-t border-line bg-bg">
                <p className="font-mono text-[10px] text-muted">
                  Clique sur un dossier pour ouvrir sa fiche d&apos;atelier imprimable
                </p>
              </div>
            </>
          ) : (
            <p className="px-4 py-8 text-center font-sans text-[13px] text-muted">
              Aucun dossier en atelier en ce moment.
            </p>
          )}
        </div>
      </section>

      {/* ── ZONE 2 — Exports groupés ───────────────────────────────── */}
      <section className="mb-8">
        <Kicker className="mb-3">Exports groupés</Kicker>

        <div className="mb-4">
          <p className="font-mono text-[10px] uppercase tracking-[0.12em] text-muted mb-2">
            Ateliers
          </p>
          <div className="grid grid-cols-2 gap-2">
            <ExportBtn
              href="/api/export?type=dossiers"
              icon={FileText}
              label="Atelier TAP — Dossiers"
              sub={
                counts
                  ? `${counts.dossiers.total} actifs · ${counts.dossiers.enAtelier} en atelier · ${counts.dossiers.pretAPoser} prêts`
                  : 'Chargement…'
              }
            />
            <ExportBtn
              href="/api/export?type=rideaux"
              icon={FileText}
              label="Atelier COUT — Rideaux"
              sub={
                counts
                  ? `${counts.rideaux.total} fiche${counts.rideaux.total !== 1 ? 's' : ''}`
                  : 'Chargement…'
              }
            />
          </div>
        </div>

        <div>
          <p className="font-mono text-[10px] uppercase tracking-[0.12em] text-muted mb-2">
            Données de gestion
          </p>
          <div className="grid grid-cols-2 gap-2">
            <ExportBtn
              href="/api/export?type=commandes"
              icon={Download}
              label="Commandes tissu"
              sub={
                counts
                  ? `${counts.commandes.total} commandes · ${counts.commandes.enAttente} en attente`
                  : 'Chargement…'
              }
            />
            <ExportBtn
              href="/api/export?type=heures"
              icon={Download}
              label="Saisies d'heures"
              sub={
                counts
                  ? `${counts.heures.saisies} saisie${counts.heures.saisies !== 1 ? 's' : ''} enregistrée${counts.heures.saisies !== 1 ? 's' : ''}`
                  : 'Chargement…'
              }
            />
          </div>
        </div>
      </section>

      {/* ── ZONE 3 — Rapports ──────────────────────────────────────── */}
      <section>
        <Kicker className="mb-3">Rapports</Kicker>
        <div className="grid grid-cols-2 gap-2">
          <ExportBtn
            href="/api/export?type=rapport"
            icon={BarChart2}
            label="Rapport de synthèse"
            sub="Heures prévues / réelles · opérateurs · statuts"
          />
          <ExportBtn
            href="/api/export?type=complet"
            icon={Printer}
            label="Tout exporter"
            sub="Dossiers · Rideaux · Commandes · Heures · Synthèse"
            accent
          />
        </div>
      </section>
    </div>
  );
}
