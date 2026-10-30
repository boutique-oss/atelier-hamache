"use server";

import { del, head } from "@vercel/blob";
import { revalidatePath } from "next/cache";

import { blobToken } from "@/lib/blob";
import {
  CATEGORIES_DOCUMENT,
  ensureDocuments,
  type CategorieDocument,
  type OrigineDocument,
} from "@/lib/documents-db";
import { cheminValide, DOCUMENT_TAILLE_MAX, typeDocument } from "@/lib/documents-fichiers";
import { sql } from "@/lib/raw-sql";
import { revalidateDossierViews } from "@/lib/revalidate";
import { estAdmin, utilisateurCourant } from "@/lib/session";

export type DocumentDepose = {
  id: number;
  nom: string;
  categorie: CategorieDocument;
  dossierId: number | null;
  taille: number;
  contentType: string;
};

const ORIGINES: OrigineDocument[] = ["depose", "genere", "scan"];

function rafraichir(dossierId: number | null) {
  revalidatePath("/documents");
  if (dossierId != null) revalidateDossierViews(dossierId);
}

// Enregistre la ligne `documents` d'un fichier que le navigateur vient
// d'envoyer sur le Blob (voir /api/documents/upload). Rien n'est cru sur
// parole : le chemin doit correspondre au dossier et à la catégorie, et la
// taille et le type sont relus sur le Blob. Un fichier non conforme est
// supprimé du Blob. Rappeler l'action pour le même fichier ne crée pas de
// doublon (double clic, nouvel essai après coupure réseau).
export async function enregistrerDocument(input: {
  pathname: string;
  nom: string;
  dossierId: number | null;
  categorie: string;
  origine?: string;
  docDossierId?: number | null;
  commandeId?: number | null;
}): Promise<{ ok: true; document: DocumentDepose } | { ok: false; error: string }> {
  const u = await utilisateurCourant();
  if (!u) return { ok: false, error: "Session expirée : reconnectez-vous." };
  const token = blobToken();
  if (!token) return { ok: false, error: "Stockage des fichiers non configuré." };

  const dossierId = input.dossierId == null ? null : Number(input.dossierId);
  const docDossierId = input.docDossierId == null ? null : Number(input.docDossierId);
  const commandeId = input.commandeId == null ? null : Number(input.commandeId);
  const categorie = String(input.categorie) as CategorieDocument;
  const origine = (input.origine ?? "depose") as OrigineDocument;
  const pathname = String(input.pathname ?? "");
  const nom = String(input.nom ?? "").trim().slice(0, 255) || pathname.split("/").pop() || "fichier";

  if (
    [dossierId, docDossierId, commandeId].some((v) => v != null && !Number.isInteger(v)) ||
    !CATEGORIES_DOCUMENT.some((c) => c.cle === categorie) ||
    !ORIGINES.includes(origine) ||
    !cheminValide(pathname, dossierId, categorie)
  ) {
    return { ok: false, error: "Fichier invalide." };
  }

  await ensureDocuments();

  const [deja] = await sql`SELECT id, nom, categorie, dossier_id, taille, content_type
    FROM documents WHERE pathname = ${pathname}`;
  if (deja) {
    return {
      ok: true,
      document: {
        id: Number(deja.id),
        nom: String(deja.nom),
        categorie: deja.categorie as CategorieDocument,
        dossierId: deja.dossier_id == null ? null : Number(deja.dossier_id),
        taille: Number(deja.taille ?? 0),
        contentType: String(deja.content_type ?? ""),
      },
    };
  }

  let blob: Awaited<ReturnType<typeof head>>;
  try {
    blob = await head(pathname, { token });
  } catch {
    return { ok: false, error: "Fichier introuvable sur le stockage : l'envoi n'a pas abouti." };
  }
  const contentType = typeDocument(pathname, blob.contentType);
  if (!contentType || blob.size > DOCUMENT_TAILLE_MAX) {
    await del(pathname, { token }).catch(() => {});
    return { ok: false, error: "Type ou taille de fichier non accepté." };
  }

  // Sous-dossier libre : il doit appartenir au même dossier et à la même catégorie.
  if (docDossierId != null) {
    const [sd] = await sql`SELECT 1 FROM doc_dossiers WHERE id = ${docDossierId}
      AND dossier_id IS NOT DISTINCT FROM ${dossierId} AND categorie = ${categorie}`;
    if (!sd) return { ok: false, error: "Sous-dossier introuvable." };
  }

  try {
    const [row] = await sql`INSERT INTO documents
        (dossier_id, doc_dossier_id, categorie, origine, nom, pathname, url,
         content_type, taille, commande_id, cree_par)
      VALUES (${dossierId}, ${docDossierId}, ${categorie}, ${origine}, ${nom},
        ${pathname}, ${blob.url}, ${contentType}, ${blob.size}, ${commandeId}, ${u.nom})
      RETURNING id`;
    rafraichir(dossierId);
    return {
      ok: true,
      document: { id: Number(row.id), nom, categorie, dossierId, taille: blob.size, contentType },
    };
  } catch (e) {
    console.error("Enregistrement document échoué:", (e as Error).message);
    return { ok: false, error: "Le fichier est envoyé mais n'a pas pu être enregistré. Réessayez." };
  }
}

// Supprime un document (fichier Blob + ligne). Réservé à l'administrateur ;
// la confirmation est demandée côté interface (ConfirmDeleteButton).
export async function supprimerDocument(id: number): Promise<{ ok: boolean; error?: string }> {
  if (!(await estAdmin())) return { ok: false, error: "Suppression réservée à l'administrateur." };
  if (!Number.isInteger(id) || id <= 0) return { ok: false, error: "Document invalide." };
  await ensureDocuments();
  const [row] = await sql`SELECT pathname, dossier_id FROM documents WHERE id = ${id}`;
  if (!row) return { ok: false, error: "Document introuvable." };

  const token = blobToken();
  if (token) {
    // Blob supprimé « au mieux » : une erreur ici ne doit pas laisser la
    // ligne affichée.
    try {
      await del(String(row.pathname), { token });
    } catch (e) {
      console.error("Suppression blob document échouée:", (e as Error).message);
    }
  }
  await sql`DELETE FROM documents WHERE id = ${id}`;
  rafraichir(row.dossier_id == null ? null : Number(row.dossier_id));
  return { ok: true };
}
