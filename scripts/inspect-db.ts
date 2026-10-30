// Inspection lecture seule du schéma RÉEL déployé sur Neon : `npx tsx scripts/inspect-db.ts`
import "dotenv/config";
import { neon } from "@neondatabase/serverless";

async function main() {
  const sql = neon(process.env.DATABASE_URL!);

  const tables = (await sql`
    SELECT table_name FROM information_schema.tables
    WHERE table_schema = 'public' ORDER BY table_name
  `) as { table_name: string }[];

  for (const { table_name } of tables) {
    const cols = (await sql`
      SELECT column_name, data_type, is_nullable, column_default
      FROM information_schema.columns
      WHERE table_schema = 'public' AND table_name = ${table_name}
      ORDER BY ordinal_position
    `) as {
      column_name: string;
      data_type: string;
      is_nullable: string;
      column_default: string | null;
    }[];

    const countRows = (await sql(
      `SELECT count(*)::int AS n FROM "${table_name}"`
    )) as { n: number }[];

    console.log(`\n━━━ ${table_name}  (${countRows[0].n} lignes) ━━━`);
    for (const c of cols) {
      const nn = c.is_nullable === "NO" ? " NOT NULL" : "";
      const def = c.column_default ? ` default ${c.column_default}` : "";
      console.log(`   ${c.column_name} : ${c.data_type}${nn}${def}`);
    }
  }
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
