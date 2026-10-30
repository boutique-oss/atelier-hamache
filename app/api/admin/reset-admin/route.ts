import { NextRequest, NextResponse } from "next/server";

import { sql } from "@/lib/raw-sql";
import { getParamsSecurite } from "@/lib/securite";
import { hacherMotDePasse } from "@/lib/auth";

export const dynamic = "force-dynamic";

// Récupération d'urgence (anti-verrouillage). Crée/réinitialise un compte admin
// « secours » dont le mot de passe est le CODE D'ACCÈS courant. Permet de
// reprendre la main si plus aucun mot de passe admin n'est connu.
// À appeler manuellement : /api/admin/reset-admin?key=ash-reset-2026
const RESET_KEY = "ash-reset-2026";

export async function GET(req: NextRequest) {
  if (req.nextUrl.searchParams.get("key") !== RESET_KEY) {
    return NextResponse.json({ ok: false, error: "clé invalide" }, { status: 401 });
  }

  const { codeAcces } = await getParamsSecurite();
  if (!codeAcces) {
    return NextResponse.json(
      { ok: false, error: "aucun code d'accès défini pour servir de mot de passe" },
      { status: 400 }
    );
  }

  try {
    const { sel, hash } = await hacherMotDePasse(codeAcces);
    const upd = (await sql`
      UPDATE utilisateurs
      SET mdp_sel = ${sel}, mdp_hash = ${hash}, role = 'admin', actif = true, nom = 'Secours'
      WHERE lower(identifiant) = 'secours'
      RETURNING id
    `) as { id: number | string }[];

    if (!upd.length) {
      await sql`
        INSERT INTO utilisateurs (nom, identifiant, mdp_sel, mdp_hash, role, actif)
        VALUES ('Secours', 'secours', ${sel}, ${hash}, 'admin', true)
      `;
    }

    return NextResponse.json({
      ok: true,
      message:
        "Compte admin de secours prêt. Identifiant : « secours », mot de passe = code d'accès actuel. Connectez-vous puis changez le mot de passe.",
    });
  } catch (e) {
    return NextResponse.json({ ok: false, error: (e as Error).message }, { status: 500 });
  }
}
