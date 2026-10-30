"use client";

import {
  Bar,
  BarChart,
  CartesianGrid,
  Legend,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";

export type FournisseurRow = {
  /** Nom du fournisseur. */
  label: string;
  /** Lignes pas encore commandées : à passer chez ce fournisseur. */
  aCommander: number;
  /** Lignes commandées, en attente de livraison. */
  aRecevoir: number;
  /** Parmi « à recevoir », celles dont le jour de livraison est dépassé. */
  enRetard: number;
  /** Lignes commandées et reçues. */
  recu: number;
  /** Montant cumulé de toutes les lignes (€). */
  total: number;
};

// Palette COS : l'action à faire (ocre) ressort, l'attente (ardoise) se lit,
// l'historique (taupe clair) reste en retrait.
const COULEURS = {
  aCommander: "#8A6A40", // ocre — à passer
  aRecevoir: "#52667B", // ardoise — en attente
  recu: "#CCC1B2", // taupe clair — fait
};
const RETARD = "#B34C4C"; // brique — cf. --destructive

const LIBELLES: Record<string, string> = {
  aCommander: "À commander",
  aRecevoir: "À recevoir",
  recu: "Reçu",
};

const euro = (n: number) =>
  n ? `${n.toLocaleString("fr-FR", { maximumFractionDigits: 0 })} €` : "—";

const tronque = (s: string, max = 26) =>
  s.length > max ? s.slice(0, max - 1) + "…" : s;

/**
 * Barres horizontales empilées par fournisseur : à commander / à recevoir /
 * reçu. Les fournisseurs qui demandent une action (commande à passer, livraison
 * à relancer) sont en tête ; les retards de livraison sont signalés en rouge
 * à droite de la barre.
 */
export function FournisseursChart({ data }: { data: FournisseurRow[] }) {
  if (data.length === 0) {
    return (
      <p className="px-4 py-8 text-center text-sm text-muted-foreground">
        Aucune commande à analyser pour l&apos;instant.
      </p>
    );
  }
  const height = Math.max(220, data.length * 34 + 80);

  return (
    <div className="px-2 py-3" style={{ height }}>
      <ResponsiveContainer width="100%" height="100%">
        <BarChart
          data={data}
          layout="vertical"
          margin={{ top: 4, right: 96, bottom: 4, left: 8 }}
          barCategoryGap="24%"
        >
          <CartesianGrid horizontal={false} strokeDasharray="3 3" opacity={0.3} />
          <XAxis
            type="number"
            allowDecimals={false}
            tickLine={false}
            axisLine={false}
            fontSize={11}
          />
          <YAxis
            type="category"
            dataKey="label"
            width={180}
            tickLine={false}
            axisLine={false}
            fontSize={12}
            tickFormatter={(v: string) => tronque(v)}
          />
          <Legend
            verticalAlign="top"
            height={28}
            iconType="square"
            iconSize={10}
            formatter={(v: string) => (
              <span className="text-xs text-foreground">{LIBELLES[v] ?? v}</span>
            )}
          />
          <Tooltip
            cursor={{ fill: "rgba(0,0,0,0.04)" }}
            content={({ active, payload }) => {
              if (!active || !payload || payload.length === 0) return null;
              const d = payload[0].payload as FournisseurRow;
              return (
                <div className="rounded-md border bg-background px-3 py-2 text-xs shadow-md">
                  <p className="font-medium">{d.label}</p>
                  <p className="mt-1">
                    À commander : <span className="font-semibold">{d.aCommander}</span>
                  </p>
                  <p>
                    À recevoir : <span className="font-semibold">{d.aRecevoir}</span>
                    {d.enRetard > 0 && (
                      <span style={{ color: RETARD }}> · dont {d.enRetard} en retard</span>
                    )}
                  </p>
                  <p>
                    Reçu : <span className="font-semibold">{d.recu}</span>
                  </p>
                  <p className="mt-1 text-muted-foreground">Montant cumulé : {euro(d.total)}</p>
                </div>
              );
            }}
          />
          <Bar dataKey="aCommander" stackId="s" fill={COULEURS.aCommander} />
          <Bar dataKey="aRecevoir" stackId="s" fill={COULEURS.aRecevoir} />
          <Bar
            dataKey="recu"
            stackId="s"
            fill={COULEURS.recu}
            radius={[0, 3, 3, 0]}
            label={(props: {
              x?: number | string;
              y?: number | string;
              width?: number | string;
              height?: number | string;
              index?: number;
            }) => {
              const d = data[props.index ?? 0];
              const enCours = d ? d.aCommander + d.aRecevoir : 0;
              if (!d || enCours === 0) return <g />;
              const x = Number(props.x) + Number(props.width) + 6;
              const y = Number(props.y) + Number(props.height) / 2;
              return (
                <text x={x} y={y} dy={4} fontSize={11} fill="#333333">
                  {enCours} en cours
                  {d.enRetard > 0 && (
                    <tspan fill={RETARD} fontWeight={600}>
                      {" "}· {d.enRetard} retard
                    </tspan>
                  )}
                </text>
              );
            }}
          />
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}
