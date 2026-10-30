// Migration additive ciblée : lier commandes -> dossiers.
// Idempotent, non destructif. Lancer : npx tsx scripts/apply-commandes-dossier.ts
import "dotenv/config";
import { neon } from "@neondatabase/serverless";

async function main() {
  // DDL : on utilise la connexion non-poolée si dispo
  const sql = neon(process.env.DATABASE_URL_UNPOOLED ?? process.env.DATABASE_URL!);

  // 1) Colonne nullable (IF NOT EXISTS => rejouable sans erreur)
  await sql`ALTER TABLE commandes ADD COLUMN IF NOT EXISTS dossier_id BIGINT`;
  console.log("✅ colonne commandes.dossier_id présente");

  // 2) Clé étrangère (ajoutée seulement si absente)
  await sql`
    DO $$
    BEGIN
      IF NOT EXISTS (
        SELECT 1 FROM pg_constraint WHERE conname = 'commandes_dossier_id_fkey'
      ) THEN
        ALTER TABLE commandes
          ADD CONSTRAINT commandes_dossier_id_fkey
          FOREIGN KEY (dossier_id) REFERENCES dossiers(id) ON DELETE SET NULL;
      END IF;
    END $$;
  `;
  console.log("✅ FK commandes_dossier_id_fkey présente");

  // 3) Index sur la FK (utile pour les jointures dossier -> commandes)
  await sql`CREATE INDEX IF NOT EXISTS idx_commandes_dossier ON commandes(dossier_id)`;
  console.log("✅ index idx_commandes_dossier présent");

  // Vérif
  const cols = (await sql`
    SELECT column_name FROM information_schema.columns
    WHERE table_schema='public' AND table_name='commandes' AND column_name='dossier_id'
  `) as { column_name: string }[];
  console.log(
    cols.length
      ? "\n🎉 commandes est maintenant liable aux dossiers."
      : "\n❌ colonne introuvable après migration"
  );
}

main().catch((e) => {
  console.error("❌", e);
  process.exit(1);
});
