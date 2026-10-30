"use client";

import { useState } from "react";

import type { CompletionItem } from "@/lib/dossier-completion";

// Couleur de la barre selon le taux de remplissage.
function barColor(pct: number): string {
  if (pct >= 80) return "hsl(142 70% 42%)"; // vert
  if (pct >= 50) return "hsl(38 92% 50%)"; // ambre
  return "hsl(0 72% 51%)"; // rouge
}

// Barre de progression du remplissage d'un dossier (liste des dossiers).
// Clic droit (ou clic) : détail des champs remplis / manquants.
export function CompletionCell({
  pct,
  filledCount,
  total,
  items,
}: {
  pct: number;
  filledCount: number;
  total: number;
  items: CompletionItem[];
}) {
  const [open, setOpen] = useState(false);
  const missing = items.filter((i) => !i.filled);

  return (
    <div className="relative">
      <button
        type="button"
        onClick={(e) => {
          e.preventDefault();
          setOpen((o) => !o);
        }}
        onContextMenu={(e) => {
          e.preventDefault();
          setOpen(true);
        }}
        title="Clic droit : détail du remplissage"
        className="flex items-center gap-2"
      >
        <span className="h-2.5 w-24 overflow-hidden rounded-full bg-muted">
          <span
            className="block h-full rounded-full transition-all"
            style={{ width: `${pct}%`, backgroundColor: barColor(pct) }}
          />
        </span>
        <span className="w-9 text-right text-xs tabular-nums text-muted-foreground">
          {pct}%
        </span>
      </button>

      {open && (
        <>
          {/* Voile pour fermer en cliquant à côté */}
          <div className="fixed inset-0 z-40" onClick={() => setOpen(false)} />
          <div className="absolute left-0 top-full z-50 mt-1 w-60 rounded-lg border bg-background p-3 text-left shadow-lg">
            <div className="mb-2 text-xs font-semibold">
              Remplissage {pct}%{" "}
              <span className="font-normal text-muted-foreground">
                ({filledCount}/{total})
              </span>
            </div>
            {missing.length === 0 ? (
              <p className="text-xs text-emerald-700">
                ✓ Toutes les infos sont renseignées.
              </p>
            ) : (
              <>
                <p className="mb-1 text-[11px] font-medium text-muted-foreground">
                  À compléter :
                </p>
                <ul className="flex flex-col gap-0.5">
                  {missing.map((i) => (
                    <li
                      key={i.label}
                      className="flex items-center gap-1.5 text-xs text-destructive"
                    >
                      <span aria-hidden>○</span> {i.label}
                    </li>
                  ))}
                </ul>
              </>
            )}

            {missing.length > 0 && filledCount > 0 && (
              <>
                <p className="mb-1 mt-2 text-[11px] font-medium text-muted-foreground">
                  Déjà rempli :
                </p>
                <ul className="flex flex-wrap gap-x-2 gap-y-0.5">
                  {items
                    .filter((i) => i.filled)
                    .map((i) => (
                      <li
                        key={i.label}
                        className="flex items-center gap-1 text-[11px] text-muted-foreground"
                      >
                        <span className="text-emerald-600" aria-hidden>
                          ✓
                        </span>{" "}
                        {i.label}
                      </li>
                    ))}
                </ul>
              </>
            )}
          </div>
        </>
      )}
    </div>
  );
}
