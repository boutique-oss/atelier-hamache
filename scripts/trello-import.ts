// Import Trello -> dossiers. APERÇU À BLANC par défaut (aucune écriture).
//   Aperçu : npx tsx scripts/trello-import.ts
//   Écrire : npx tsx scripts/trello-import.ts --apply
import "dotenv/config";
import { neon } from "@neondatabase/serverless";
import * as fs from "fs";

const TRELLO_FILE =
  process.env.TRELLO_FILE ||
  "C:/Users/Utilisateur/Downloads/3Piky4yi - pipeline.json";
const APPLY = process.argv.includes("--apply");

const norm = (s: string) =>
  (s || "")
    .toLowerCase()
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/[^a-z0-9]/g, "");

// Liste Trello (normalisée) -> statut dossier
function mapStatut(list: string): string {
  const n = norm(list);
  if (n.includes("ventegagn") || n.includes("ventesgagn")) return "Validé";
  if (n.includes("travauxfini")) return "Clos";
  if (n.includes("repartition")) return "En atelier";
  if (n.includes("ficheatelier")) return "En atelier";
  if (n === "sav") return "SAV";
  if (n.includes("negociation")) return "Négociation";
  if (n.includes("relance")) return "Relance";
  if (n.includes("devis")) return "Devis";
  if (n.includes("opportunit")) return "Opportunité";
  if (n.includes("lead")) return "Lead";
  if (n.includes("venteperdu") || n.includes("ventesperdu")) return "Perdu";
  return "Nouveau";
}

// Date de création déduite de l'ObjectId Trello (8 premiers hex = secondes unix)
function trelloDate(id: string): string | null {
  if (!/^[0-9a-f]{8}/.test(id)) return null;
  const secs = parseInt(id.substring(0, 8), 16);
  if (!secs) return null;
  return new Date(secs * 1000).toISOString().slice(0, 10);
}

const BOILERPLATE = "afin de qualifier un lead";

async function main() {
  const board = JSON.parse(fs.readFileSync(TRELLO_FILE, "utf8"));
  const listName: Record<string, string> = Object.fromEntries(
    board.lists.map((l: any) => [l.id, l.name])
  );
  const labelName: Record<string, string> = Object.fromEntries(
    board.labels.map((l: any) => [l.id, l.name || ""])
  );

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
  const dosTokens = dos
    .map((d) => norm(d.nom_dossier))
    .filter((x) => x.length >= 4);

  const create: any[] = [];
  const skipExisting: string[] = [];
  const junk: string[] = [];

  for (const c of board.cards) {
    if (c.closed) continue; // seulement les cartes ouvertes
    const name = (c.name || "").trim();
    const n = norm(name);

    // bruit : carte modèle, nom vide/trop court, placeholder générique
    if (
      n.length < 3 ||
      n.startsWith("commentremplir") ||
      n === "client"
    ) {
      junk.push(`${listName[c.idList]} | ${name || "(vide)"}`);
      continue;
    }
    // doublon déjà en base
    if (dset.has(n) || dosTokens.some((t) => n.includes(t) || t.includes(n))) {
      skipExisting.push(`${listName[c.idList]} | ${name}`);
      continue;
    }

    const labels = (c.idLabels || [])
      .map((i: string) => labelName[i])
      .filter(Boolean);
    let type = "Autre";
    if (labels.some((l: string) => norm(l) === "rideaux")) type = "Rideaux";
    else if (labels.some((l: string) => norm(l) === "atelier")) type = "Atelier";
    const flags = labels.filter((l: string) => norm(l).includes("pasinteressant"))
      .length
      ? ["Pas intéressant"]
      : [];
    const desc = (c.desc || "").trim();
    const commentaires =
      desc && !norm(desc).startsWith(norm(BOILERPLATE)) ? desc : "";

    create.push({
      nom_dossier: name,
      client_nom: name,
      statut: mapStatut(listName[c.idList]),
      type_intervention: type,
      flags: JSON.stringify(flags),
      lien_dossier_externe: c.shortUrl || c.url || "",
      date_ouverture: trelloDate(c.id),
      commentaires,
    });
  }

  // ---- Dédoublonnage interne au Trello (même nom => 1 fiche, statut le plus avancé) ----
  const RANK = [
    "Lead",
    "Opportunité",
    "Devis",
    "Relance",
    "Négociation",
    "Validé",
    "En atelier",
    "Prêt à poser",
    "Clos",
    "SAV",
    "Perdu",
  ];
  const rank = (s: string) => {
    const i = RANK.indexOf(s);
    return i < 0 ? 0 : i;
  };
  const byName = new Map<string, any>();
  let collapsed = 0;
  for (const c of create) {
    const key = norm(c.nom_dossier);
    const prev = byName.get(key);
    if (!prev) {
      byName.set(key, c);
    } else {
      collapsed++;
      // garde le statut le plus avancé
      if (rank(c.statut) > rank(prev.statut)) byName.set(key, c);
    }
  }
  const unique = [...byName.values()];

  // ---- Rapport ----
  console.log(`\n=== APERÇU IMPORT TRELLO -> dossiers ${APPLY ? "(APPLY)" : "(À BLANC)"} ===`);
  console.log(`Cartes candidates : ${create.length} | doublons internes fusionnés : ${collapsed}`);
  console.log(`À CRÉER (uniques) : ${unique.length}`);
  const perStatut: Record<string, number> = {};
  unique.forEach((c) => (perStatut[c.statut] = (perStatut[c.statut] || 0) + 1));
  Object.entries(perStatut)
    .sort((a, b) => b[1] - a[1])
    .forEach(([k, v]) => console.log(`   ${String(v).padStart(3)}  ${k}`));
  console.log(`\nIGNORÉS (déjà en base) : ${skipExisting.length}`);
  console.log(`IGNORÉS (bruit/modèle) : ${junk.length}`);
  junk.forEach((j) => console.log("   · " + j));

  console.log(`\n--- Détail des ${unique.length} dossiers à créer ---`);
  unique.forEach((c) =>
    console.log(
      `   [${c.statut}] ${c.nom_dossier}  (${c.type_intervention}${
        c.date_ouverture ? ", " + c.date_ouverture : ""
      })`
    )
  );

  if (!APPLY) {
    console.log(
      "\n(Aperçu uniquement — rien écrit. Relancer avec --apply pour importer.)"
    );
    return;
  }

  // ---- Écriture (uniquement avec --apply) ----
  let inserted = 0;
  for (const c of unique) {
    await sql`
      INSERT INTO dossiers
        (nom_dossier, client_nom, statut, type_intervention, flags,
         lien_dossier_externe, date_ouverture, commentaires, created_at, updated_at)
      VALUES
        (${c.nom_dossier}, ${c.client_nom}, ${c.statut}, ${c.type_intervention},
         ${c.flags}, ${c.lien_dossier_externe}, ${c.date_ouverture},
         ${c.commentaires}, now(), now())
    `;
    inserted++;
  }
  console.log(`\n✅ ${inserted} dossiers créés.`);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
