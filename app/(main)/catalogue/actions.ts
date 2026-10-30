"use server";

import { eq } from "drizzle-orm";
import { revalidatePath } from "next/cache";

import { db } from "@/db";
import { fournisseurs, collections, catalogueRefs } from "@/db/schema";

// Le catalogue est un annuaire à trois niveaux (fournisseurs → collections →
// références). On revalide la racine et les sous-pages concernées après chaque
// écriture pour que les compteurs et les listes restent à jour.
function revalidateCatalogue(fournisseurId?: number, collectionId?: number) {
  revalidatePath("/catalogue");
  if (fournisseurId) revalidatePath(`/catalogue/${fournisseurId}`);
  if (fournisseurId && collectionId)
    revalidatePath(`/catalogue/${fournisseurId}/${collectionId}`);
}

const str = (fd: FormData, k: string) => ((fd.get(k) as string) || "").trim();
const num = (fd: FormData, k: string) => {
  const v = fd.get(k) as string | null;
  if (v === null || v.trim() === "") return null;
  const n = Number(v.replace(",", "."));
  return Number.isFinite(n) ? n : null;
};

// -------------------------------------------------------------- Fournisseurs
export async function createFournisseur(fd: FormData) {
  const nom = str(fd, "nom");
  if (!nom) return;
  try {
    await db.insert(fournisseurs).values({
      nom,
      urlSite: str(fd, "urlSite"),
      contact: str(fd, "contact"),
      codeEbp: str(fd, "codeEbp"),
      commentaires: str(fd, "commentaires"),
    });
  } catch {
    // violation d'unicité (nom déjà pris) -> on ignore
  }
  revalidateCatalogue();
}

export async function updateFournisseur(id: number, fd: FormData) {
  const nom = str(fd, "nom");
  if (!nom) return;
  try {
    await db
      .update(fournisseurs)
      .set({
        nom,
        urlSite: str(fd, "urlSite"),
        contact: str(fd, "contact"),
        codeEbp: str(fd, "codeEbp"),
        commentaires: str(fd, "commentaires"),
      })
      .where(eq(fournisseurs.id, id));
  } catch {
    // doublon -> on ignore
  }
  revalidateCatalogue(id);
}

export async function deleteFournisseur(id: number) {
  // Cascade en base : supprime aussi ses collections et références.
  await db.delete(fournisseurs).where(eq(fournisseurs.id, id));
  revalidateCatalogue();
}

// --------------------------------------------------------------- Collections
export async function createCollection(fournisseurId: number, fd: FormData) {
  const nom = str(fd, "nom");
  if (!nom) return;
  await db.insert(collections).values({
    fournisseurId,
    nom,
    editeur: str(fd, "editeur"),
    annee: str(fd, "annee"),
    commentaires: str(fd, "commentaires"),
  });
  revalidateCatalogue(fournisseurId);
}

export async function updateCollection(
  id: number,
  fournisseurId: number,
  fd: FormData
) {
  const nom = str(fd, "nom");
  if (!nom) return;
  await db
    .update(collections)
    .set({
      nom,
      editeur: str(fd, "editeur"),
      annee: str(fd, "annee"),
      commentaires: str(fd, "commentaires"),
    })
    .where(eq(collections.id, id));
  revalidateCatalogue(fournisseurId, id);
}

export async function deleteCollection(id: number, fournisseurId: number) {
  await db.delete(collections).where(eq(collections.id, id));
  revalidateCatalogue(fournisseurId);
}

// --------------------------------------------------------------- Références
export async function createRef(
  collectionId: number,
  fournisseurId: number,
  fd: FormData
) {
  const reference = str(fd, "reference");
  if (!reference) return;
  await db.insert(catalogueRefs).values({
    collectionId,
    reference,
    coloris: str(fd, "coloris"),
    laize: str(fd, "laize"),
    prixAchat: num(fd, "prixAchat"),
    prixVente: num(fd, "prixVente"),
    unite: str(fd, "unite") || "ml",
    libelle: str(fd, "libelle"),
    codeEbp: str(fd, "codeEbp"),
    numEchantillon: str(fd, "numEchantillon"),
    enMagasin: fd.get("enMagasin") !== null,
    commentaires: str(fd, "commentaires"),
  });
  revalidateCatalogue(fournisseurId, collectionId);
}

export async function updateRef(
  id: number,
  collectionId: number,
  fournisseurId: number,
  fd: FormData
) {
  const reference = str(fd, "reference");
  if (!reference) return;
  await db
    .update(catalogueRefs)
    .set({
      reference,
      coloris: str(fd, "coloris"),
      laize: str(fd, "laize"),
      prixAchat: num(fd, "prixAchat"),
      prixVente: num(fd, "prixVente"),
      unite: str(fd, "unite") || "ml",
      libelle: str(fd, "libelle"),
      codeEbp: str(fd, "codeEbp"),
      numEchantillon: str(fd, "numEchantillon"),
      enMagasin: fd.get("enMagasin") !== null,
      commentaires: str(fd, "commentaires"),
      updatedAt: new Date().toISOString(),
    })
    .where(eq(catalogueRefs.id, id));
  revalidateCatalogue(fournisseurId, collectionId);
}

// Duplique une référence pour créer rapidement une variante de coloris.
// On reprend référence / laize / prix / unité / libellé / commentaire, mais on
// vide coloris, n° d'échantillon et code EBP : ce sont précisément les champs
// qui distinguent chaque coloris (et le code EBP doit rester unique par
// article). La copie reprend l'état ENREGISTRÉ de la référence source.
export async function duplicateRef(
  id: number,
  collectionId: number,
  fournisseurId: number
) {
  const [src] = await db
    .select()
    .from(catalogueRefs)
    .where(eq(catalogueRefs.id, id));
  if (!src) return;
  await db.insert(catalogueRefs).values({
    collectionId,
    reference: src.reference,
    coloris: "",
    laize: src.laize,
    prixAchat: src.prixAchat,
    prixVente: src.prixVente,
    unite: src.unite,
    libelle: src.libelle,
    codeEbp: "",
    numEchantillon: "",
    enMagasin: src.enMagasin,
    commentaires: src.commentaires,
  });
  revalidateCatalogue(fournisseurId, collectionId);
}

// Bascule rapide « présent en magasin » (coche inline sur la liste des réfs).
export async function toggleRefMagasin(
  id: number,
  collectionId: number,
  fournisseurId: number,
  valeur: boolean
) {
  await db
    .update(catalogueRefs)
    .set({ enMagasin: valeur, updatedAt: new Date().toISOString() })
    .where(eq(catalogueRefs.id, id));
  revalidateCatalogue(fournisseurId, collectionId);
}

export async function deleteRef(
  id: number,
  collectionId: number,
  fournisseurId: number
) {
  await db.delete(catalogueRefs).where(eq(catalogueRefs.id, id));
  revalidateCatalogue(fournisseurId, collectionId);
}
