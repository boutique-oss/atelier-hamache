"use server";

import { put } from "@vercel/blob";
import { revalidatePath } from "next/cache";

import { blobToken } from "@/lib/blob";
import { ensureDocuments } from "@/lib/documents-db";
import { cheminDocument } from "@/lib/documents-fichiers";
import { sql } from "@/lib/raw-sql";
import { rapportDossier } from "@/lib/rapport-heures";
import { rapportHeuresPdf } from "@/lib/rapport-heures-pdf";
import { revalidateDossierViews } from "@/lib/revalidate";
import { utilisateurCourant } from "@/lib/session";

// Génère le rapport d'heures PDF d'un dossier et l'enregistre dans ses
// documents (catégorie « heures », origine « généré »). Chaque export crée un
// nouveau fichier daté : les versions précédentes restent consultables.
export async function exporterRapportHeures(
  dossierId: number
): Promise<{ ok: true; documentId: number } | { ok: false; error: string }> {
  const u = await utilisateurCourant();
  if (!u) return { ok: false, error: "Session expirée : reconnectez-vous." };
  if (!Number.isInteger(dossierId) || dossierId <= 0) return { ok: false, error: "Dossier invalide." };
  const token = blobToken();
  if (!token) return { ok: false, error: "Stockage des fichiers non configuré." };

  const rapport = await rapportDossier(dossierId);
  if (!rapport) return { ok: false, error: "Dossier introuvable." };

  const maintenant = new Date();
  const nom = `Rapport d'heures - ${rapport.nom} - ${maintenant.toISOString().slice(0, 10)}.pdf`;
  try {
    const octets = rapportHeuresPdf(rapport, { auteur: u.nom, date: maintenant });
    const pathname = cheminDocument(dossierId, "heures", nom, maintenant);
    const blob = await put(pathname, Buffer.from(octets), {
      access: "private",
      contentType: "application/pdf",
      addRandomSuffix: false,
      token,
    });
    await ensureDocuments();
    const [row] = await sql`INSERT INTO documents
        (dossier_id, categorie, origine, nom, pathname, url, content_type, taille, cree_par)
      VALUES (${dossierId}, 'heures', 'genere', ${nom}, ${blob.pathname}, ${blob.url},
        'application/pdf', ${octets.byteLength}, ${u.nom})
      RETURNING id`;
    revalidatePath("/documents");
    revalidateDossierViews(dossierId);
    return { ok: true, documentId: Number(row.id) };
  } catch (e) {
    console.error("Export rapport d'heures échoué:", (e as Error).message);
    return { ok: false, error: "Le rapport n'a pas pu être enregistré. Réessayez." };
  }
}
