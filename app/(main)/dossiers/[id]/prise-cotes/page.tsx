import { eq } from "drizzle-orm";
import Link from "next/link";
import { notFound } from "next/navigation";

import { db } from "@/db";
import { dossiers } from "@/db/schema";
import { PriseCotesForm } from "@/components/prise-cotes-form";
import { lirePriseCotes } from "@/lib/prise-cotes-db";

export const dynamic = "force-dynamic";

// Prise de cotes rideaux, saisie sur tablette chez le client.
export default async function PriseCotesPage({ params }: { params: { id: string } }) {
  const id = Number(params.id);
  if (!Number.isFinite(id)) notFound();
  const [d] = await db
    .select({ id: dossiers.id, nom: dossiers.nomDossier, client: dossiers.clientNom })
    .from(dossiers)
    .where(eq(dossiers.id, id));
  if (!d) notFound();
  const prise = await lirePriseCotes(id);

  return (
    <main className="container mx-auto max-w-3xl py-6">
      <Link href={`/dossiers/${id}`} className="text-sm text-muted-foreground hover:underline">
        ← Retour au dossier
      </Link>
      <h1 className="mb-1 mt-3 text-2xl font-bold">Rideaux — prise de cotes</h1>
      <p className="mb-5 text-muted-foreground">
        {d.client || d.nom} · dossier n° {d.id}
      </p>
      <PriseCotesForm dossierId={id} pieces={prise.pieces} datePrise={prise.datePrise} />
    </main>
  );
}
