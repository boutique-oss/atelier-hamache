"use client";

import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  LabelList,
  Legend,
  Pie,
  PieChart,
  PolarAngleAxis,
  RadialBar,
  RadialBarChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";

import { TONS, type Ton } from "@/components/small-box";

// Tableau de bord du rapport d'heures, inspiré d'AdminLTE (small-box, cartes
// « card-outline » repliables) et rendu avec recharts. Couleurs sémantiques
// AdminLTE (primary/info/success/warning/danger) ramenées à la palette COS.

// Une couleur par opérateur (série), dans un ordre stable.
const SERIES = [
  "#52667B", // ardoise
  "#A89B8A", // taupe
  "#4F6B4F", // sauge
  "#8A6A40", // ocre
  "#2F3B47", // ardoise nuit
  "#8A99A9", // ardoise claire
  "#7F7F7F", // gris
  "#B34C4C", // brique
];
export const serieColor = (i: number) => SERIES[i % SERIES.length];

const h1 = (n: number) => Math.round(n * 10) / 10;
const tronque = (s: string, max = 24) =>
  s.length > max ? s.slice(0, max - 1) + "…" : s;

const tooltipBox = "rounded-md border bg-background px-3 py-2 text-xs shadow-md";

export { DashCard } from "@/components/dash-card";

function Vide({ children }: { children: React.ReactNode }) {
  return (
    <p className="px-4 py-8 text-center text-sm text-muted-foreground">{children}</p>
  );
}

/* ──────────────────── Jauge : charge de l'atelier ──────────────────── */

export function ChargeGauge({
  charge,
  capacite,
  nAtelier,
}: {
  charge: number;
  capacite: number;
  nAtelier: number;
}) {
  const pct = capacite > 0 ? Math.round((charge / capacite) * 100) : 0;
  const surcharge = pct > 100;
  const color = surcharge ? TONS.danger : pct >= 80 ? TONS.warning : TONS.success;
  const data = [{ name: "charge", value: Math.min(100, pct), fill: color }];
  return (
    <div className="px-2 py-3">
      <div className="relative h-52">
        <ResponsiveContainer width="100%" height="100%">
          <RadialBarChart
            data={data}
            innerRadius="72%"
            outerRadius="100%"
            startAngle={210}
            endAngle={-30}
          >
            <PolarAngleAxis type="number" domain={[0, 100]} tick={false} />
            <RadialBar
              dataKey="value"
              cornerRadius={8}
              background={{ fill: "rgba(127,127,127,0.15)" }}
            />
          </RadialBarChart>
        </ResponsiveContainer>
        <div className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center">
          <span className="text-3xl font-bold tabular-nums" style={{ color }}>
            {pct}%
          </span>
          <span className="text-xs text-muted-foreground">
            {Math.round(charge)} h / {Math.round(capacite)} h
          </span>
        </div>
      </div>
      <p className="text-center text-xs text-muted-foreground">
        {nAtelier} dossier{nAtelier > 1 ? "s" : ""} « En atelier » · capacité
        mensuelle {capacite} h{surcharge ? " · ⚠ surcharge" : ""}
      </p>
    </div>
  );
}

/* ─────────────── Donut : répartition des heures par opérateur ─────────────── */

export type OpTotal = { operateur: string; total: number };

