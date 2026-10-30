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

import type { HeuresDossier, HeuresOperateur } from "@/lib/documents-heures";

// Graphiques de la rubrique « Rapports d'heures » (page Documents). Prévu et
// réel se distinguent par la CLARTÉ d'une même teinte ardoise (prévu clair,
// réel foncé), pas seulement par la couleur : lisible en noir et blanc.
const REEL = "#2F3B47"; // ardoise nuit
const PREVU = "#B8C3CE"; // ardoise très claire

const h1 = (n: number) => Math.round(n * 10) / 10;
const fmtH = (v: unknown) => (typeof v === "number" && v > 0 ? `${h1(v).toString().replace(".", ",")} h` : "");
const tronque = (s: string, max = 22) => (s.length > max ? s.slice(0, max - 1) + "…" : s);
const tooltipBox = "rounded-md border bg-background px-3 py-2 text-xs shadow-md";

function Vide({ children }: { children: React.ReactNode }) {
  return <p className="px-4 py-8 text-center text-sm text-muted-foreground">{children}</p>;
}

export function HeuresOperateursChart({ data }: { data: HeuresOperateur[] }) {
  if (data.length === 0) return <Vide>Aucune heure pointée sur cette période.</Vide>;
  const height = Math.max(160, data.length * 40 + 40);
  return (
    <div className="px-2 py-3" style={{ height }}>
      <ResponsiveContainer width="100%" height="100%">
        <BarChart data={data} layout="vertical" margin={{ top: 4, right: 56, bottom: 4, left: 8 }}>
          <CartesianGrid horizontal={false} strokeDasharray="3 3" opacity={0.3} />
          <XAxis type="number" tickLine={false} axisLine={false} fontSize={11} unit=" h" />
          <YAxis type="category" dataKey="operateur" width={110} tickLine={false} axisLine={false} fontSize={12} />
          <Tooltip
            cursor={{ fill: "rgba(0,0,0,0.04)" }}
            content={({ active, payload }) => {
              if (!active || !payload?.length) return null;
              const d = payload[0].payload as HeuresOperateur;
              return (
                <div className={tooltipBox}>
                  <p className="font-medium">{d.operateur}</p>
                  <p>{fmtH(d.heures)}</p>
                </div>
              );
            }}
          />
          <Bar dataKey="heures" fill={REEL} radius={[0, 4, 4, 0]} isAnimationActive={false}>
            <LabelList dataKey="heures" position="right" fontSize={11} formatter={fmtH} />
          </Bar>
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}

export function PrevuReelChart({ data }: { data: HeuresDossier[] }) {
  if (data.length === 0) return <Vide>Aucun dossier travaillé sur cette période.</Vide>;
  const rows = data.slice(0, 15).map((d) => ({ ...d, label: tronque(d.nom) }));
  const height = Math.max(180, rows.length * 52 + 70);
  return (
    <div className="px-2 py-3" style={{ height }}>
      <ResponsiveContainer width="100%" height="100%">
        <BarChart
          data={rows}
          layout="vertical"
          margin={{ top: 4, right: 56, bottom: 4, left: 8 }}
          barCategoryGap="22%"
          barGap={2}
        >
          <CartesianGrid horizontal={false} strokeDasharray="3 3" opacity={0.3} />
          <XAxis type="number" tickLine={false} axisLine={false} fontSize={11} unit=" h" />
          <YAxis type="category" dataKey="label" width={160} tickLine={false} axisLine={false} fontSize={12} />
          <Tooltip
            cursor={{ fill: "rgba(0,0,0,0.04)" }}
            content={({ active, payload }) => {
              if (!active || !payload?.length) return null;
              const d = payload[0].payload as HeuresDossier;
              const ecart = d.cumul - d.prevu;
              return (
                <div className={tooltipBox}>
                  <p className="font-medium">{d.nom}</p>
                  {d.client && <p className="text-muted-foreground">{d.client}</p>}
                  <p className="mt-1">
                    Prévu {d.prevu > 0 ? fmtH(d.prevu) : "non renseigné"} · réel {fmtH(d.cumul)}
                  </p>
                  {d.prevu > 0 && (
                    <p className="font-semibold">
                      Écart {ecart > 0 ? "+" : ecart < 0 ? "−" : ""}
                      {fmtH(Math.abs(ecart)) || "0 h"}
                    </p>
                  )}
                </div>
              );
            }}
          />
          <Legend
            formatter={(v) => (v === "prevu" ? "Prévu" : "Réel (cumul)")}
            wrapperStyle={{ fontSize: 12 }}
          />
          <Bar dataKey="prevu" fill={PREVU} radius={[0, 4, 4, 0]} isAnimationActive={false}>
            <LabelList dataKey="prevu" position="right" fontSize={11} formatter={fmtH} />
          </Bar>
          <Bar dataKey="cumul" fill={REEL} radius={[0, 4, 4, 0]} isAnimationActive={false}>
            <LabelList dataKey="cumul" position="right" fontSize={11} formatter={fmtH} />
          </Bar>
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}
