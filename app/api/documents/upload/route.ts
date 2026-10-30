import { NextResponse } from "next/server";
import { handleUpload, type HandleUploadBody } from "@vercel/blob/client";

import { blobToken } from "@/lib/blob";
import { CATEGORIES_DOCUMENT, ensureDocuments } from "@/lib/documents-db";
import { cheminValide, DOCUMENT_TAILLE_MAX, DOCUMENT_TYPES_ACCEPTES } from "@/lib/documents-fichiers";
import { sql } from "@/lib/raw-sql";
import { utilisateurCourant } from "@/lib/session";

export const dynamic = "force-dynamic";

// Délivre au navigateur un jeton d'upload Vercel Blob (store PRIVÉ), valable
// pour UN chemin, les types acceptés et 50 Mo max. Le fichier part ensuite
// directement du navigateur vers le Blob, sans passer par nos fonctions.
// Pas de rappel `onUploadCompleted` (Vercel appellerait sans cookie et serait
// bloqué par le middleware / le filtre IP) : la ligne `documents` est créée
// ensuite par l'action authentifiée enregistrerDocument.
export async function POST(request: Request) {
  if (!(await utilisateurCourant())) {
    return NextResponse.json({ error: "Non connecté." }, { status: 401 });
  }
  const token = blobToken();
  if (!token) {
    return NextResponse.json({ error: "Stockage des fichiers non configuré." }, { status: 500 });
  }

  let body: HandleUploadBody;
  try {
    body = (await request.json()) as HandleUploadBody;
  } catch {
    return NextResponse.json({ error: "Requête invalide." }, { status: 400 });
  }
  if (body.type !== "blob.generate-client-token") {
    return NextResponse.json({ error: "Requête invalide." }, { status: 400 });
  }

  try {
    const json = await handleUpload({
      body,
      request,
      token,
      onBeforeGenerateToken: async (pathname, clientPayload) => {
        let p: { dossierId?: unknown; categorie?: unknown } = {};
        try {
          p = JSON.parse(clientPayload || "{}");
        } catch {
          throw new Error("Requête invalide.");
        }
        const dossierId = p.dossierId == null ? null : Number(p.dossierId);
        const categorie = String(p.categorie ?? "");
        if (dossierId != null && !Number.isInteger(dossierId)) throw new Error("Dossier invalide.");
        if (!CATEGORIES_DOCUMENT.some((c) => c.cle === categorie)) throw new Error("Catégorie inconnue.");
        if (!cheminValide(pathname, dossierId, categorie)) throw new Error("Nom de fichier ou type non accepté.");
        if (dossierId != null) {
          await ensureDocuments();
          const [d] = await sql`SELECT 1 FROM dossiers WHERE id = ${dossierId}`;
          if (!d) throw new Error("Dossier introuvable.");
        }
        return {
          allowedContentTypes: DOCUMENT_TYPES_ACCEPTES,
          maximumSizeInBytes: DOCUMENT_TAILLE_MAX,
          addRandomSuffix: false,
          allowOverwrite: false,
          validUntil: Date.now() + 30 * 60 * 1000,
        };
      },
    });
    return NextResponse.json(json);
  } catch (e) {
    return NextResponse.json({ error: (e as Error).message || "Envoi refusé." }, { status: 400 });
  }
}
