import { NextRequest, NextResponse } from "next/server";

import { sql } from "@/lib/raw-sql";

export const dynamic = "force-dynamic";

// Fusionne les fournisseurs en double. Plan validé avec l'atelier (2026-09-09) :
//   - doublons de FORME (casse/accents/espaces/ponctuation) regroupés, avec un
//     nom maître propre imposé ci-dessous (OVERRIDE) ;
//   - deux fusions d'ORTHOGRAPHE explicitement demandées (MANUELS).
//   Aperçu (lecture seule) : /api/admin/fusion-fournisseurs?key=ash-fusion-2026
//   Application            : /api/admin/fusion-fournisseurs?key=ash-fusion-2026&apply=1
const FUSION_KEY = "ash-fusion-2026";

// Nom maître propre pour certains groupes de forme (clé normalisée → nom final).
const OVERRIDE: Record<string, string> = {
  houles: "Houlès",
  "rouge carmin": "Rouge carmin",
  sanderson: "Sanderson",
  sofic: "Sofic",
  vaat: "VAAT",
};

// Fusions d'orthographe demandées : plusieurs clés normalisées → un nom final.
const MANUELS: Array<{ cles: string[]; nom: string }> = [
  { cles: ["cote martinon", "cotte martinon"], nom: "Côte Martinon" },
  { cles: ["osborne", "osborn"], nom: "Osborne" },
];

// Normalisation de forme : minuscules, sans accents, ponctuation → espace.
function norm(s: string): string {
  return (s || "")
    .normalize("NFD")
    .replace(/\p{Diacritic}/gu, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, " ")
    .trim()
    .replace(/\s+/g, " ");
}

type F = { id: number; nom: string };

