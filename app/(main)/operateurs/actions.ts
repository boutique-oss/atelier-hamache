"use server";

import { eq } from "drizzle-orm";

import { db } from "@/db";
import { operateurs } from "@/db/schema";
import { revalidateOperateurViews } from "@/lib/revalidate";

// Crée un opérateur (nom unique). Les doublons sont ignorés silencieusement.
export async function createOperateur(fd: FormData) {
  const nom = ((fd.get("nom") as string) || "").trim();
  if (!nom) return;
  try {
    await db.insert(operateurs).values({ nom });
  } catch {
    // violation d'unicité -> on ignore
  }
  revalidateOperateurViews();
}

// Renomme un opérateur + met à jour sa capacité hebdo.
export async function renameOperateur(id: number, fd: FormData) {
  const nom = ((fd.get("nom") as string) || "").trim();
  if (!nom) return;
  const h = fd.get("heuresSemaine") as string | null;
  const heuresSemaine = h ? Number(h) || 0 : 35;
  try {
    await db
      .update(operateurs)
      .set({ nom, heuresSemaine })
      .where(eq(operateurs.id, id));
  } catch {
    // doublon -> on ignore
  }
  revalidateOperateurViews();
}

// Active / désactive un opérateur.
export async function toggleOperateur(id: number, actif: boolean) {
  await db.update(operateurs).set({ actif }).where(eq(operateurs.id, id));
  revalidateOperateurViews();
}

// Marque / démarque le dirigeant : il est pointé pour information seulement
// (aucun horaire dû, pas de compteur de rattrapage, pas de quota de congés).
export async function toggleDirigeant(id: number, estDirigeant: boolean) {
  await db.update(operateurs).set({ estDirigeant }).where(eq(operateurs.id, id));
  revalidateOperateurViews();
}

// Supprime un opérateur.
export async function deleteOperateur(id: number) {
  await db.delete(operateurs).where(eq(operateurs.id, id));
  revalidateOperateurViews();
}
