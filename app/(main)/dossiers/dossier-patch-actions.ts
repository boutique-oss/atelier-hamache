"use server";

import { eq } from "drizzle-orm";

import { db } from "@/db";
import { dossiers } from "@/db/schema";
import { revalidateDossierViews } from "@/lib/revalidate";
import { parsePlaces } from "@/lib/sous-types";
import { ecrireSousType, lireSousType } from "@/lib/sous-types-db";

// ─── Édition directe de la fiche dossier (clic sur un bloc) ────────────────

// Champs modifiables depuis la fiche (récap du haut, bloc Client, bloc
// Dossier). Les dates / rappels d'agenda restent sur la page « Modifier ».
export type DossierPatch = Partial<{
  nomDossier: string;
  clientNom: string;
  telephone: string;
  email: string;
  adresse: string;
  typeIntervention: string;
  lienDossierExterne: string;
  commentaires: string;
  sousType: string;
  placesAssises: string;
}>;

const CHAMPS_DIRECTS = [
  "nomDossier",
  "clientNom",
  "telephone",
  "email",
  "adresse",
  "typeIntervention",
  "lienDossierExterne",
  "commentaires",
] as const;

export async function patchDossier(id: number, patch: DossierPatch) {
  const set: Record<string, string> = {};
  for (const k of CHAMPS_DIRECTS) {
    const v = patch[k];
    if (v !== undefined) set[k] = String(v).trim();
  }
  if (set.nomDossier !== undefined && !set.nomDossier) {
    return { ok: false, error: "Le nom du dossier est obligatoire." };
  }
  if (set.typeIntervention !== undefined && !set.typeIntervention) {
    set.typeIntervention = "Autre";
  }
  if (Object.keys(set).length > 0) {
    await db
      .update(dossiers)
      .set({ ...set, updatedAt: new Date().toISOString() })
      .where(eq(dossiers.id, id));
  }
  // Sous-type + places : écrits ensemble (on garde la valeur non fournie).
  if (patch.sousType !== undefined || patch.placesAssises !== undefined) {
    const cur = await lireSousType(id);
    await ecrireSousType(
      id,
      patch.sousType !== undefined ? patch.sousType.trim() : cur.sousType ?? "",
      patch.placesAssises !== undefined
        ? parsePlaces(patch.placesAssises)
        : cur.placesAssises
    );
  }
  revalidateDossierViews(id);
  return { ok: true as const };
}
