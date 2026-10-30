import { revalidatePath } from "next/cache";
import { NextRequest, NextResponse } from "next/server";

import { sql } from "@/lib/raw-sql";

export const dynamic = "force-dynamic";
export const fetchCache = "force-no-store";
export const revalidate = 0;

// Coche « Reçu » d'une commande depuis le widget Rainmeter du bureau.
//
// Même protection que /api/rainmeter : exclue du middleware, exige
// ?cle=<RAINMETER_TOKEN>. GET (le WebParser de Rainmeter ne fait que du GET) :
//   id   identifiant de la ligne de commande
//   recu 1 = reçue, 0 = annuler (de nouveau à recevoir)
// Même effet que la coche de la fiche dossier / du Rapport des commandes
// (toggleCommandeFlag) : seul est_recu change, puis les pages sont rafraîchies.
// Réponse texte : « OK|<id>|<0|1>|<désignation> » ou « ERREUR|<message> ».

function texte(corps: string, status = 200) {
  return new NextResponse(corps + "\n", {
    status,
    headers: { "Content-Type": "text/plain; charset=utf-8", "Cache-Control": "no-store" },
  });
}

const f = (v: unknown) => String(v ?? "").replace(/[|\r\n]+/g, " ").trim();

export async function GET(req: NextRequest) {
  const p = req.nextUrl.searchParams;
  const attendu = process.env.RAINMETER_TOKEN;
  if (!attendu || p.get("cle") !== attendu) return texte("ERREUR|Cle invalide", 401);

  const id = Number(p.get("id"));
  const recu = p.get("recu") === "0" ? false : true;
  if (!Number.isInteger(id) || id <= 0) return texte("ERREUR|Commande inconnue", 400);

  try {
    const rows = await sql`
      UPDATE commandes SET est_recu = ${recu}
      WHERE id = ${id}
      RETURNING id, dossier_id, COALESCE(NULLIF(trim(designation), ''), NULLIF(trim(reference), ''), '') AS designation`;
    if (!rows.length) return texte("ERREUR|Commande introuvable", 404);
    const r = rows[0];
    if (r.dossier_id) revalidatePath(`/dossiers/${r.dossier_id}`);
    revalidatePath("/dossiers");
    revalidatePath("/rapports-commandes");
    revalidatePath("/documents/bon-commande");
    return texte(`OK|${r.id}|${recu ? 1 : 0}|${f(r.designation)}`);
  } catch (e) {
    console.error("[api/rainmeter/commande]", e);
    return texte("ERREUR|Base injoignable", 503);
  }
}
