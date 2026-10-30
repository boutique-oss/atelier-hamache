"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { ChevronRight, Eye } from "lucide-react";

import { HeuresForm } from "@/components/heures-form";
import type { FicheSummary } from "@/lib/fiche-summary";

// Ligne d'un dossier Clos à compléter : saisie d'heures inline + aperçu de la
// fiche de travail (clic droit OU bouton œil → carte résumé). Le clic droit ne
// marchant pas au toucher, le bouton œil assure l'accès sur tablette.
export function ClosDossierRow({
  dossier,
  saisi,
  summary,
  operateurs,
}: {
  dossier: {
    id: number;
    nom: string;
    client: string | null;
    estime: number | null;
    type: string | null;
  };
  saisi: number;
  summary: FicheSummary | null;
  operateurs: string[];
}) {
  const [apercuOuvert, setApercuOuvert] = useState(false);
  const popRef = useRef<HTMLDivElement>(null);
  const estime = dossier.estime ?? 0;
  const manque = saisi === 0;

  // Fermeture au clic extérieur + touche Échap.
  useEffect(() => {
    if (!apercuOuvert) return;
    const onClick = (e: MouseEvent) => {
      if (popRef.current && !popRef.current.contains(e.target as Node)) {
        setApercuOuvert(false);
      }
    };
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && setApercuOuvert(false);
    document.addEventListener("mousedown", onClick);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onClick);
      document.removeEventListener("keydown", onKey);
    };
  }, [apercuOuvert]);

  const ouvrirApercu = (e: React.MouseEvent) => {
    // Clic droit : on remplace le menu contextuel natif par l'aperçu fiche.
    e.preventDefault();
    if (summary) setApercuOuvert(true);
  };

  return (
    <details className="group/d relative px-4 py-3" onContextMenu={ouvrirApercu}>
      <summary className="flex cursor-pointer list-none flex-wrap items-center justify-between gap-2 [&::-webkit-details-marker]:hidden">
        <span className="flex min-w-0 items-center gap-1.5">
          <ChevronRight className="h-3.5 w-3.5 shrink-0 text-muted-foreground transition-transform group-open/d:rotate-90" />
          <span className="font-medium">{dossier.nom}</span>
          {dossier.client && (
            <span className="text-sm text-muted-foreground">· {dossier.client}</span>
          )}
        </span>
        <span className="flex items-center gap-2 text-xs">
          <span className="tabular-nums text-muted-foreground">
            {saisi} h saisies{estime > 0 ? ` / ${estime} h estimées` : ""}
          </span>
          {manque ? (
            <span className="rounded-md bg-amber-100 px-2 py-0.5 font-medium text-amber-800">
              à compléter
            </span>
          ) : (
            <span className="rounded-md bg-emerald-100 px-2 py-0.5 font-medium text-emerald-800">
              ✓ heures saisies
            </span>
          )}
          {/* Bouton œil : aperçu fiche (marche au toucher, contrairement au clic droit). */}
          <button
            type="button"
            onClick={(e) => {
              e.preventDefault();
              if (summary) setApercuOuvert((v) => !v);
            }}
            disabled={!summary}
            title={summary ? "Aperçu de la fiche de travail" : "Aucune fiche"}
            aria-label="Aperçu de la fiche de travail"
            className="rounded-md border p-1 text-muted-foreground hover:bg-accent hover:text-foreground disabled:opacity-40"
          >
            <Eye className="h-3.5 w-3.5" />
          </button>
        </span>
      </summary>

      {/* Carte d'aperçu de la fiche (clic droit / bouton œil) */}
      {apercuOuvert && summary && (
        <div
          ref={popRef}
          className="absolute right-4 top-12 z-30 w-80 overflow-hidden rounded-xl border bg-card shadow-xl"
          onClick={(e) => e.stopPropagation()}
        >
          <div className="brand-dark flex items-center justify-between px-3 py-2 text-white">
            <span className="flex items-center gap-1.5 text-xs font-semibold">
              <span className="brand-eyebrow">Fiche de travail</span>
            </span>
            <span className="rounded bg-primary px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider text-primary-foreground">
              {summary.type}
            </span>
          </div>
          <div className="p-3">
            <div className="mb-2 flex items-baseline justify-between gap-2">
              <span className="font-semibold">{dossier.nom}</span>
              {summary.heuresEstimees && (
                <span className="shrink-0 text-xs text-muted-foreground">
                  est. <span className="font-semibold text-primary">{summary.heuresEstimees}</span>
                </span>
              )}
            </div>
            <dl className="space-y-0.5">
              {summary.lignes.map((l) => (
                <div
                  key={l.label}
                  className="flex justify-between gap-3 border-b border-dotted py-1 text-xs"
                >
                  <dt className="shrink-0 text-muted-foreground">{l.label}</dt>
                  <dd className="text-right font-medium">{l.value}</dd>
                </div>
              ))}
              {summary.tissu && (
                <div className="flex justify-between gap-3 border-b border-dotted py-1 text-xs">
                  <dt className="shrink-0 text-muted-foreground">Tissu</dt>
                  <dd className="text-right font-medium">{summary.tissu}</dd>
                </div>
              )}
              {summary.etapes && (
                <div className="flex justify-between gap-3 py-1 text-xs">
                  <dt className="shrink-0 text-muted-foreground">Étapes</dt>
                  <dd className="truncate text-right text-muted-foreground">{summary.etapes}</dd>
                </div>
              )}
            </dl>
            {summary.notes && (
              <p className="mt-2 rounded-md bg-muted/50 px-2 py-1.5 text-[11px] text-muted-foreground">
                {summary.notes}
              </p>
            )}
            <div className="mt-3 flex gap-2">
              <Link
                href={`/dossiers/${dossier.id}/fiche/${summary.ficheId}`}
                target="_blank"
                rel="noopener noreferrer"
                className="flex-1 rounded-md border border-primary/40 py-1 text-center text-xs font-medium text-primary hover:bg-primary/5"
              >
                Ouvrir la fiche ↗
              </Link>
              <a
                href={`/fiche-impression/${summary.ficheId}`}
                target="_blank"
                rel="noopener noreferrer"
                className="flex-1 rounded-md border py-1 text-center text-xs text-muted-foreground hover:bg-accent"
              >
                Imprimer ↗
              </a>
            </div>
          </div>
        </div>
      )}

      <div className="mt-2">
        <Link
          href={`/dossiers/${dossier.id}`}
          target="_blank"
          rel="noopener noreferrer"
          className="text-xs text-primary hover:underline"
        >
          Ouvrir le dossier →
        </Link>
        {/* Saisie inline : opérateur(s), heures, type de réalisation… */}
        <HeuresForm
          dossierId={dossier.id}
          operateurs={operateurs}
          typeIntervention={dossier.type}
        />
      </div>
    </details>
  );
}
