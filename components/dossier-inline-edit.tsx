"use client";

import { useState, useTransition } from "react";

import { setFlagsDossier, setStatutDossier } from "@/app/(main)/dossiers/actions";
import { FLAGS_PREDEF, flagChipCls, statutClasses } from "@/lib/dossiers";
import { isPieceFlag } from "@/lib/piece-classifier";

// Sélecteur de statut auto-enregistré (pilule colorée). Utilisé dans la ligne
// de tableau (desktop) et dans la carte dossier (mobile).
export function StatutSelect({
  id,
  statut,
  statutOptions,
}: {
  id: number;
  statut: string;
  statutOptions: string[];
}) {
  const [curStatut, setCurStatut] = useState(statut);
  const [pending, startTransition] = useTransition();

  // Statut connu mais absent de la liste (ex. valeur héritée) → on l'ajoute.
  const options = statutOptions.includes(curStatut)
    ? statutOptions
    : [curStatut, ...statutOptions];

  function changeStatut(next: string) {
    setCurStatut(next);
    startTransition(() => setStatutDossier(id, next));
  }

  return (
    <select
      value={curStatut}
      onChange={(e) => changeStatut(e.target.value)}
      disabled={pending}
      className={`cursor-pointer appearance-none rounded-full border-0 px-2.5 py-0.5 text-xs font-medium focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring ${statutClasses(
        curStatut
      )}`}
    >
      {options.map((s) => (
        <option key={s} value={s} className="bg-background text-foreground">
          {s}
        </option>
      ))}
    </select>
  );
}

// Éditeur d'étiquettes (chips + menu de sélection), auto-enregistré. Réutilisé
// dans la ligne de tableau et dans la carte mobile.
export function FlagsEditor({
  id,
  flags,
}: {
  id: number;
  flags: string[];
}) {
  const [curFlags, setCurFlags] = useState<string[]>(flags);
  const [openFlags, setOpenFlags] = useState(false);
  const [, startTransition] = useTransition();

  function toggleFlag(f: string) {
    const next = curFlags.includes(f)
      ? curFlags.filter((x) => x !== f)
      : [...curFlags, f];
    setCurFlags(next);
    startTransition(() => setFlagsDossier(id, next));
  }

  // Union des étiquettes prédéfinies + celles déjà posées (libres comprises).
  // Les flags techniques « piece: » (classification) sont exclus de l'affichage.
  const allFlags = [
    ...new Set([...FLAGS_PREDEF, ...curFlags.filter((f) => !isPieceFlag(f))]),
  ];
  const visibleFlags = curFlags.filter((f) => !isPieceFlag(f));

  return (
    <div className="relative">
      <button
        type="button"
        onClick={() => setOpenFlags((o) => !o)}
        className="flex min-h-[1.5rem] flex-wrap items-center gap-1 rounded-md text-left hover:opacity-80"
      >
        {visibleFlags.length === 0 ? (
          <span className="text-muted-foreground">+ flags</span>
        ) : (
          visibleFlags.map((f) => (
            <span
              key={f}
              className={`rounded-md px-1.5 py-0.5 text-[11px] font-medium ${flagChipCls(
                f
              )}`}
            >
              {f}
            </span>
          ))
        )}
      </button>

      {openFlags && (
        <>
          {/* Voile pour fermer en cliquant à côté */}
          <div
            className="fixed inset-0 z-10"
            onClick={() => setOpenFlags(false)}
          />
          <div className="absolute left-0 top-full z-20 mt-1 w-48 rounded-md border bg-background p-2 shadow-md">
            <div className="flex flex-col gap-1">
              {allFlags.map((f) => {
                const on = curFlags.includes(f);
                return (
                  <label
                    key={f}
                    className="flex cursor-pointer items-center gap-2 rounded px-1 py-0.5 text-xs hover:bg-muted"
                  >
                    <input
                      type="checkbox"
                      checked={on}
                      onChange={() => toggleFlag(f)}
                      className="h-3.5 w-3.5"
                    />
                    {f}
                  </label>
                );
              })}
            </div>
          </div>
        </>
      )}
    </div>
  );
}

// Édition rapide en ligne d'une ligne de la liste des dossiers :
// rend les cellules « Statut » et « Flags » (deux <td>), auto-enregistrées.
export function DossierInlineEdit({
  id,
  statut,
  flags,
  statutOptions,
}: {
  id: number;
  statut: string;
  flags: string[];
  statutOptions: string[];
}) {
  return (
    <>
      <td className="px-3 py-3">
        <StatutSelect id={id} statut={statut} statutOptions={statutOptions} />
      </td>
      <td className="px-3 py-3">
        <FlagsEditor id={id} flags={flags} />
      </td>
    </>
  );
}
