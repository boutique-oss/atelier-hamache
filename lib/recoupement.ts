// Recoupement des fichiers d'un dossier en fiches de travail : le(s) devis
// EBP (ouvrages, tissus, heures, confection) + la prise de cotes rideaux
// saisie sur tablette. UNE fiche par MÉTIER (rideaux, tapisserie, pose…) :
// un dossier mixte rideaux + fauteuil donne deux fiches, chacune affectée à
// son opérateur. Les cotes sont recopiées telles quelles (pas de calcul).
// Quand le devis et les cotes ne disent pas la même chose (tête, doublure,
// panneaux), c'est signalé dans « À vérifier » au lieu d'être tranché.
// Fichier sans dépendance serveur : partagé action ↔ formulaire.
import type { DevisLu, OuvrageLu, TissuLu } from "@/lib/devis-pdf";
import type { PieceCotes } from "@/lib/prise-cotes";

export type SourceLue = { nom: string; ok: boolean; detail: string };

export type LigneARealiser = { realisation: string; quantite: string; detail: string };

export type FicheProposee = {
  metier: string;
  ficheType: string; // type de fiche (clé de SCHEMAS)
  realisation: string;
  quantite: string;
  heures: string;
  operateurId: string; // "" = pas encore affectée
  references: string;
  typeTete: string; // rideaux
  doublure: string; // rideaux
  aRealiser: LigneARealiser[];
  tissus: TissuLu[];
  cotes: PieceCotes[]; // rideaux
  etapes: string[];
  contenu: Record<string, string>; // champs de fiche (1 seul ouvrage)
};

export type Recoupement = {
  sources: SourceLue[];
  fiches: FicheProposee[];
  aVerifier: string[];
};

const num = (s: string) => Number(String(s).replace(",", ".")) || 0;
const fr = (n: number) => String(Math.round(n * 100) / 100).replace(".", ",");

// Doublure du devis ramenée au vocabulaire de la feuille de cotes.
function doublureDevis(d: string): string {
  if (/obscur|occult/i.test(d)) return "Occultant";
  if (/simple|satin/i.test(d)) return "Satinette";
  if (/thermique/i.test(d)) return "Thermique";
  return "";
}

const ORDRE_METIERS = ["Rideaux", "Tapisserie", "Atelier", "Autre"];

function ficheDuMetier(metier: string, ouvrages: OuvrageLu[], references: string): FicheProposee {
  const realisations = [...new Set(ouvrages.map((o) => o.realisation))];
  const seul = ouvrages.length === 1 ? ouvrages[0] : null;
  const types = [...new Set(ouvrages.map((o) => o.ficheType))];

  // Tissus : union (sans doublon réf + coloris).
  const vus = new Set<string>();
  const tissus: TissuLu[] = [];
  for (const t of ouvrages.flatMap((o) => o.tissus)) {
    const cle = `${t.ref}|${t.coloris}`.toLowerCase();
    if (vus.has(cle)) continue;
    vus.add(cle);
    tissus.push(t);
  }

  // Étapes : celles de l'ouvrage ; plusieurs ouvrages → préfixées par l'ouvrage.
  const etapes = seul
    ? seul.etapes
    : ouvrages.flatMap((o) => o.etapes.map((e) => `${o.realisation.toUpperCase()} — ${e}`));

  // Champs de fiche (mesures…) seulement s'il n'y a qu'un ouvrage.
  const contenu = seul
    ? Object.fromEntries(
        Object.entries(seul.contenu).filter(([k, v]) => k !== "observations" && k !== "description" && String(v).trim())
      )
    : {};

  return {
    metier,
    ficheType: types.length === 1 ? types[0] : metier === "Rideaux" ? "Rideaux" : metier === "Tapisserie" ? "Tapisserie" : "Autre",
    realisation: realisations.length === 1 ? realisations[0] : realisations.join(" + "),
    quantite: realisations.length === 1 ? fr(ouvrages.reduce((s, o) => s + (num(o.quantite) || 1), 0)) : "",
    heures: (() => {
      const h = ouvrages.reduce((s, o) => s + num(o.heures), 0);
      return h ? fr(h) : "";
    })(),
    operateurId: "",
    references,
    typeTete: "",
    doublure: "",
    aRealiser: ouvrages.map((o) => ({
      realisation: o.realisation,
      quantite: o.quantite,
      detail: o.texte.replace(/\s+/g, " ").slice(0, 140),
    })),
    tissus,
    cotes: [],
    etapes,
    contenu,
  };
}

