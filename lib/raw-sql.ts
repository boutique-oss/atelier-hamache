// Client SQL brut (tagged template) pour les requêtes simples hors Drizzle.
import { neon } from "@neondatabase/serverless";

if (!process.env.DATABASE_URL) {
  throw new Error("DATABASE_URL manquant — voir .env.example");
}

export const sql = neon(process.env.DATABASE_URL);
