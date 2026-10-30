// Client Drizzle connecté à Neon (driver serverless, compatible Vercel Edge/Node).
// Schéma = introspection de la base RÉELLE déployée (db/schema.ts + db/relations.ts).
import { neon } from "@neondatabase/serverless";
import { drizzle } from "drizzle-orm/neon-http";
import * as schema from "./schema";
import * as relations from "./relations";

if (!process.env.DATABASE_URL) {
  throw new Error("DATABASE_URL manquant — voir .env.example");
}

const sql = neon(process.env.DATABASE_URL);

// `db` : point d'entrée unique. Tables + relations pour l'API db.query.*
export const db = drizzle(sql, { schema: { ...schema, ...relations } });

export { schema };