export function recouper(
  devis: { nom: string; lu: DevisLu }[],
  cotes: PieceCotes[],
  sources: SourceLue[]
): Recoupement {
  const references = [...new Set(devis.map((d) => d.lu.numero).filter(Boolean))].join(", ");
  const ouvrages = devis.flatMap((d) => d.lu.ouvrages.filter((o) => o.probable));
  const parMetier = new Map<string, OuvrageLu[]>();
  for (const o of ouvrages) parMetier.set(o.metier, [...(parMetier.get(o.metier) ?? []), o]);
  // Une prise de cotes sans ouvrage rideaux reconnu donne quand même la fiche.
  if (cotes.length && !parMetier.has("Rideaux")) parMetier.set("Rideaux", []);

  const fiches = [...parMetier.entries()]
    .sort((a, b) => ORDRE_METIERS.indexOf(a[0]) - ORDRE_METIERS.indexOf(b[0]))
    .map(([metier, liste]) => ficheDuMetier(metier, liste, references));

  const aVerifier: string[] = [];
  if (!devis.length) aVerifier.push("Aucun devis lu : tissus, heures et confection à compléter.");
  if (devis.length && !ouvrages.length) aVerifier.push("Aucun ouvrage reconnu dans le(s) devis.");

  // Fiche rideaux : cotes + tête / doublure recoupées.
  const rid = fiches.find((f) => f.metier === "Rideaux");
  if (rid) {
    const rideaux = parMetier.get("Rideaux") ?? [];
    rid.cotes = cotes;
    if (!rideaux.length) rid.realisation = "Rideaux";
    const teteDevis = rideaux.map((o) => o.contenu.type_tete).find(Boolean) ?? "";
    const doubDevis = doublureDevis(rideaux.map((o) => o.contenu.doublure ?? "").find((x) => x && x !== "Non") ?? "");
    const tetesCotes = [...new Set(cotes.map((c) => c.typeTete.trim()).filter(Boolean))];
    const doubCotes = [...new Set(cotes.map((c) => c.doublure).filter(Boolean))];
    // Les cotes (prises chez le client) priment ; sinon le devis.
    rid.typeTete = tetesCotes.join(" / ") || teteDevis;
    rid.doublure = doubCotes.join(" / ") || doubDevis;
    if (!cotes.length) aVerifier.push("Rideaux : pas de prise de cotes saisie pour ce dossier.");
    const motTete = teteDevis.split(" ")[0]?.toLowerCase() ?? "";
    if (teteDevis && tetesCotes.length && !tetesCotes.some((t) => t.toLowerCase().includes(motTete))) {
      aVerifier.push(`Rideaux — tête : devis « ${teteDevis} », cotes « ${tetesCotes.join(" / ")} ».`);
    }
    if (doubDevis && doubCotes.length && !doubCotes.includes(doubDevis as PieceCotes["doublure"])) {
      aVerifier.push(`Rideaux — doublure : devis « ${doubDevis} », cotes « ${doubCotes.join(" / ")} ».`);
    }
    const panneauxDevis = rideaux.reduce((s, o) => s + num(o.contenu.nb_panneaux ?? ""), 0);
    const panneauxCotes = cotes.reduce(
      (s, c) => s + (c.uniquePaire === "Paire" ? 2 : c.uniquePaire === "Unique" ? 1 : 0),
      0
    );
    if (panneauxDevis && panneauxCotes && panneauxDevis !== panneauxCotes) {
      aVerifier.push(`Rideaux — panneaux : ${panneauxDevis} au devis, ${panneauxCotes} d'après les cotes.`);
    }
    const sansCote = cotes.filter((c) => !c.longueurTringle || !c.hauteurTringleSol);
    if (sansCote.length) aVerifier.push(`Rideaux : ${sansCote.length} pièce(s) sans longueur de tringle ou hauteur.`);
    if (!rid.etapes.length) {
      rid.etapes = ["COUPE", "ASSEMBLAGE", ...(rid.doublure ? ["DOUBLURE"] : []), "TÊTES", "OURLETS / PLOMBS", "REPASSAGE"];
    }
  }
  for (const f of fiches) {
    if (!f.heures && f.aRealiser.length) aVerifier.push(`${f.metier} : heures prévues à renseigner.`);
  }

  return { sources, fiches, aVerifier };
}