export function OperateursDonut({
  data,
  ordre,
}: {
  data: OpTotal[];
  /** Ordre des opérateurs pour garder la même couleur qu'ailleurs. */
  ordre: string[];
}) {
  const total = data.reduce((s, d) => s + d.total, 0);
  if (total === 0) return <Vide>Aucune heure saisie sur cette période.</Vide>;
  return (
    <div className="px-2 py-3">
      <div className="relative h-52">
        <ResponsiveContainer width="100%" height="100%">
          <PieChart>
            <Pie
              data={data}
              dataKey="total"
              nameKey="operateur"
              innerRadius="58%"
              outerRadius="90%"
              paddingAngle={2}
              stroke="none"
            >
              {data.map((d) => (
                <Cell key={d.operateur} fill={serieColor(ordre.indexOf(d.operateur))} />
              ))}
            </Pie>
            <Tooltip
              content={({ active, payload }) => {
                if (!active || !payload?.length) return null;
                const d = payload[0].payload as OpTotal;
                return (
                  <div className={tooltipBox}>
                    <p className="font-medium">{d.operateur}</p>
                    <p>
                      {h1(d.total)} h · {Math.round((d.total / total) * 100)} %
                    </p>
                  </div>
                );
              }}
            />
          </PieChart>
        </ResponsiveContainer>
        <div className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center">
          <span className="text-2xl font-bold tabular-nums">{h1(total)} h</span>
          <span className="text-xs text-muted-foreground">au total</span>
        </div>
      </div>
      <ul className="mt-2 grid grid-cols-2 gap-x-4 gap-y-1 px-2 text-xs">
        {data.map((d) => (
          <li key={d.operateur} className="flex items-center justify-between gap-2">
            <span className="flex min-w-0 items-center gap-1.5">
              <span
                className="h-2.5 w-2.5 shrink-0 rounded-sm"
                style={{ backgroundColor: serieColor(ordre.indexOf(d.operateur)) }}
              />
              <span className="truncate">{d.operateur}</span>
            </span>
            <span className="tabular-nums text-muted-foreground">{h1(d.total)} h</span>
          </li>
        ))}
      </ul>
    </div>
  );
}

/* ──────────── Barres empilées : heures par mois et par opérateur ──────────── */

export type MoisRow = { mois: string; label: string } & Record<string, number | string>;

