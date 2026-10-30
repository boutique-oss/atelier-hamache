"use server";

import { revalidatePath } from "next/cache";

import { sql } from "@/lib/raw-sql";
import { utilisateurCourant } from "@/lib/session";
import { ensureRideauxTables } from "@/lib/rideaux/db";
import { sanitizeLigne, sanitizeParams, totaux } from "@/lib/rideaux/calcul";

export type SaveCalculInput = {
  id: number | null;
  nom: string;
  client: string;
  dossierId: number | null;
  lignes: unknown[];
  params: unknown;
};

// Enregistre (crée ou met à jour) un chiffrage. Les entrées sont validées et
// les totaux recalculés ici, côté serveur : rien n'est repris tel quel du client.
export async function saveCalcul(
  input: SaveCalculInput
): Promise<{ ok: true; id: number } | { ok: false; error: string }> {
  try {
    await ensureRideauxTables();
    const params = sanitizeParams(input.params);
    const brut = Array.isArray(input.lignes) ? input.lignes.slice(0, 100) : [];
    if (brut.length === 0) return { ok: false, error: "Aucune fenêtre à enregistrer." };
    const lignes = brut.map((l, i) => sanitizeLigne(l, i + 1, params));
    const T = totaux(lignes, params);
    const nom = String(input.nom ?? "").trim().slice(0, 200) || "Projet sans nom";
    const client = String(input.client ?? "").trim().slice(0, 200);
    const dossierId =
      input.dossierId != null && Number.isFinite(Number(input.dossierId)) ? Number(input.dossierId) : null;
    const lignesJson = JSON.stringify(lignes);
    const paramsJson = JSON.stringify(params);

    let id = input.id != null ? Number(input.id) : null;
    if (id) {
      const res = await sql`UPDATE calculs_rideaux SET
          nom = ${nom}, client = ${client}, dossier_id = ${dossierId},
          lignes = ${lignesJson}::jsonb, params = ${paramsJson}::jsonb,
          nb_fenetres = ${T.nbFenetres}, metrage_tissu = ${T.tissu / 100},
          metrage_doublure = ${T.doubl / 100}, heures = ${T.h},
          total_ht = ${T.ht}, total_ttc = ${T.ttc}, updated_at = now()
        WHERE id = ${id} RETURNING id`;
      if (res.length === 0) id = null; // supprimé entre-temps : on recrée
    }
    if (!id) {
      const [row] = await sql`INSERT INTO calculs_rideaux
          (nom, client, dossier_id, lignes, params, nb_fenetres, metrage_tissu,
           metrage_doublure, heures, total_ht, total_ttc)
        VALUES (${nom}, ${client}, ${dossierId}, ${lignesJson}::jsonb, ${paramsJson}::jsonb,
          ${T.nbFenetres}, ${T.tissu / 100}, ${T.doubl / 100}, ${T.h}, ${T.ht}, ${T.ttc})
        RETURNING id`;
      id = Number(row.id);
    }
    revalidatePath("/rideaux");
    revalidatePath(`/rideaux/${id}`);
    return { ok: true, id };
  } catch (e) {
    return { ok: false, error: (e as Error).message };
  }
}

export async function deleteCalcul(id: number): Promise<{ ok: boolean }> {
  await ensureRideauxTables();
  await sql`DELETE FROM calculs_rideaux WHERE id = ${id}`;
  revalidatePath("/rideaux");
  return { ok: true };
}

// Paramètres atelier : réservés à l'admin (ou accès libre tant qu'aucun compte
// n'existe, comme l'entrée Admin de la barre latérale).
export async function saveParamsAtelier(
  raw: unknown,
  valide: boolean
): Promise<{ ok: true } | { ok: false; error: string }> {
  const u = await utilisateurCourant();
  if (u && u.role !== "admin") return { ok: false, error: "Réservé à l'administrateur." };
  await ensureRideauxTables();
  const params = sanitizeParams(raw);
  const json = JSON.stringify(params);
  await sql`INSERT INTO rideaux_parametres (id, data, valide, updated_at)
    VALUES (1, ${json}::jsonb, ${!!valide}, now())
    ON CONFLICT (id) DO UPDATE SET data = EXCLUDED.data, valide = EXCLUDED.valide, updated_at = now()`;
  revalidatePath("/rideaux", "layout");
  return { ok: true };
}
