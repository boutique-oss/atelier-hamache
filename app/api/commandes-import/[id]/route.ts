import { NextRequest, NextResponse } from "next/server";
import { get } from "@vercel/blob";

import { blobToken } from "@/lib/blob";
import { ensureImports } from "@/lib/commande-imports-db";
import { sql } from "@/lib/raw-sql";

export const dynamic = "force-dynamic";

// Sert un PDF fournisseur importé (store Blob PRIVÉ). Protégée par le
// middleware (code d'accès). `?download=1` force le téléchargement.
export async function GET(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  const id = Number(params.id);
  if (!Number.isFinite(id)) {
    return NextResponse.json({ error: "id invalide" }, { status: 400 });
  }

  await ensureImports();
  const [row] = await sql`SELECT nom_fichier, pathname FROM commande_imports
    WHERE id = ${id}`;
  if (!row) {
    return NextResponse.json({ error: "PDF introuvable" }, { status: 404 });
  }

  const token = blobToken();
  if (!token) {
    return NextResponse.json({ error: "stockage non configuré" }, { status: 500 });
  }

  const res = await get(String(row.pathname), { access: "private", token });
  if (!res || res.statusCode !== 200 || !res.stream) {
    return NextResponse.json({ error: "fichier introuvable" }, { status: 404 });
  }

  const download = req.nextUrl.searchParams.get("download") === "1";
  const disposition = `${download ? "attachment" : "inline"}; filename*=UTF-8''${encodeURIComponent(
    String(row.nom_fichier)
  )}`;

  return new NextResponse(res.stream, {
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": disposition,
      "Cache-Control": "private, no-store",
    },
  });
}
