// Migration additive planning. Idempotent. npx tsx scripts/apply-planning.ts
import "dotenv/config";
import { neon } from "@neondatabase/serverless";

async function main() {
  const sql = neon(process.env.DATABASE_URL_UNPOOLED ?? process.env.DATABASE_URL!);

  // Date de devis sur le dossier
  await sql`ALTER TABLE dossiers ADD COLUMN IF NOT EXISTS date_devis DATE`;
  // Opérateur affecté (file d'attente)
  await sql`ALTER TABLE dossiers ADD COLUMN IF NOT EXISTS operateur_id BIGINT`;
  await sql`
    DO $$ BEGIN
      IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname='dossiers_operateur_id_fkey') THEN
        ALTER TABLE dossiers ADD CONSTRAINT dossiers_operateur_id_fkey
          FOREIGN KEY (operateur_id) REFERENCES operateurs(id) ON DELETE SET NULL;
      END IF;
    END $$;
  `;
  await sql`CREATE INDEX IF NOT EXISTS idx_dossiers_operateur ON dossiers(operateur_id)`;

  // Capacité hebdo de l'opérateur (heures/semaine)
  await sql`ALTER TABLE operateurs ADD COLUMN IF NOT EXISTS heures_semaine REAL NOT NULL DEFAULT 35`;

  console.log("✅ migration planning OK");
  const c = (await sql`
    SELECT column_name FROM information_schema.columns
    WHERE table_name='dossiers' AND column_name IN ('date_devis','operateur_id')
  `) as { column_name: string }[];
  console.log("   colonnes dossiers:", c.map((x) => x.column_name).join(", "));
}

main().catch((e) => { console.error("❌", e); process.exit(1); });
