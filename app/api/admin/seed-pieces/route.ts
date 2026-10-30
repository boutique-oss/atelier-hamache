import { NextResponse } from "next/server";
import { eq, inArray } from "drizzle-orm";

import { db } from "@/db";
import { dossiers } from "@/db/schema";
import { withPieceFlag } from "@/lib/piece-classifier";

// One-shot : applique les classifications manuelles fournies par l'utilisateur
// (flag « piece:… ») sur les dossiers sans détail exploitable. Idempotent.
// Protégé par le code d'accès. À retirer après usage.
export const dynamic = "force-dynamic";

const SEED: { id: number; piece: string; qte: number }[] = [
  { id: 61, piece: "Banquette", qte: 4 }, // GOLF
  { id: 25, piece: "Salon", qte: 1 }, // Proust — salon entier
  { id: 8, piece: "Fauteuil", qte: 1 }, // Brodberger
  { id: 32, piece: "Fauteuil", qte: 1 }, // Brodberger (restauration fauteuil)
  { id: 5, piece: "Rideaux", qte: 8 }, // Arcaro — rideaux 4 fenêtres
  { id: 136, piece: "Galette", qte: 6 }, // Langlois — 6 galettes
];

export async function GET() {
  const ids = SEED.map((s) => s.id);
  const rows = await db
    .select({ id: dossiers.id, flags: dossiers.flags })
    .from(dossiers)
    .where(inArray(dossiers.id, ids));
  const flagsById = new Map(rows.map((r) => [Number(r.id), r.flags]));

  const applied: any[] = [];
  for (const s of SEED) {
    const raw = flagsById.get(s.id);
    if (raw === undefined) {
      applied.push({ id: s.id, statut: "introuvable" });
      continue;
    }
    let cur: string[] = [];
    try {
      const a = JSON.parse(raw || "[]");
      cur = Array.isArray(a) ? a.map(String) : [];
    } catch {
      cur = [];
    }
    const next = withPieceFlag(cur, s.piece, s.qte);
    await db
      .update(dossiers)
      .set({ flags: JSON.stringify(next), updatedAt: new Date().toISOString() })
      .where(eq(dossiers.id, s.id));
    applied.push({ id: s.id, piece: s.piece, qte: s.qte, statut: "ok" });
  }

  return NextResponse.json({ applied });
}