export function MoisOperateursChart({
  data,
  ordre,
}: {
  data: MoisRow[];
  ordre: string[];
}) {
  if (data.length === 0) return <Vide>Aucune heure saisie sur cette période.</Vide>;
  return (
    <div className="h-80 px-2 py-3">
      <ResponsiveContainer width="100%" height="100%">
        <BarChart data={data} margin={{ top: 16, right: 12, bottom: 4, left: 0 }}>
          <CartesianGrid vertical={false} strokeDasharray="3 3" opacity={0.3} />
          <XAxis dataKey="label" tickLine={false} axisLine={false} fontSize={11} />
          <YAxis tickLine={false} axisLine={false} fontSize={11} unit=" h" width={52} />
          <Tooltip
            cursor={{ fill: "rgba(0,0,0,0.04)" }}
            content={({ active, payload, label }) => {
              if (!active || !payload?.length) return null;
              const items = payload.filter((p) => Number(p.value) > 0);
              const tot = items.reduce((s, p) => s + Number(p.value), 0);
              return (
                <div className={tooltipBox}>
                  <p className="mb-1 font-medium capitalize">{label}</p>
                  {items.map((p) => (
                    <p key={String(p.dataKey)} className="flex justify-between gap-4">
                      <span className="flex items-center gap-1.5">
                        <span
                          className="h-2 w-2 rounded-sm"
                          style={{ backgroundColor: p.color }}
                        />
                        {String(p.dataKey)}
                      </span>
                      <span className="tabular-nums">{h1(Number(p.value))} h</span>
                    </p>
                  ))}
                  <p className="mt-1 flex justify-between gap-4 border-t pt-1 font-semibold">
                    <span>Total</span>
                    <span className="tabular-nums">{h1(tot)} h</span>
                  </p>
                </div>
              );
            }}
          />
          <Legend wrapperStyle={{ fontSize: 12 }} itemSorter={null} />
          {ordre.map((op, i) => (
            <Bar
              key={op}
              dataKey={op}
              stackId="ops"
              fill={serieColor(i)}
              radius={i === ordre.length - 1 ? [4, 4, 0, 0] : 0}
              maxBarSize={56}
            />
          ))}
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}

/* ─────────── Suivi des devis : réalisé vs estimé (dossiers à risque) ─────────── */

export type SuiviRow = {
  id: number;
  nom: string;
  client: string | null;
  saisi: number;
  estime: number;
  pct: number;
  niveau: "depasse" | "risque";
};

export function SuiviDevisChart({ data }: { data: SuiviRow[] }) {
  if (data.length === 0)
    return <Vide>Aucun dossier n’approche ni ne dépasse son devis. 👍</Vide>;
  const rows = data.map((d) => ({ ...d, label: tronque(d.nom, 20) }));
  const height = Math.max(180, rows.length * 46 + 60);
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
          <YAxis
            type="category"
            dataKey="label"
            width={170}
            tickLine={false}
            axisLine={false}
            fontSize={12}
          />
          <Tooltip
            cursor={{ fill: "rgba(0,0,0,0.04)" }}
            content={({ active, payload }) => {
              if (!active || !payload?.length) return null;
              const d = payload[0].payload as SuiviRow;
              return (
                <div className={tooltipBox}>
                  <p className="font-medium">{d.nom}</p>
                  {d.client && <p className="text-muted-foreground">{d.client}</p>}
                  <p className="mt-1">
                    Réalisé {h1(d.saisi)} h / estimé {h1(d.estime)} h ·{" "}
                    <span
                      className="font-semibold"
                      style={{ color: d.niveau === "depasse" ? TONS.danger : TONS.warning }}
                    >
                      {d.pct} %
                    </span>
                  </p>
                  {d.niveau === "depasse" && (
                    <p style={{ color: TONS.danger }}>
                      Dépassement : +{h1(d.saisi - d.estime)} h
                    </p>
                  )}
                </div>
              );
            }}
          />
          <Legend
            formatter={(v) => (v === "estime" ? "Estimé (devis)" : "Réalisé")}
            wrapperStyle={{ fontSize: 12 }}
          />
          <Bar dataKey="estime" fill="#9AA5B1" radius={[0, 4, 4, 0]} />
          <Bar dataKey="saisi" fill={TONS.danger} radius={[0, 4, 4, 0]}>
            {rows.map((d) => (
              <Cell
                key={d.id}
                fill={d.niveau === "depasse" ? TONS.danger : TONS.warning}
              />
            ))}
            <LabelList
              dataKey="pct"
              position="right"
              fontSize={11}
              formatter={(v) => `${v} %`}
            />
          </Bar>
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}

/* ───────────────────── Temps moyen par pièce (h / pièce) ───────────────────── */

export type PieceRow = { type: string; total: number; nb: number; parPiece: number };

export function PiecesChart({ data }: { data: PieceRow[] }) {
  if (data.length === 0)
    return (
      <Vide>
        Aucune saisie avec un type de réalisation renseigné sur cette période.
        Renseigne le type (Fauteuil, Double rideaux…) via « + détails » à la saisie
        des heures pour voir ici le temps moyen par pièce.
      </Vide>
    );
  const rows = [...data]
    .sort((a, b) => b.parPiece - a.parPiece)
    .map((d) => ({ ...d, parPiece: h1(d.parPiece), label: tronque(d.type) }));
  const height = Math.max(180, rows.length * 38 + 40);
  return (
    <div className="px-2 py-3" style={{ height }}>
      <ResponsiveContainer width="100%" height="100%">
        <BarChart
          data={rows}
          layout="vertical"
          margin={{ top: 4, right: 56, bottom: 4, left: 8 }}
          barCategoryGap="22%"
        >
          <CartesianGrid horizontal={false} strokeDasharray="3 3" opacity={0.3} />
          <XAxis type="number" tickLine={false} axisLine={false} fontSize={11} unit=" h" />
          <YAxis
            type="category"
            dataKey="label"
            width={160}
            tickLine={false}
            axisLine={false}
            fontSize={12}
          />
          <Tooltip
            cursor={{ fill: "rgba(0,0,0,0.04)" }}
            content={({ active, payload }) => {
              if (!active || !payload?.length) return null;
              const d = payload[0].payload as PieceRow;
              return (
                <div className={tooltipBox}>
                  <p className="font-medium">{d.type}</p>
                  <p className="mt-1 font-semibold">{d.parPiece} h / pièce</p>
                  <p className="text-muted-foreground">
                    {d.nb} pièce{d.nb > 1 ? "s" : ""} · {h1(d.total)} h au total
                  </p>
                </div>
              );
            }}
          />
          <Bar dataKey="parPiece" fill={TONS.info} radius={[0, 4, 4, 0]}>
            <LabelList
              dataKey="parPiece"
              position="right"
              fontSize={11}
              formatter={(v) => `${v} h`}
            />
          </Bar>
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}
