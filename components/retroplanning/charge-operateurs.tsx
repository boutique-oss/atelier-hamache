"use client";

// Charge atelier par opérateur : heures planifiées / capacité, sur la période
// affichée (jour, semaine ou mois) et cumulées depuis le 1er du mois.
// Recalculée en direct à chaque déplacement d'étape sur le Gantt.
import { useMemo } from "react";

import {
  syntheseCharge,
  type Calendrier,
  type Etape,
  type OperateurRetro,
  type Vue,
} from "@/lib/retroplanning";

const h = (n: number) => `${(Math.round(n * 10) / 10).toLocaleString("fr-FR")} h`;
const pct = (a: number, b: number) => (b > 0 ? Math.round((a / b) * 100) : a > 0 ? 999 : 0);

function Jauge({ heures, capacite }: { heures: number; capacite: number }) {
  const p = pct(heures, capacite);
  const trop = heures > capacite + 0.05;
  return (
    <div className="min-w-[84px]">
      <div className={"tabular-nums " + (trop ? "font-semibold text-[#FF0000]" : "")}>
        {h(heures)}
        <span className="text-muted-foreground"> / {h(capacite)}</span>
      </div>
      <div className="mt-1 h-1.5 w-full overflow-hidden rounded-full bg-muted">
        <div
          className="h-full rounded-full"
          style={{
            width: `${Math.min(100, p)}%`,
            background: trop ? "#FF0000" : "hsl(var(--brand-green))",
          }}
        />
      </div>
    </div>
  );
}

export function ChargeOperateurs({
  etapes,
  ops,
  cal,
  vue,
  refDate,
}: {
  etapes: Etape[];
  ops: OperateurRetro[];
  cal: Calendrier;
  vue: Vue;
  refDate: string;
}) {
  const lignes = useMemo(() => syntheseCharge(etapes, ops, cal, vue, refDate), [etapes, ops, cal, vue, refDate]);
  // Heures d'atelier sans opérateur affecté (pas comptées dans la charge).
  const sansOperateur = useMemo(
    () => etapes.filter((e) => e.operateurId == null && e.heures > 0 && !e.fait).reduce((s, e) => s + e.heures, 0),
    [etapes]
  );
  if (ops.length === 0) return null;
  // Vue jour : la colonne du jour ferait doublon avec « Jour ».
  const colonnes = vue === "jour" ? [] : lignes[0]?.colonnes ?? [];
  const nomMois = new Date(`${refDate.slice(0, 7)}-15T12:00:00Z`).toLocaleDateString("fr-FR", { month: "long" });

  return (
    <section className="overflow-x-auto rounded-md border bg-card">
      <table className="w-full text-sm">
        <thead>
          <tr className="border-b text-left text-xs text-muted-foreground">
            <th className="px-3 py-2 font-medium">Opérateur atelier</th>
            {colonnes.map((c) => (
              <th key={c.cle} className="px-3 py-2 font-medium">
                {vue === "mois" ? `Sem. ${c.label}` : c.label}
              </th>
            ))}
            {vue !== "mois" && <th className="px-3 py-2 font-medium">{vue === "jour" ? "Jour" : "Semaine"}</th>}
            {vue !== "mois" && <th className="px-3 py-2 font-medium">Cumul {nomMois} (au {lignes[0]?.colonnes.at(-1)?.label.split(" ").at(-1)})</th>}
            <th className="px-3 py-2 font-medium">Total {nomMois}</th>
            <th className="px-3 py-2 text-right font-medium">Charge</th>
          </tr>
        </thead>
        <tbody>
          {lignes.map((l) => {
            const p = pct(l.mois.heures, l.mois.capacite);
            return (
              <tr key={l.op.id} className="border-b last:border-0">
                <td className="px-3 py-2 font-medium">
                  {l.op.nom}
                  <div className="text-xs font-normal text-muted-foreground">{h(l.op.heuresSemaine)}/sem.</div>
                </td>
                {(vue === "jour" ? [] : l.colonnes).map((c) => (
                  <td key={c.cle} className="px-3 py-2 align-top">
                    <Jauge heures={c.heures} capacite={c.capacite} />
                  </td>
                ))}
                {vue !== "mois" && (
                  <td className="px-3 py-2 align-top">
                    <Jauge heures={l.periode.heures} capacite={l.periode.capacite} />
                  </td>
                )}
                {vue !== "mois" && (
                  <td className="px-3 py-2 align-top">
                    <Jauge heures={l.cumulMois.heures} capacite={l.cumulMois.capacite} />
                  </td>
                )}
                <td className="px-3 py-2 align-top">
                  <Jauge heures={l.mois.heures} capacite={l.mois.capacite} />
                </td>
                <td className={"px-3 py-2 text-right align-top text-base font-semibold tabular-nums " + (p > 100 ? "text-[#FF0000]" : "")}>
                  {p > 998 ? "—" : `${p} %`}
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
      {sansOperateur > 0 && (
        <p className="border-t px-3 py-2 text-xs text-muted-foreground">
          {h(sansOperateur)} d&apos;atelier restent sans opérateur affecté (non comptées ci-dessus) : double-cliquez
          l&apos;étape AT concernée pour l&apos;affecter.
        </p>
      )}
    </section>
  );
}
