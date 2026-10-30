"use client";

import {
  Bar,
  BarChart,
  CartesianGrid,
  LabelList,
  Legend,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";

import type { LigneOperateur, LigneReelPrevu } from "@/lib/rapport-heures";

// Graphiques du bilan de période (phase 6). Prévu / pointé en teinte CLAIRE,
// réel / saisi en teinte FONCÉE de la même famille : la différence se lit à
// la clarté, pas seulement à la couleur (impression N&B, daltonisme). Valeur
// affichée au bout de chaque barre.
const CLAIR = "#B9C4CF"; // ardoise claire
const FONCE = "#2F3B47"; // ardoise nuit
const DEPASSE = "#7A2E2E"; // brique foncée (réel au-delà du prévu)

const h1 = (v: number) => Math.round(v * 10) / 10;
const fmt = (v: unknown) => {
  const x = Number(v);
  return x > 0 ? `${String(h1(x)).replace(".", ",")} h` : "";
};
const tronque = (s: string, max = 22) => (s.length > max ? s.slice(0, max - 1) + "…" : s);
const tooltipBox = "rounded-md border bg-background px-3 py-2 text-xs shadow-md";

function Vide({ children }: { children: React.ReactNode }) {
  return <p className="px-4 py-8 text-center text-sm text-muted-foreground">{children}</p>;
}

export function ReelPrevuChart({ data }: { data: LigneReelPrevu[] }) {
  if (data.length === 0) return <Vide>Aucune heure saisie sur cette période.</Vide>;
  const rows = data.slice(0, 15).map((d) => ({
    ...d,
    label: tronque(d.nom),
    // Barre « réel » coupée en deux : la part dans le prévu, puis le dépassement.
    reelDans: d.prevu > 0 ? Math.min(d.reel, d.prevu) : d.reel,
    reelAu: d.prevu > 0 ? Math.max(0, d.reel - d.prevu) : 0,
  })).map((r) => ({
    ...r,
    // Valeur du réel affichée une seule fois, au bout du dernier segment visible.
    etiquetteDans: r.reelAu > 0 ? 0 : r.reel,
    etiquetteAu: r.reelAu > 0 ? r.reel : 0,
  }));
  const height = Math.max(200, rows.length * 52 + 70);
  return (
    <div className="px-2 py-3" style={{ height }}>
      <ResponsiveContainer width="100%" height="100%">
        <BarChart
          data={rows}
          layout="vertical"
          margin={{ top: 4, right: 60, bottom: 4, left: 8 }}
          barCategoryGap="20%"
          barGap={2}
        >
          <CartesianGrid horizontal={false} strokeDasharray="3 3" opacity={0.3} />
          <XAxis type="number" tickLine={false} axisLine={false} fontSize={11} unit=" h" />
          <YAxis type="category" dataKey="label" width={160} tickLine={false} axisLine={false} fontSize={12} />
          <Tooltip
            cursor={{ fill: "rgba(0,0,0,0.04)" }}
            content={({ active, payload }) => {
              if (!active || !payload?.length) return null;
              const d = payload[0].payload as LigneReelPrevu;
              const ecart = d.reel - d.prevu;
              return (
                <div className={tooltipBox}>
                  <p className="font-medium">{d.nom}</p>
                  {d.client && <p className="text-muted-foreground">{d.client}</p>}
                  <p className="mt-1">Prévu : {fmt(d.prevu) || "non renseigné"}</p>
                  <p>Réel cumulé : {fmt(d.reel)} · sur la période : {fmt(d.periode)}</p>
                  {d.prevu > 0 && (
                    <p className="font-semibold">
                      Écart : {ecart > 0 ? "+" : ""}
                      {String(h1(ecart)).replace(".", ",")} h
                    </p>
                  )}
                </div>
              );
            }}
          />
          <Legend
            formatter={(v) =>
              v === "prevu" ? "Prévu" : v === "reelDans" ? "Réel" : "Dépassement"
            }
            wrapperStyle={{ fontSize: 12 }}
          />
          <Bar dataKey="prevu" fill={CLAIR} radius={[0, 4, 4, 0]}>
            <LabelList dataKey="prevu" position="right" fontSize={11} formatter={fmt} />
          </Bar>
          <Bar dataKey="reelDans" stackId="reel" fill={FONCE}>
            <LabelList dataKey="etiquetteDans" position="right" fontSize={11} formatter={fmt} />
          </Bar>
          <Bar dataKey="reelAu" stackId="reel" fill={DEPASSE} radius={[0, 4, 4, 0]}>
            <LabelList dataKey="etiquetteAu" position="right" fontSize={11} formatter={fmt} />
          </Bar>
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}

export function PointeSaisiChart({ data }: { data: LigneOperateur[] }) {
  if (data.length === 0) return <Vide>Aucune heure pointée ni saisie sur cette période.</Vide>;
  const height = Math.max(180, data.length * 52 + 70);
  return (
    <div className="px-2 py-3" style={{ height }}>
      <ResponsiveContainer width="100%" height="100%">
        <BarChart
          data={data}
          layout="vertical"
          margin={{ top: 4, right: 60, bottom: 4, left: 8 }}
          barCategoryGap="20%"
          barGap={2}
        >
          <CartesianGrid horizontal={false} strokeDasharray="3 3" opacity={0.3} />
          <XAxis type="number" tickLine={false} axisLine={false} fontSize={11} unit=" h" />
          <YAxis type="category" dataKey="operateur" width={110} tickLine={false} axisLine={false} fontSize={12} />
          <Tooltip
            cursor={{ fill: "rgba(0,0,0,0.04)" }}
            content={({ active, payload }) => {
              if (!active || !payload?.length) return null;
              const d = payload[0].payload as LigneOperateur;
              return (
                <div className={tooltipBox}>
                  <p className="font-medium">{d.operateur}</p>
                  <p>Présence pointée : {fmt(d.pointees) || "0 h"}</p>
                  <p>Saisi sur dossiers : {fmt(d.saisies) || "0 h"}</p>
                  {d.pointees > 0 && (
                    <p className="text-muted-foreground">
                      {Math.round((d.saisies / d.pointees) * 100)} % du temps imputé aux dossiers
                    </p>
                  )}
                </div>
              );
            }}
          />
          <Legend
            formatter={(v) => (v === "pointees" ? "Présence pointée" : "Saisi sur dossiers")}
            wrapperStyle={{ fontSize: 12 }}
          />
          <Bar dataKey="pointees" fill={CLAIR} radius={[0, 4, 4, 0]}>
            <LabelList dataKey="pointees" position="right" fontSize={11} formatter={fmt} />
          </Bar>
          <Bar dataKey="saisies" fill={FONCE} radius={[0, 4, 4, 0]}>
            <LabelList dataKey="saisies" position="right" fontSize={11} formatter={fmt} />
          </Bar>
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}
