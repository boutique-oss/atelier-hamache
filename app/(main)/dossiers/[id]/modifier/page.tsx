import { asc, eq } from "drizzle-orm";
import Link from "next/link";
import { notFound } from "next/navigation";

import { updateDossier } from "@/app/(main)/dossiers/actions";
import { db } from "@/db";
import { dossiers, operateurs } from "@/db/schema";
import { DossierForm } from "@/components/dossier-form";
import { SOUS_TYPES_BASE } from "@/lib/sous-types";
import { listerSousTypes, lireSousType } from "@/lib/sous-types-db";

export const dynamic = "force-dynamic";

export default async function ModifierDossier({
  params,
}: {
  params: { id: string };
}) {
  const id = Number(params.id);
  if (!Number.isFinite(id)) notFound();

  const [[d], ops, sousTypes, st] = await Promise.all([
    db.select().from(dossiers).where(eq(dossiers.id, id)),
    db
      .select({ id: operateurs.id, nom: operateurs.nom })
      .from(operateurs)
      .where(eq(operateurs.actif, true))
      .orderBy(asc(operateurs.nom)),
    listerSousTypes().catch(() => SOUS_TYPES_BASE),
    lireSousType(id).catch(() => ({ sousType: null, placesAssises: null })),
  ]);
  if (!d) notFound();

  // Lie l'id à l'action serveur.
  const action = updateDossier.bind(null, id);

  return (
    <main className="container mx-auto max-w-3xl py-8">
      <Link
        href={`/dossiers/${id}`}
        className="text-sm text-muted-foreground hover:underline"
      >
        ← Retour au dossier
      </Link>
      <h1 className="mb-6 mt-3 text-2xl font-bold">Modifier — {d.nomDossier}</h1>
      <DossierForm
        action={action}
        dossier={{ ...d, ...st }}
        operateurs={ops}
        sousTypes={sousTypes}
      />
    </main>
  );
}
