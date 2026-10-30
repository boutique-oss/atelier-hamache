// Rattache commandes / interventions_rideaux / fiches_atelier aux dossiers,
// par nom client normalisé. APERÇU À BLANC par défaut.
//   Aperçu : npx tsx scripts/link-data.ts
//   Écrire : npx tsx scripts/link-data.ts --apply
import "dotenv/config";
import { neon } from "@neondatabase/serverless";

const APPLY = process.argv.includes("--apply");

const norm = (s: string) =>
  (s || "")
    .toLowerCase()
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/[^a-z0-9]/g, "");

type Row = Record<string, any>;

async function main() {
  const sql = neon(process.env.DATABASE_URL!);

  // Index nom normalisé -> liste d'ids de dossiers
  const dos = (await sql`SELECT id, nom_dossier, client_nom FROM dossiers`) as Row[];
  const idx = new Map<string, number[]>();
  const add = (name: string, id: number) => {
    const k = norm(name);
    if (k.length < 3) return;
    if (!idx.has(k)) idx.set(k, []);
    const a = idx.get(k)!;
    if (!a.includes(id)) a.push(id);
  };
  dos.forEach((d) => {
    add(d.nom_dossier, Number(d.id));
    if (d.client_nom) add(d.client_nom, Number(d.id));
  });

  const match = (name: string): { ids: number[] } => ({
    ids: idx.get(norm(name)) || [],
  });

  // Une « entité » à rattacher : id de ligne + nom client + table
  async function linkTable(
    table: string,
    rows: { id: number; client: string | null }[]
  ) {
    let matched = 0,
      ambiguous = 0,
      unmatched = 0;
    const toUpdate: { id: number; dossierId: number }[] = [];
    const unmatchedNames: string[] = [];
    const ambiguousNames: string[] = [];
    for (const r of rows) {
      const m = match(r.client || "");
      if (m.ids.length === 1) {
        matched++;
        toUpdate.push({ id: r.id, dossierId: m.ids[0] });
      } else if (m.ids.length > 1) {
        ambiguous++;
        ambiguousNames.push(`${r.client} -> dossiers ${m.ids.join(",")}`);
      } else {
        unmatched++;
        if (r.client) unmatchedNames.push(r.client);
      }
    }

    console.log(`\n━━━ ${table} (${rows.length}) ━━━`);
    console.log(`  rattachables : ${matched}`);
    console.log(`  ambigus (plusieurs dossiers) : ${ambiguous}`);
    console.log(`  sans correspondance : ${unmatched}`);
    if (ambiguousNames.length)
      console.log(
        "  · ambigus : " + ambiguousNames.slice(0, 12).join(" | ")
      );
    if (unmatchedNames.length)
      console.log(
        "  · non trouvés : " +
          [...new Set(unmatchedNames)].slice(0, 20).join(" | ")
      );

    if (APPLY && toUpdate.length) {
      for (const u of toUpdate) {
        await sql(`UPDATE ${table} SET dossier_id = $1 WHERE id = $2`, [
          u.dossierId,
          u.id,
        ]);
      }
      console.log(`  ✅ ${toUpdate.length} lignes rattachées.`);
    }
    return matched;
  }

  // commandes : client en colonne
  const cmds = (await sql`SELECT id, client FROM commandes WHERE dossier_id IS NULL`) as Row[];
  await linkTable(
    "commandes",
    cmds.map((c) => ({ id: Number(c.id), client: c.client }))
  );

  // rideaux : client en colonne
  const rid = (await sql`SELECT id, client FROM interventions_rideaux WHERE dossier_id IS NULL`) as Row[];
  await linkTable(
    "interventions_rideaux",
    rid.map((r) => ({ id: Number(r.id), client: r.client }))
  );

  // fiches_atelier : client_nom dans contenu_json
  const fic = (await sql`SELECT id, contenu_json FROM fiches_atelier WHERE dossier_id IS NULL`) as Row[];
  await linkTable(
    "fiches_atelier",
    fic.map((f) => {
      let client: string | null = null;
      try {
        client = JSON.parse(f.contenu_json)?.client_nom ?? null;
      } catch {
        /* json invalide -> non rattaché */
      }
      return { id: Number(f.id), client };
    })
  );

  if (!APPLY) {
    console.log(
      "\n(Aperçu uniquement — rien écrit. Relancer avec --apply pour rattacher.)"
    );
  }
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
