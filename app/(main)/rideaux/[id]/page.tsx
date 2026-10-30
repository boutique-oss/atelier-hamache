import { notFound } from "next/navigation";

import { RideauxCalculateur } from "@/components/rideaux-calculateur";
import { getCalcul, getParamsAtelier, listDossiersCourts } from "@/lib/rideaux/db";
import { utilisateurCourant } from "@/lib/session";

export const dynamic = "force-dynamic";

export default async function CalculRideauxPage({ params: route }: { params: { id: string } }) {
  const id = Number(route.id);
  if (!Number.isInteger(id) || id <= 0) notFound();
  const [calcul, { params, valide }, dossiers, u] = await Promise.all([
    getCalcul(id),
    getParamsAtelier(),
    listDossiersCourts(),
    utilisateurCourant(),
  ]);
  if (!calcul) notFound();

  return (
    <RideauxCalculateur
      key={calcul.id}
      initial={{
        id: calcul.id,
        nom: calcul.nom,
        client: calcul.client,
        dossierId: calcul.dossierId,
        lignes: calcul.lignes,
        params: calcul.params,
        updatedAt: calcul.updatedAt,
      }}
      paramsAtelier={params}
      paramsValides={valide}
      dossiers={dossiers}
      peutEditerParams={!u || u.role === "admin"}
    />
  );
}
