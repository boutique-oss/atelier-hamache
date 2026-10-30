"use server";

import { pieceRemplie, type PieceCotes } from "@/lib/prise-cotes";
import { ecrirePriseCotes } from "@/lib/prise-cotes-db";
import { revalidateDossierViews } from "@/lib/revalidate";

// Enregistre la prise de cotes rideaux d'un dossier (saisie tablette).
export async function enregistrerPriseCotes(
  dossierId: number,
  pieces: PieceCotes[],
  datePrise: string
) {
  const gardees = pieces.filter(pieceRemplie).map((p) => {
    const propre = Object.fromEntries(
      Object.entries(p).map(([k, v]) => [k, String(v ?? "").trim()])
    ) as PieceCotes;
    return propre;
  });
  const date = /^\d{4}-\d{2}-\d{2}$/.test(datePrise) ? datePrise : null;
  await ecrirePriseCotes(dossierId, gardees, date);
  revalidateDossierViews(dossierId);
  return { ok: true as const, nb: gardees.length };
}
