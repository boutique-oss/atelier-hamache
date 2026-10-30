// Rattachement FLOU des lignes encore orphelines (dossier_id NULL).
// Tolère fautes d'orthographe (Levenshtein <=2) et noms partiels (inclusion >=4).
// APERÇU par défaut. Écriture : npx tsx scripts/link-fuzzy.ts --apply
import "dotenv/config";
import { neon } from "@neondatabase/serverless";

const APPLY = process.argv.includes("--apply");

const norm = (s: string) =>
  (s || "")
    .toLowerCase()
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/[^a-z0-9]/g, "");

function lev(a: string, b: string): number {
  const m = a.length,
    n = b.length;
  const dp = Array.from({ length: m + 1 }, (_, i) => [i, ...Array(n).fill(0)]);
  for (let j = 0; j <= n; j++) dp[0][j] = j;
  for (let i = 1; i <= m; i++)
    for (let j = 1; j <= n; j++)
      dp[i][j] = Math.min(
        dp[i - 1][j] + 1,
        dp[i][j - 1] + 1,
        dp[i - 1][j - 1] + (a[i - 1] === b[j - 1] ? 0 : 1)
      );
  return dp[m][n];
}

type Dos = { id: number; key: string };

async function main() {
  const sql = neon(process.env.DATABASE_URL!);
  const dosRows = (await sql`SELECT id, nom_dossier, client_nom FROM dossiers`) as any[];
  const dict: Dos[] = [];
  dosRows.forEach((d) => {
    const k1 = norm(d.nom_dossier);
    if (k1.length >= 3) dict.push({ id: Number(d.id), key: k1 });
    const k2 = norm(d.client_nom || "");
    if (k2.length >= 3) dict.push({ id: Number(d.id), key: k2 });
  });

  // Renvoie un id de dossier unique pour un nom, sinon null (+ raison)
  function fuzzy(name: string): { id: number; reason: string } | null {
    const n = norm(name);
    if (n.length < 4) return null;
    const hits = new Map<number, string>(); // id -> raison (meilleure)
    let bestDist = 99;
    for (const d of dict) {
      const dist = lev(n, d.key);
      const inclus =
        (n.includes(d.key) || d.key.includes(n)) &&
        Math.min(n.length, d.key.length) >= 4;
      if (dist <= 2) {
        if (dist < bestDist) {
          bestDist = dist;
          hits.clear();
        }
        if (dist === bestDist) hits.set(d.id, `~${dist}`);
      } else if (inclus && bestDist > 2) {
        hits.set(d.id, "inclus");
      }
    }
    if (hits.size === 1) {
      const [[id, reason]] = [...hits];
      return { id, reason };
    }
    return null; // 0 ou ambigu
  }

  async function run(
    table: string,
    rows: { id: number; client: string | null }[]
  ) {
    const props: { id: number; dossierId: number; line: string }[] = [];
    const stillNone: string[] = [];
    for (const r of rows) {
      const f = r.client ? fuzzy(r.client) : null;
      if (f) props.push({ id: r.id, dossierId: f.id, line: `${r.client} -> dossier ${f.id} (${f.reason})` });
      else if (r.client) stillNone.push(r.client);
    }
    console.log(`\n━━━ ${table} : ${props.length} proposés (flou) ━━━`);
    props.forEach((p) => console.log("   " + p.line));
    if (stillNone.length)
      console.log(
        "   reste sans match : " +
          [...new Set(stillNone)].slice(0, 20).join(" | ")
      );
    if (APPLY) {
      for (const p of props)
        await sql(`UPDATE ${table} SET dossier_id = $1 WHERE id = $2`, [
          p.dossierId,
          p.id,
        ]);
      if (props.length) console.log(`   ✅ ${props.length} rattachés.`);
    }
  }

  const cmds = (await sql`SELECT id, client FROM commandes WHERE dossier_id IS NULL`) as any[];
  await run("commandes", cmds.map((c) => ({ id: Number(c.id), client: c.client })));

  const rid = (await sql`SELECT id, client FROM interventions_rideaux WHERE dossier_id IS NULL`) as any[];
  await run("interventions_rideaux", rid.map((r) => ({ id: Number(r.id), client: r.client })));

  const fic = (await sql`SELECT id, contenu_json FROM fiches_atelier WHERE dossier_id IS NULL`) as any[];
  await run(
    "fiches_atelier",
    fic.map((f) => {
      let client: string | null = null;
      try {
        client = JSON.parse(f.contenu_json)?.client_nom ?? null;
      } catch {}
      return { id: Number(f.id), client };
    })
  );

  if (!APPLY) console.log("\n(Aperçu — rien écrit. --apply pour rattacher.)");
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
