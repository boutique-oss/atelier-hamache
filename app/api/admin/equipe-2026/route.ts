import { NextRequest, NextResponse } from "next/server";

import { sql } from "@/lib/raw-sql";

export const dynamic = "force-dynamic";

// Mise à jour ponctuelle de l'équipe (2026) — à lancer une fois :
//   /api/admin/equipe-2026?key=ash-migrate-2026
// 1) Stéphan RESTE dans les opérateurs (il saisit des heures sur les dossiers)
//    mais est EXCLU du pointage : on le marque est_dirigeant = true.
// 2) Ajoute Raphaël, salarié 20 h / semaine (présent dans le pointage).
// Idempotente : relancer ne casse rien (UPDATE + upsert sur le nom).
const KEY = "ash-migrate-2026";

export async function GET(req: NextRequest) {
  if (req.nextUrl.searchParams.get("key") !== KEY) {
    return NextResponse.json({ ok: false, error: "clé invalide" }, { status: 401 });
  }
  try {
    // 1) Exception Stéphan : conservé dans les opérateurs, mais sorti du pointage
    //    (est_dirigeant = true → exclu de la grille et du décompte salarié).
    const majStephan = await sql`
      UPDATE operateurs
      SET est_dirigeant = true
      WHERE lower(nom) LIKE 'st%phan%'
      RETURNING nom`;

    // 2) Raphaël, salarié 20 h/semaine (contrat à mi-temps), DANS le pointage.
    await sql`
      INSERT INTO operateurs (nom, actif, heures_semaine, est_dirigeant)
      VALUES ('Raphaël', true, 20, false)
      ON CONFLICT (nom)
      DO UPDATE SET actif = true, heures_semaine = 20, est_dirigeant = false`;

    return NextResponse.json({
      ok: true,
      stephanExclusDuPointage: (majStephan as { nom: string }[]).map((r) => r.nom),
      raphael: "ajouté / mis à jour à 20 h/semaine (dans le pointage)",
    });
  } catch (e) {
    return NextResponse.json(
      { ok: false, error: (e as Error).message },
      { status: 500 }
    );
  }
}
