// Test de connexion Neon : `npm run db:check`
// Vérifie que DATABASE_URL fonctionne et liste les tables présentes.
import "dotenv/config";
import { neon } from "@neondatabase/serverless";

async function main() {
  if (!process.env.DATABASE_URL) {
    console.error("❌ DATABASE_URL manquant — copier .env.example vers .env");
    process.exit(1);
  }

  const sql = neon(process.env.DATABASE_URL);

  // Ping
  const [{ version }] = (await sql`SELECT version()`) as { version: string }[];
  console.log("✅ Connexion Neon OK");
  console.log("   " + version);

  // Liste des tables du schéma public
  const tables = (await sql`
    SELECT table_name
    FROM information_schema.tables
    WHERE table_schema = 'public'
    ORDER BY table_name
  `) as { table_name: string }[];

  console.log(`\n📋 ${tables.length} table(s) :`);
  for (const t of tables) console.log("   - " + t.table_name);
}

main().catch((err) => {
  console.error("❌ Échec connexion :", err);
  process.exit(1);
});
