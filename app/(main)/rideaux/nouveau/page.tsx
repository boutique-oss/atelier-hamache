import { RideauxCalculateur } from "@/components/rideaux-calculateur";
import { getParamsAtelier, listDossiersCourts } from "@/lib/rideaux/db";
import { utilisateurCourant } from "@/lib/session";

export const dynamic = "force-dynamic";

export default async function NouveauCalculRideauxPage({
  searchParams,
}: {
  searchParams: { dossier?: string };
}) {
  const [{ params, valide }, dossiers, u] = await Promise.all([
    getParamsAtelier(),
    listDossiersCourts(),
    utilisateurCourant(),
  ]);
  const dossierId = Number(searchParams.dossier) || null;
  const dossier = dossiers.find((d) => d.id === dossierId);

  return (
    <RideauxCalculateur
      key="nouveau"
      initial={{
        id: null,
        nom: dossier?.nom ?? "",
        client: dossier?.client ?? "",
        dossierId: dossier?.id ?? null,
        lignes: null,
        params: null,
        updatedAt: null,
      }}
      paramsAtelier={params}
      paramsValides={valide}
      dossiers={dossiers}
      peutEditerParams={!u || u.role === "admin"}
    />
  );
}
