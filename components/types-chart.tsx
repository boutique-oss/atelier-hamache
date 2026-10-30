"use client";

import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  LabelList,
  Legend,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";

export type TypeChartRow = {
  /** Libellé du type de travail. */
  type: string;
  /** Heures saisies (toutes périodes / selon filtres). */
  total: number;
  /** Part de ces heures réalisée sur des dossiers en dépassement de devis. */
  depasse: number;
};

const PRIMARY = "#52667B"; // ardoise COS — cf. --primary
const RED = "#B34C4C"; // dépassement — brique COS, cf. --destructive

/**
 * Graphique à barres horizontales : heures par type de travail.
 * La portion « sur dossiers en dépassement » est superposée en rouge pour
 * montrer où le temps déborde (« sur quoi ça pèche »).
 */
export function TypesChart({ data }: { data: TypeChartRow[] }) {
  if (data.length === 0) {
    return (
      <p className="px-4 py-4 text-sm text-muted-foreground">
        Aucune heure sur ce périmètre.
      </p>
    );
  }
  // Hauteur adaptative : ~44 px par type, marge pour axes/légende.
  const height = Math.max(160, data.length * 44 + 60);

  return (
    <div className="px-2 py-3" style={{ height }}>
      <ResponsiveContainer width="100%" height="100%">
        <BarChart
          data={data}
          layout="vertical"
          margin={{ top: 4, right: 48, bottom: 4, left: 8 }}
          barCategoryGap="25%"
        >
          <CartesianGrid horizontal={false} strokeDasharray="3 3" opacity={0.3} />
          <XAxis
            type="number"
            tickLine={false}
            axisLine={false}
            fontSize={11}
            unit=" h"
          />
          <YAxis
            type="category"
            dataKey="type"
            width={130}
            tickLine={false}
            axisLine={false}
            fontSize={12}
          />
          <Tooltip
            formatter={(value, name) => [
              `${value} h`,
              name === "depasse" ? "dont dépassement" : "Total",
            ]}
            cursor={{ fill: "rgba(0,0,0,0.04)" }}
          />
          <Legend
            formatter={(v) =>
              v === "depasse" ? "dont sur dossiers dépassés" : "Total heures"
            }
            wrapperStyle={{ fontSize: 12 }}
          />
          <Bar dataKey="total" fill={PRIMARY} radius={[0, 4, 4, 0]}>
            <LabelList
              dataKey="total"
              position="right"
              fontSize={11}
              formatter={(v) => `${v} h`}
            />
          </Bar>
          <Bar dataKey="depasse" fill={RED} radius={[0, 4, 4, 0]}>
            {data.map((d) => (
              <Cell key={d.type} fillOpacity={d.depasse > 0 ? 1 : 0} />
            ))}
          </Bar>
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}
