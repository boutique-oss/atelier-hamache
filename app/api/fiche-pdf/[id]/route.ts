import { NextRequest, NextResponse } from "next/server";
import { get } from "@vercel/blob";

import { blobToken } from "@/lib/blob";
import { ensurePiecesJointes } from "@/lib/fiche-pieces-db";
import { sql } from "@/lib/raw-sql";

export const dynamic = "force-dynamic";

// Sert une prise de cotes jointe à une fiche Rideaux (store Blob PRIVÉ).
// Protégée par le middleware (code d'accès). `?download=1` force le
// téléchargement.
export async function GET(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  const id = Number(params.id);
  if (!Number.isFinite(id)) {
    return NextResponse.json({ error: "id invalide" }, { status: 400 });
  }
  await ensurePiecesJointes();
  const [row] = await sql`SELECT nom_fichier, pathname FROM fiche_pieces_jointes WHERE id = ${id}`;
  if (!row) return NextResponse.json({ error: "fichier introuvable" }, { status: 404 });

  const token = blobToken();
  if (!token) return NextResponse.json({ error: "stockage non configuré" }, { status: 500 });

  const res = await get(String(row.pathname), { access: "private", token });
  if (!res || res.statusCode !== 200 || !res.stream) {
    return NextResponse.json({ error: "fichier introuvable" }, { status: 404 });
  }
  const download = req.nextUrl.searchParams.get("download") === "1";
  return new NextResponse(res.stream, {
    headers: {
      "Content-Type": res.blob.contentType || "application/pdf",
      "Content-Disposition": `${download ? "attachment" : "inline"}; filename*=UTF-8''${encodeURIComponent(
        String(row.nom_fichier)
      )}`,
      "Cache-Control": "private, no-store",
    },
  });
}
