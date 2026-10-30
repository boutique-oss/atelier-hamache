"use client";

import { useState, useTransition } from "react";

import {
  effacerPointage,
  remplirSemaine,
  setPointage,
  viderSemaine,
} from "@/app/pointage/actions";
import type { Cellule, Jour, LignePointage } from "@/lib/pointage";

// Teinte de chaque type de journée. « Travail » n'a pas de jeton : c'est une saisie.
const TYPES: Record<string, string> = {
  Congé: "bg-amber-100 text-amber-800",
  Maladie: "bg-rose-100 text-rose-700",
  Férié: "bg-sky-100 text-sky-800",
  Récup: "bg-emerald-100 text-emerald-700",
  Repos: "bg-zinc-100 text-zinc-600",
};
// Le dirigeant n'a pas d'horaire dû : seules les absences ont du sens.
const TYPES_DIRIGEANT = ["Congé", "Repos"];

const nf = (n: number) =>
  n.toLocaleString("fr-FR", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
const nfs = (n: number) => (n > 0.0001 ? "+" : n < -0.0001 ? "−" : "") + nf(Math.abs(n));

export function PointageGrille({
  jours,
  lignes,
}: {
  jours: Jour[];
  lignes: LignePointage[];
}) {
  const [menu, setMenu] = useState<
    { x: number; y: number; nom: string; date?: string; dirigeant: boolean } | null
  >(null);
  const [pending, start] = useTransition();

  const fermer = () => setMenu(null);

  return (
    <>
      <div className="overflow-x-auto">
        <table className="w-full text-sm tabular-nums">
          <thead>
            <tr className="border-b text-[11px] uppercase tracking-wider text-muted-foreground">
              <th className="px-3 py-2 text-left font-medium">
                {lignes[0]?.dirigeant ? "Dirigeant" : "Salarié"}
              </th>
              {jours.map((j) => (
                <th key={j.date} className="px-2 py-2 text-center font-medium">
                  {j.label}
                  <span className="block text-sm text-foreground">{j.num}</span>
                </th>
              ))}
              <th className="px-3 py-2 text-center font-medium">Total</th>
              {!lignes[0]?.dirigeant && (
                <th className="px-3 py-2 text-center font-medium">Écart</th>
              )}
            </tr>
          </thead>
          <tbody>
            {lignes.map((l) => {
              const total = l.cellules.reduce((s, c) => s + (c ? c.heures : 0), 0);
              const ecart = total - l.contrat;
              return (
                <tr key={l.nom} className="border-b last:border-0">
                  <th
                    scope="row"
                    onContextMenu={(e) => {
                      e.preventDefault();
                      setMenu({ x: e.clientX, y: e.clientY, nom: l.nom, dirigeant: l.dirigeant });
                    }}
                    className="cursor-context-menu px-3 py-2 text-left font-semibold"
                  >
                    {l.nom}
                    <span className="block text-[11px] font-normal text-muted-foreground">
                      {l.dirigeant ? "sans contrat horaire" : `${nf(l.contrat)} h / semaine`}
                    </span>
                  </th>

                  {jours.map((j, i) => {
                    const c = l.cellules[i];
                    return (
                      <td
                        key={j.date}
                        onContextMenu={(e) => {
                          e.preventDefault();
                          setMenu({
                            x: e.clientX, y: e.clientY,
                            nom: l.nom, date: j.date, dirigeant: l.dirigeant,
                          });
                        }}
                        className="cursor-context-menu px-2 py-2 text-center"
                      >
                        {c && c.type !== "Travail" ? (
                          <span
                            className={`inline-block rounded-full px-2 py-1 text-[11px] font-semibold ${
                              TYPES[c.type] ?? "bg-zinc-100 text-zinc-600"
                            }`}
                            title={c.heures ? `${nf(c.heures)} h` : "0 h"}
                          >
                            {c.type}
                          </span>
                        ) : (
                          <input
                            type="number"
                            step="0.25"
                            min="0"
                            max="16"
                            defaultValue={c ? c.heures : ""}
                            disabled={pending}
                            aria-label={`${l.nom} ${j.label} ${j.num}`}
                            onBlur={(e) => {
                              const v = e.target.value;
                              start(async () => {
                                if (v === "") await effacerPointage(l.nom, j.date);
                                else await setPointage(l.nom, j.date, "Travail", Number(v));
                              });
                            }}
                            className="w-16 rounded-md border border-input bg-background px-2 py-1.5 text-center text-sm focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring disabled:opacity-50"
                          />
                        )}
                      </td>
                    );
                  })}

                  {/* Bloc de fin : gros, c'est le chiffre qu'on lit */}
                  <td className="px-3 py-2 text-center">
                    <span className="inline-block min-w-[76px] rounded-lg border bg-muted/50 px-3 py-2 text-base font-bold">
                      {nf(total)}
                    </span>
                  </td>
                  {!l.dirigeant && (
                    <td className="px-3 py-2 text-center">
                      <span
                        className={`inline-block min-w-[76px] rounded-lg px-3 py-2 text-base font-bold ${
                          ecart > 0.0001
                            ? "bg-emerald-100 text-emerald-700"
                            : ecart < -0.0001
                            ? "bg-rose-100 text-rose-700"
                            : "bg-muted text-muted-foreground"
                        }`}
                      >
                        {nfs(ecart)}
                      </span>
                    </td>
                  )}
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      {menu && (
        <>
          <div className="fixed inset-0 z-40" onMouseDown={fermer} onContextMenu={(e) => { e.preventDefault(); fermer(); }} />
          <div
            role="menu"
            style={{ left: Math.min(menu.x, (typeof window !== "undefined" ? window.innerWidth : 900) - 230), top: menu.y }}
            className="fixed z-50 w-52 rounded-lg border bg-background p-1.5 shadow-lg"
          >
            <div className="border-b px-2 pb-1.5 text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
              {menu.nom}
            </div>

            {menu.date ? (
              <>
                {(menu.dirigeant ? TYPES_DIRIGEANT : Object.keys(TYPES)).map((t) => (
                  <button
                    key={t}
                    type="button"
                    onClick={() => {
                      fermer();
                      start(() => { void setPointage(menu.nom, menu.date!, t); });
                    }}
                    className="mt-0.5 flex w-full items-center gap-2 rounded-md px-2 py-1.5 text-left text-sm hover:bg-accent"
                  >
                    <span className={`h-2.5 w-2.5 rounded-sm ${TYPES[t].split(" ")[0]}`} />
                    {t}
                  </button>
                ))}
                <div className="my-1 border-t" />
                <button
                  type="button"
                  onClick={() => {
                    fermer();
                    start(() => { void effacerPointage(menu.nom, menu.date!); });
                  }}
                  className="flex w-full rounded-md px-2 py-1.5 text-left text-sm text-destructive hover:bg-accent"
                >
                  Effacer la journée
                </button>
              </>
            ) : (
              <>
                {!menu.dirigeant && (
                  <button
                    type="button"
                    onClick={() => {
                      fermer();
                      start(() => { void remplirSemaine(menu.nom, jours.map((j) => j.date)); });
                    }}
                    className="mt-0.5 flex w-full rounded-md px-2 py-1.5 text-left text-sm hover:bg-accent"
                  >
                    Remplir au contrat
                  </button>
                )}
                <button
                  type="button"
                  onClick={() => {
                    fermer();
                    start(() => { void viderSemaine(menu.nom, jours.map((j) => j.date)); });
                  }}
                  className="mt-0.5 flex w-full rounded-md px-2 py-1.5 text-left text-sm text-destructive hover:bg-accent"
                >
                  Vider la semaine
                </button>
              </>
            )}
          </div>
        </>
      )}
    </>
  );
}
