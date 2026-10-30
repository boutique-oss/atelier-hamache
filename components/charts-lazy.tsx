"use client";

import dynamic from "next/dynamic";

// Graphiques recharts chargés à la demande. recharts pèse ~125 kB gzip : en
// import statique il doublait le JavaScript initial des pages Rapport heures
// et Commandes, et retardait l'usage des filtres. Ici la page s'affiche et
// devient utilisable d'abord, les graphiques arrivent juste après dans un
// emplacement de même hauteur (pas de saut de mise en page).
function Emplacement({ h = "h-64" }: { h?: string }) {
  return (
    <div className={`${h} px-4 py-3`} aria-hidden>
      <div className="h-full w-full animate-pulse rounded-md bg-muted/60 motion-reduce:animate-none" />
    </div>
  );
}

export const TypesChart = dynamic(
  () => import("@/components/types-chart").then((m) => m.TypesChart),
  { ssr: false, loading: () => <Emplacement h="h-80" /> }
);

export const FournisseursChart = dynamic(
  () => import("@/components/fournisseurs-chart").then((m) => m.FournisseursChart),
  { ssr: false, loading: () => <Emplacement h="h-80" /> }
);

export const ChargeGauge = dynamic(
  () => import("@/components/heures-dashboard").then((m) => m.ChargeGauge),
  { ssr: false, loading: () => <Emplacement h="h-64" /> }
);

export const OperateursDonut = dynamic(
  () => import("@/components/heures-dashboard").then((m) => m.OperateursDonut),
  { ssr: false, loading: () => <Emplacement h="h-64" /> }
);

export const MoisOperateursChart = dynamic(
  () => import("@/components/heures-dashboard").then((m) => m.MoisOperateursChart),
  { ssr: false, loading: () => <Emplacement h="h-72" /> }
);

export const SuiviDevisChart = dynamic(
  () => import("@/components/heures-dashboard").then((m) => m.SuiviDevisChart),
  { ssr: false, loading: () => <Emplacement h="h-72" /> }
);

export const PiecesChart = dynamic(
  () => import("@/components/heures-dashboard").then((m) => m.PiecesChart),
  { ssr: false, loading: () => <Emplacement h="h-72" /> }
);
