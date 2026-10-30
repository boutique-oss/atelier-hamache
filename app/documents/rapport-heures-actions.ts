"use server";

import { put } from "@vercel/blob";
import { revalidatePath } from "next/cache";

import { blobToken } from "@/lib/blob";
import { ensureDocuments } from "@/lib/documents-db";
import { cheminDocument, nomSur } from "@/lib/documents-fichiers";
import { rapportDossier } from "@/lib/documents-heures";
import { sql } from "@/lib/raw-sql";
import { genererPdfRapportDossier } from "@/lib/rapport-heures-pdf";
import { revalidateDossierViews } from "@/lib/revalidate";
import { utilisateurCourant } from "@/lib/session";

// Génère le PDF « Rapport d'heures » d'un dossier et le range automatiquement
// dans ce dossier (catégorie Heures, origine « généré »). Chaque génération
// crée une nouvelle version datée : les anciennes restent consultables.
export async function genererRapportHeuresPdf(
  dossierId: number
): Promise<{ ok: true; id: number } | { ok: false; error: string }> {
  const u = await utilisateurCourant();
  if (!u) return { ok: false, error: "Session expirée : reconnectez-vous." };
  const token = blobToken();
  if (!token) return { ok: false, error: "Stockage des fichiers non configuré." };
  const id = Number(dossierId);
  if (!Number.isInteger(id) || id <= 0) return { ok: false, error: "Dossier invalide." };

  await ensureDocuments();
  const rapport = await rapportDossier(id);
  if (!rapport) return { ok: false, error: "Ce dossier n'existe plus." };

  const maintenant = new Date();
  const jour = maintenant.toISOString().slice(0, 10);
  const nom = `Rapport d'heures - ${rapport.nom} - ${jour.split("-").reverse().join("-")}.pdf`;
  const pathname = cheminDocument(id, "heures", nomSur(`rapport-heures-${rapport.nom}.pdf`), maintenant);

  try {
    const octets = await genererPdfRapportDossier(rapport, u.nom);
    const blob = await put(pathname, Buffer.from(octets), {
      access: "private",
      contentType: "application/pdf",
      addRandomSuffix: false,
      token,
    });
    const [row] = await sql`INSERT INTO documents
        (dossier_id, categorie, origine, nom, pathname, url, content_type, taille, cree_par)
      VALUES (${id}, 'heures', 'genere', ${nom}, ${blob.pathname}, ${blob.url},
        'application/pdf', ${octets.length}, ${u.nom})
      RETURNING id`;
    revalidatePath("/documents");
    revalidateDossierViews(id);
    return { ok: true, id: Number(row.id) };
  } catch (e) {
    console.error("Rapport d'heures PDF échoué:", (e as Error).message);
    return { ok: false, error: "Le PDF n'a pas pu être généré. Réessayez." };
  }
}
