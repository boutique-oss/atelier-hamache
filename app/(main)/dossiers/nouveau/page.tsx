import { asc, eq } from "drizzle-orm";
import Link from "next/link";

import { createDossier } from "@/app/(main)/dossiers/actions";
import { DossierForm } from "@/components/dossier-form";
import { db } from "@/db";
import { operateurs } from "@/db/schema";
import { SOUS_TYPES_BASE } from "@/lib/sous-types";
import { listerSousTypes } from "@/lib/sous-types-db";

export const dynamic = "force-dynamic";

export default async function NouveauDossier() {
  const [ops, sousTypes] = await Promise.all([
    db
      .select({ id: operateurs.id, nom: operateurs.nom })
      .from(operateurs)
      .where(eq(operateurs.actif, true))
      .orderBy(asc(operateurs.nom)),
    listerSousTypes().catch(() => SOUS_TYPES_BASE),
  ]);

  return (
    <main className="container mx-auto max-w-3xl py-8">
      <Link
        href="/dossiers"
        className="text-sm text-muted-foreground hover:underline"
      >
        ← Retour aux dossiers
      </Link>
      <h1 className="mb-6 mt-3 text-2xl font-bold">Nouveau dossier</h1>
      <DossierForm action={createDossier} operateurs={ops} sousTypes={sousTypes} />
    </main>
  );
}
