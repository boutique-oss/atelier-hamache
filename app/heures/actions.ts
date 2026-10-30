"use server";

import { eq } from "drizzle-orm";
import { revalidatePath } from "next/cache";

import { db } from "@/db";
import { heures } from "@/db/schema";
import { parseNum } from "@/lib/utils";

// Ajoute une saisie d'heures à un dossier.
// Renvoie { saved } pour que le formulaire ne se vide que si une ligne a bien
// été enregistrée (sinon la saisie est conservée et un message peut s'afficher).
export async function addHeure(dossierId: number, fd: FormData) {
  const operateur = ((fd.get("operateur") as string) || "").trim();
  // Date optionnelle : par défaut aujourd'hui (saisie rapide « juste heure + opérateur »).
  const date =
    ((fd.get("date") as string) || "").trim() ||
    new Date().toISOString().slice(0, 10);
  const h = parseNum(fd.get("heures"));
  // typeTravail = phase transverse ; typeRealisation = type de pièce (lien fiche).
  const typeTravail = ((fd.get("typeTravail") as string) || "Atelier").trim();
  const typeRealisation = ((fd.get("typeRealisation") as string) || "").trim();
  const nombre = parseNum(fd.get("nombre"));
  const description = ((fd.get("description") as string) || "").trim();

  // Garde-fou : opérateur + heures suffisent (date auto).
  if (!operateur || !h || h <= 0) return { saved: 0 };

  await db.insert(heures).values({
    dossierId,
    operateur,
    date,
    heuresPassees: h,
    typeTravail: typeTravail || "Atelier",
    typeRealisation: typeRealisation || null,
    nombre: nombre && nombre > 0 ? nombre : 1,
    description,
  });
  revalidatePath(`/dossiers/${dossierId}`);
  // Le Rapport des heures liste aussi les dossiers Clos à compléter : on rafraîchit.
  revalidatePath("/rapports");
  return { saved: 1 };
}

// Enregistre PLUSIEURS lignes d'heures en une fois (saisie multi-opérateurs,
// bouton « Enregistrer le tout »). Les champs sont postés en tableaux alignés
// par index (une valeur par ligne du formulaire).
export async function addHeuresBatch(dossierId: number, fd: FormData) {
  const date =
    ((fd.get("date") as string) || "").trim() ||
    new Date().toISOString().slice(0, 10);

  const operateurs = fd.getAll("operateur");
  const typesR = fd.getAll("typeRealisation");
  const nombres = fd.getAll("nombre");
  const heuresArr = fd.getAll("heures");
  const phases = fd.getAll("typeTravail");
  const descs = fd.getAll("description");

  const rows = [];
  for (let i = 0; i < operateurs.length; i++) {
    const operateur = String(operateurs[i] || "").trim();
    const h = parseNum(heuresArr[i]);
    // Une ligne n'est enregistrée que si opérateur + heures valides.
    if (!operateur || !h || h <= 0) continue;
    const nb = parseNum(nombres[i]);
    rows.push({
      dossierId,
      operateur,
      date,
      heuresPassees: h,
      typeTravail: String(phases[i] || "Atelier").trim() || "Atelier",
      typeRealisation: String(typesR[i] || "").trim() || null,
      nombre: nb && nb > 0 ? nb : 1,
      description: String(descs[i] || "").trim(),
    });
  }

  // Renvoie le nombre de lignes réellement enregistrées : le formulaire s'appuie
  // dessus pour ne se vider qu'en cas de succès (fini les saisies perdues).
  if (rows.length === 0) return { saved: 0 };
  await db.insert(heures).values(rows);
  revalidatePath(`/dossiers/${dossierId}`);
  revalidatePath("/rapports");
  return { saved: rows.length };
}

// Supprime une saisie d'heures.
export async function deleteHeure(id: number, dossierId: number) {
  await db.delete(heures).where(eq(heures.id, id));
  revalidatePath(`/dossiers/${dossierId}`);
  revalidatePath("/rapports");
}
