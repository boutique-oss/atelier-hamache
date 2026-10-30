// Applique la migration additive « type_realisation + nombre » sur la table
// heures (Neon). Idempotent : ADD COLUMN IF NOT EXISTS. Lancer : npx tsx scripts/apply-heures-migration.ts
import { config } from "dotenv";
import { neon } from "@neondatabase/serverless";

// Next.js lit .env.local automatiquement, mais un script tsx non — on le charge.
config({ path: ".env.local" });
config();

async function main() {
  if (!process.env.DATABASE_URL) {
    console.error("❌ DATABASE_URL manquant");
    process.exit(1);
  }
  const sql = neon(process.env.DATABASE_URL);

  await sql`ALTER TABLE "heures" ADD COLUMN IF NOT EXISTS "type_realisation" text`;
  await sql`ALTER TABLE "heures" ADD COLUMN IF NOT EXISTS "nombre" real DEFAULT 1`;

  const cols = (await sql`
    SELECT column_name, data_type
    FROM information_schema.columns
    WHERE table_name = 'heures' AND column_name IN ('type_realisation', 'nombre')
    ORDER BY column_name
  `) as { column_name: string; data_type: string }[];

  console.log("✅ Migration appliquée. Colonnes présentes :");
  for (const c of cols) console.log(`   - ${c.column_name} (${c.data_type})`);
  if (cols.length < 2) {
    console.error("⚠️  Colonnes manquantes — vérifier manuellement.");
    process.exit(1);
  }
}

main().catch((err) => {
  console.error("❌ Échec migration :", err);
  process.exit(1);
});
