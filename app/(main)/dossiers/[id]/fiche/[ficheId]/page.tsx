import { eq } from "drizzle-orm";
import Link from "next/link";
import { notFound } from "next/navigation";

import { db } from "@/db";
import { dossiers, fichesAtelier } from "@/db/schema";
import { FicheEditor } from "@/components/fiche-editor";

export const dynamic = "force-dynamic";

export default async function EditFichePage({
  params,
}: {
  params: { id: string; ficheId: string };
}) {
  const dossierId = Number(params.id);
  const ficheId = Number(params.ficheId);
  if (!Number.isFinite(dossierId) || !Number.isFinite(ficheId)) notFound();

  const [[d], [f]] = await Promise.all([
    db.select().from(dossiers).where(eq(dossiers.id, dossierId)),
    db.select().from(fichesAtelier).where(eq(fichesAtelier.id, ficheId)),
  ]);
  if (!d || !f) notFound();

  let contenu: Record<string, any> = {};
  try {
    contenu = JSON.parse(f.contenuJson || "{}");
  } catch {
    contenu = {};
  }

  return (
    <main className="container mx-auto max-w-3xl py-8">
      <Link href={`/dossiers/${dossierId}`} className="text-sm text-muted-foreground hover:underline">
        ← Retour au dossier
      </Link>
      <h1 className="mb-1 mt-3 text-2xl font-bold">Fiche atelier — {d.nomDossier}</h1>
      <p className="mb-6 text-sm text-muted-foreground">Édition de la fiche #{ficheId}</p>

      <FicheEditor
        ficheId={ficheId}
        dossierId={dossierId}
        initialType={f.typeIntervention || "Autre"}
        initialContenu={contenu}
        initialNotes={f.notesLibres || ""}
      />
    </main>
  );
}
