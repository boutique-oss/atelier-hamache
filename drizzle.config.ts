import "dotenv/config";
import { defineConfig } from "drizzle-kit";

// Config drizzle-kit : génère/pousse les migrations vers Neon depuis db/schema.ts
export default defineConfig({
  schema: "./db/schema.ts",
  out: "./drizzle",
  dialect: "postgresql",
  dbCredentials: {
    // DDL/migrations : on préfère la connexion non-poolée (plus fiable que pgbouncer)
    url: process.env.DATABASE_URL_UNPOOLED ?? process.env.DATABASE_URL!,
  },
  verbose: true,
  strict: true,
});
