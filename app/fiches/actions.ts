"use server";

import { eq } from "drizzle-orm";
import { revalidatePath } from "next/cache";

import { db } from "@/db";
import { fichesAtelier } from "@/db/schema";
import { contenuDe, synchroniserDossierDepuisFiches } from "@/lib/fiches-dossier";
import { revalidateDossierViews } from "@/lib/revalidate";
import { parseNum } from "@/lib/utils";

// Les fiches atelier portent l'affectation : après chaque changement, le
// dossier (heures, type, opérateur) est recalculé à partir d'elles.
async function apres(dossierId: number, ficheId?: number) {
  await synchroniserDossierDepuisFiches(dossierId);
  revalidateDossierViews(dossierId);
  if (ficheId) revalidatePath(`/fiche-impression/${ficheId}`);
}

// Ajoute une fiche atelier rattachée à un dossier.
export async function addFiche(dossierId: number, fd: FormData) {
  const str = (k: string) => ((fd.get(k) as string) || "").trim();
  const typeIntervention = str("typeIntervention") || "Autre";
  const notes = str("notesLibres");
  const clientNom = str("clientNom");

  // contenu_json : on amorce avec le client (cohérent avec les fiches existantes)
  const contenuJson = JSON.stringify(clientNom ? { client_nom: clientNom } : {});

  await db.insert(fichesAtelier).values({
    dossierId,
    typeIntervention,
    contenuJson,
    notesLibres: notes,
  });
  await apres(dossierId);
}

// Supprime une fiche atelier.
export async function deleteFiche(id: number, dossierId: number) {
  await db.delete(fichesAtelier).where(eq(fichesAtelier.id, id));
  await apres(dossierId);
}

// Sauvegarde complète d'une fiche (éditeur riche) : type + contenu_json + notes.
export async function saveFiche(
  id: number,
  dossierId: number,
  data: { type: string; contenu: Record<string, unknown>; notes: string }
) {
  await db
    .update(fichesAtelier)
    .set({
      typeIntervention: data.type || "Autre",
      contenuJson: JSON.stringify(data.contenu ?? {}),
      notesLibres: data.notes ?? "",
      updatedAt: new Date().toISOString(),
    })
    .where(eq(fichesAtelier.id, id));
  await apres(dossierId, id);
}

// Affectation d'une fiche : opérateur + heures prévues (saisie directe depuis
// la liste des fiches du dossier). Le reste du contenu est conservé.
export async function setFicheAffectation(
  ficheId: number,
  dossierId: number,
  operateurId: number | null,
  heures: string
) {
  const [f] = await db
    .select({ contenu: fichesAtelier.contenuJson })
    .from(fichesAtelier)
    .where(eq(fichesAtelier.id, ficheId));
  if (!f) return { ok: false as const };
  const h = parseNum(heures);
  const contenu = {
    ...contenuDe(f.contenu),
    operateur_id: operateurId ?? null,
    heures_estimees: h != null && h >= 0 ? String(h).replace(".", ",") : "",
  };
  await db
    .update(fichesAtelier)
    .set({ contenuJson: JSON.stringify(contenu), updatedAt: new Date().toISOString() })
    .where(eq(fichesAtelier.id, ficheId));
  await apres(dossierId, ficheId);
  return { ok: true as const };
}
