import { NextRequest, NextResponse } from "next/server";
import { get } from "@vercel/blob";

import { blobToken } from "@/lib/blob";
import { ensureDocuments } from "@/lib/documents-db";
import { sql } from "@/lib/raw-sql";
import { utilisateurCourant } from "@/lib/session";

export const dynamic = "force-dynamic";

// Sert un fichier du module Documents (store Blob PRIVÉ) : seul un
// utilisateur connecté peut le lire, l'URL Blob n'est jamais exposée.
// `?download=1` force le téléchargement.
export async function GET(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  if (!(await utilisateurCourant())) {
    return NextResponse.json({ error: "non connecté" }, { status: 401 });
  }
  const id = Number(params.id);
  if (!Number.isInteger(id) || id <= 0) {
    return NextResponse.json({ error: "id invalide" }, { status: 400 });
  }
  await ensureDocuments();
  const [row] = await sql`SELECT nom, pathname, content_type FROM documents WHERE id = ${id}`;
  if (!row) return NextResponse.json({ error: "fichier introuvable" }, { status: 404 });

  const token = blobToken();
  if (!token) return NextResponse.json({ error: "stockage non configuré" }, { status: 500 });

  const res = await get(String(row.pathname), { access: "private", token });
  if (!res || res.statusCode !== 200 || !res.stream) {
    return NextResponse.json({ error: "fichier introuvable" }, { status: 404 });
  }

  const download = req.nextUrl.searchParams.get("download") === "1";
  // filename* (RFC 5987) pour gérer les accents / espaces du nom d'origine.
  const disposition = `${download ? "attachment" : "inline"}; filename*=UTF-8''${encodeURIComponent(
    String(row.nom)
  )}`;

  return new NextResponse(res.stream, {
    headers: {
      "Content-Type": String(row.content_type || res.blob.contentType || "application/octet-stream"),
      "Content-Disposition": disposition,
      "Cache-Control": "private, no-store",
      "X-Content-Type-Options": "nosniff",
    },
  });
}
