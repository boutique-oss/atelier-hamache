// Migration additive : table operateurs. Idempotent. npx tsx scripts/apply-operateurs.ts
import "dotenv/config";
import { neon } from "@neondatabase/serverless";

async function main() {
  const sql = neon(process.env.DATABASE_URL_UNPOOLED ?? process.env.DATABASE_URL!);
  await sql`
    CREATE TABLE IF NOT EXISTS operateurs (
      id         BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
      nom        TEXT NOT NULL,
      actif      BOOLEAN NOT NULL DEFAULT TRUE,
      created_at TIMESTAMPTZ DEFAULT now(),
      CONSTRAINT operateurs_nom_key UNIQUE (nom)
    )
  `;
  console.log("✅ table operateurs prête");
  const c = (await sql`SELECT count(*)::int n FROM operateurs`) as { n: number }[];
  console.log("   lignes:", c[0].n);
}

main().catch((e) => {
  console.error("❌", e);
  process.exit(1);
});
