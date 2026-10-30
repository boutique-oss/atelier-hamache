// Les FICHES ATELIER portent l'affectation (opérateur + heures prévues, dans
// contenu_json) ; le dossier n'en est que le total, recalculé ici après toute
// modification de fiche :
//   - heures à réaliser = somme des heures prévues des fiches ;
//   - type d'intervention = métier des fiches (plusieurs → « Mixte ») ;
//   - opérateur du dossier = celui qui a le plus d'heures (lu par le planning).
// Remplace l'ancienne affectation saisie sur le dossier et les lignes Travaux.
import { eq } from "drizzle-orm";

import { db } from "@/db";
import { dossiers, fichesAtelier } from "@/db/schema";
import { parseNum } from "@/lib/utils";

// Type de fiche → métier du dossier.
const METIER: Record<string, string> = {
  Rideaux: "Rideaux",
  Stores: "Rideaux",
  Tapisserie: "Tapisserie",
  "Tête de lit": "Tapisserie",
  "Habillage de lit": "Tapisserie",
  Coussins: "Tapisserie",
  Galettes: "Tapisserie",
  "Tenture murale": "Tapisserie",
  "Pose seule": "Atelier",
  Atelier: "Atelier",
};
export const metierDeFiche = (type: string | null | undefined) => METIER[type ?? ""] ?? "Autre";

export function contenuDe(raw: string | null | undefined): Record<string, unknown> {
  try {
    const o = JSON.parse(raw || "{}");
    return o && typeof o === "object" ? o : {};
  } catch {
    return {};
  }
}

export type AffectationFiche = { operateurId: number | null; heures: number };

export function affectationDe(contenu: Record<string, unknown>): AffectationFiche {
  const op = Number(contenu.operateur_id);
  return {
    operateurId: Number.isFinite(op) && op > 0 ? op : null,
    heures: parseNum(String(contenu.heures_estimees ?? "")) ?? 0,
  };
}

export async function synchroniserDossierDepuisFiches(dossierId: number) {
  const fiches = await db
    .select({ type: fichesAtelier.typeIntervention, contenu: fichesAtelier.contenuJson })
    .from(fichesAtelier)
    .where(eq(fichesAtelier.dossierId, dossierId));
  if (fiches.length === 0) return; // rien à recalculer : on garde l'existant

  let total = 0;
  const parOp = new Map<number, number>();
  const metiers = new Set<string>();
  for (const f of fiches) {
    const a = affectationDe(contenuDe(f.contenu));
    total += a.heures;
    if (a.operateurId) parOp.set(a.operateurId, (parOp.get(a.operateurId) ?? 0) + a.heures);
    const m = metierDeFiche(f.type);
    if (m !== "Autre") metiers.add(m);
  }
  const principal = [...parOp.entries()].sort((x, y) => y[1] - x[1])[0]?.[0] ?? null;

  await db
    .update(dossiers)
    .set({
      heuresARealiser: Math.round(total * 100) / 100,
      ...(metiers.size === 1 ? { typeIntervention: [...metiers][0] } : {}),
      ...(metiers.size > 1 ? { typeIntervention: "Mixte" } : {}),
      operateurId: principal,
      updatedAt: new Date().toISOString(),
    })
    .where(eq(dossiers.id, dossierId));
}