export async function GET(req: NextRequest) {
  if (req.nextUrl.searchParams.get("key") !== FUSION_KEY) {
    return NextResponse.json({ ok: false, error: "clé invalide" }, { status: 401 });
  }
  const apply = req.nextUrl.searchParams.get("apply") === "1";

  try {
    const fournisseurs = (await sql`
      select id, nom from fournisseurs order by id
    `) as F[];

    const usageRows = (await sql`
      select trim(fournisseur) as nom, count(*)::int as n
      from commandes
      where coalesce(trim(fournisseur), '') <> ''
      group by trim(fournisseur)
    `) as Array<{ nom: string; n: number }>;
    const usage = new Map(usageRows.map((r) => [r.nom, r.n]));

    const colRows = (await sql`
      select fournisseur_id as id, count(*)::int as n
      from collections group by fournisseur_id
    `) as Array<{ id: number; n: number }>;
    const nbCols = new Map(colRows.map((r) => [r.id, r.n]));

    // Regroupe les fournisseurs par clé de forme normalisée.
    const parCle = new Map<string, F[]>();
    for (const f of fournisseurs) {
      const k = norm(f.nom);
      if (!k) continue;
      if (!parCle.has(k)) parCle.set(k, []);
      parCle.get(k)!.push(f);
    }

    // Plan de fusion : { membres, nomFinal }. On construit d'abord les fusions
    // manuelles (qui peuvent réunir plusieurs clés), puis les doublons de forme.
    const clesUtilisees = new Set<string>();
    const specs: Array<{ membres: F[]; nomFinal: string }> = [];

    for (const m of MANUELS) {
      const membres: F[] = [];
      for (const k of m.cles) {
        const g = parCle.get(k);
        if (g) {
          membres.push(...g);
          clesUtilisees.add(k);
        }
      }
      if (membres.length > 1) specs.push({ membres, nomFinal: m.nom });
    }

    for (const [cle, membres] of parCle.entries()) {
      if (clesUtilisees.has(cle)) continue;
      if (membres.length < 2) continue;
      const parUsage = [...membres].sort((a, b) => {
        const d = (usage.get(b.nom) ?? 0) - (usage.get(a.nom) ?? 0);
        if (d) return d;
        const c = (nbCols.get(b.id) ?? 0) - (nbCols.get(a.id) ?? 0);
        if (c) return c;
        return a.id - b.id;
      });
      const nomFinal = OVERRIDE[cle] ?? parUsage[0].nom;
      specs.push({ membres, nomFinal });
    }

    // Pour chaque spec, désigne la fiche « maître » (celle qui survit) : celle
    // dont le nom == nom final, sinon la plus utilisée.
    const planifie = specs.map(({ membres, nomFinal }) => {
      const maitre =
        membres.find((m) => m.nom === nomFinal) ??
        [...membres].sort(
          (a, b) => (usage.get(b.nom) ?? 0) - (usage.get(a.nom) ?? 0) || a.id - b.id
        )[0];
      return { nomFinal, maitre, absorbes: membres.filter((m) => m.id !== maitre.id) };
    });

    if (!apply) {
      return NextResponse.json({
        ok: true,
        mode: "aperçu",
        aFusionner: planifie.length,
        plan: planifie.map((p) => ({
          nomFinal: p.nomFinal,
          maitre: { id: p.maitre.id, nom: p.maitre.nom },
          absorbes: p.absorbes.map((m) => ({ id: m.id, nom: m.nom })),
        })),
        note: "Rien n'a été modifié. Ajoutez &apply=1 pour exécuter ce plan.",
      });
    }

    // --- Application ---
    let fournisseursSupprimes = 0;
    let collectionsFusionnees = 0;
    let collectionsDeplacees = 0;
    let commandesReetiquetees = 0;
    let maitresRenommes = 0;

    for (const p of planifie) {
      const tous = [p.maitre, ...p.absorbes];
      // 1) Réétiquette toutes les commandes vers le nom final.
      for (const m of tous) {
        const r = (await sql`
          update commandes set fournisseur = ${p.nomFinal}
          where trim(fournisseur) = ${m.nom}
          returning id
        `) as Array<{ id: number }>;
        commandesReetiquetees += r.length;
      }
      // 2) Déplace/fusionne les collections des fiches absorbées vers le maître.
      for (const m of p.absorbes) {
        const cols = (await sql`
          select id, nom from collections where fournisseur_id = ${m.id}
        `) as Array<{ id: number; nom: string }>;
        for (const c of cols) {
          const jumelle = (await sql`
            select id from collections
            where fournisseur_id = ${p.maitre.id} and lower(nom) = lower(${c.nom})
            limit 1
          `) as Array<{ id: number }>;
          if (jumelle.length > 0) {
            const cible = jumelle[0].id;
            await sql`
              delete from catalogue_refs s
              where s.collection_id = ${c.id}
                and exists (
                  select 1 from catalogue_refs t
                  where t.collection_id = ${cible}
                    and t.reference = s.reference
                    and coalesce(t.libelle, '') = coalesce(s.libelle, '')
                )`;
            await sql`update catalogue_refs set collection_id = ${cible} where collection_id = ${c.id}`;
            await sql`delete from collections where id = ${c.id}`;
            collectionsFusionnees++;
          } else {
            await sql`update collections set fournisseur_id = ${p.maitre.id} where id = ${c.id}`;
            collectionsDeplacees++;
          }
        }
        // 3) Supprime la fiche absorbée (plus aucune collection rattachée).
        await sql`delete from fournisseurs where id = ${m.id}`;
        fournisseursSupprimes++;
      }
      // 4) Renomme le maître si besoin (après suppression des absorbés, pour
      //    éviter un conflit d'unicité sur le nom).
      if (p.maitre.nom !== p.nomFinal) {
        await sql`update fournisseurs set nom = ${p.nomFinal} where id = ${p.maitre.id}`;
        maitresRenommes++;
      }
    }

    return NextResponse.json({
      ok: true,
      mode: "appliqué",
      groupesFusionnes: planifie.length,
      fournisseursSupprimes,
      maitresRenommes,
      collectionsFusionnees,
      collectionsDeplacees,
      commandesReetiquetees,
    });
  } catch (e) {
    return NextResponse.json(
      { ok: false, error: (e as Error).message },
      { status: 500 }
    );
  }
}
