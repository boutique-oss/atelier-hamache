// Croise les cartes Trello (noms exportés) avec les dossiers existants. Lecture seule.
import "dotenv/config";
import { neon } from "@neondatabase/serverless";
import * as fs from "fs";

const file = process.env.TEMP + "/trello_card_names.json";
const cards: { name: string; closed: boolean; list: string }[] = JSON.parse(
  fs.readFileSync(file, "utf8")
);

const norm = (s: string) =>
  (s || "")
    .toLowerCase()
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/[^a-z0-9]/g, "");

async function main() {
  const sql = neon(process.env.DATABASE_URL!);
  const dos = (await sql`SELECT nom_dossier, client_nom FROM dossiers`) as {
    nom_dossier: string;
    client_nom: string | null;
  }[];

  const dset = new Set<string>();
  dos.forEach((d) => {
    dset.add(norm(d.nom_dossier));
    if (d.client_nom) dset.add(norm(d.client_nom));
  });
  const dosTokens = dos.map((d) => norm(d.nom_dossier)).filter((x) => x.length >= 4);

  let exact = 0,
    partial = 0,
    none = 0;
  const newOpen: string[] = [];
  cards.forEach((c) => {
    const n = norm(c.name);
    if (dset.has(n)) return exact++, undefined;
    if (dosTokens.some((t) => n.includes(t) || t.includes(n)))
      return partial++, undefined;
    none++;
    if (!c.closed) newOpen.push(`${c.list} | ${c.name}`);
  });

  console.log("Cartes totales:", cards.length);
  console.log("  match exact avec un dossier :", exact);
  console.log("  match partiel :", partial);
  console.log("  sans correspondance :", none);
  console.log(`\nCartes OUVERTES sans dossier : ${newOpen.length}`);
  const perList: Record<string, number> = {};
  newOpen.forEach((x) => {
    const list = x.split(" | ")[0];
    perList[list] = (perList[list] || 0) + 1;
  });
  console.log("Répartition par liste :");
  Object.entries(perList)
    .sort((a, b) => b[1] - a[1])
    .forEach(([k, v]) => console.log(`  ${String(v).padStart(3)}  ${k}`));
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
