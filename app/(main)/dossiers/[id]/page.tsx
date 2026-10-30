import Link from "next/link";
import { notFound } from "next/navigation";

import { DossierFiche } from "@/components/dossier-fiche";

export const dynamic = "force-dynamic";

export default async function DossierDetail({
  params,
  searchParams,
}: {
  params: { id: string };
  searchParams: { back?: string };
}) {
  const id = Number(params.id);
  if (!Number.isFinite(id)) notFound();

  // Lien de retour contextuel : on revient là d'où on vient (liste des
  // dossiers avec ses filtres, ou tableau), transmis via ?back=…
  const backRaw = searchParams.back || "";
  // Sécurité : on n'accepte qu'un chemin interne (« / » mais pas « // », qui
  // désignerait un autre site).
  const back =
    backRaw.startsWith("/") && !backRaw.startsWith("//") && !backRaw.startsWith("/\\")
      ? backRaw
      : "/dossiers";

  return (
    <main className="container mx-auto max-w-4xl py-8">
      <Link href={back} className="text-sm text-muted-foreground hover:underline">
        ← Retour aux dossiers
      </Link>
      <DossierFiche id={id} />
    </main>
  );
}
