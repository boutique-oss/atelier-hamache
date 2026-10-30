import { NextRequest, NextResponse } from "next/server";
import { eq } from "drizzle-orm";
import { get } from "@vercel/blob";

import { db } from "@/db";
import { devisSignes } from "@/db/schema";
import { blobToken } from "@/lib/blob";

export const dynamic = "force-dynamic";

// Sert un devis signé stocké sur Vercel Blob (store PRIVÉ). La route est
// protégée par le middleware (code d'accès) : seul un utilisateur connecté à
// l'app peut lire le fichier. `?download=1` force le téléchargement.
export async function GET(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  const id = Number(params.id);
  if (!Number.isFinite(id)) {
    return NextResponse.json({ error: "id invalide" }, { status: 400 });
  }

  const [row] = await db
    .select()
    .from(devisSignes)
    .where(eq(devisSignes.id, id));
  if (!row) {
    return NextResponse.json({ error: "devis introuvable" }, { status: 404 });
  }

  const token = blobToken();
  if (!token) {
    return NextResponse.json(
      { error: "stockage non configuré" },
      { status: 500 }
    );
  }

  const res = await get(row.pathname, { access: "private", token });
  if (!res || res.statusCode !== 200 || !res.stream) {
    return NextResponse.json({ error: "fichier introuvable" }, { status: 404 });
  }

  const download = req.nextUrl.searchParams.get("download") === "1";
  // filename* (RFC 5987) pour gérer les accents / espaces du nom d'origine.
  const disposition = `${download ? "attachment" : "inline"}; filename*=UTF-8''${encodeURIComponent(
    row.nomFichier
  )}`;

  return new NextResponse(res.stream, {
    headers: {
      "Content-Type":
        row.contentType || res.blob.contentType || "application/pdf",
      "Content-Disposition": disposition,
      "Cache-Control": "private, no-store",
    },
  });
}
