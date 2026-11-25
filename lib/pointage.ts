// Calculs du pointage, partagés entre l'écran (/pointage) et la feuille
// imprimable (/documents/feuille-pointage) : une seule source de vérité, pour
// que le papier affiche exactement les mêmes chiffres que l'écran.
import { and, asc, eq, gte, lte } from "drizzle-orm";

import { db } from "@/db";
import { conges, operateurs, pointage } from "@/db/schema";
import { sql } from "@/lib/raw-sql";

export const CONGES_PAR_AN = 25; // 5 semaines
export const JOURS_FR = ["Lun", "Mar", "Mer", "Jeu", "Ven"];

export const nf = (n: number) =>
  n.toLocaleString("fr-FR", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
export const nfs = (n: number) =>
  (n > 0.0001 ? "+" : n < -0.0001 ? "−" : "") + nf(Math.abs(n));

// Lundi de la semaine contenant `d` (UTC ; dates stockées en AAAA-MM-JJ).
export function lundiDe(d: Date): string {
  const u = new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate()));
  u.setUTCDate(u.getUTCDate() - ((u.getUTCDay() + 6) % 7));
  return u.toISOString().slice(0, 10);
}
export function ajouterJours(iso: string, n: number): string {
  const [y, m, j] = iso.split("-").map(Number);
  return new Date(Date.UTC(y, m - 1, j + n)).toISOString().slice(0, 10);
}
export function numeroSemaine(iso: string): number {
  const [y, m, j] = iso.split("-").map(Number);
  const d = new Date(Date.UTC(y, m - 1, j));
  d.setUTCDate(d.getUTCDate() + 4 - ((d.getUTCDay() + 6) % 7));
  const debut = new Date(Date.UTC(d.getUTCFullYear(), 0, 1));
  return Math.ceil(((d.getTime() - debut.getTime()) / 86400000 + 1) / 7);
}
export const jourMois = (iso: string) => `${iso.slice(8)}/${iso.slice(5, 7)}`;

// Jours fériés : module sans dépendance serveur, partagé avec le rétroplanning.
import { feriesFR } from "@/lib/feries";
export { feriesFR };

// Normalise le lundi demandé (paramètre d'URL) ou prend la semaine en cours.
export function lundiValide(v?: string): string {
  return /^\d{4}-\d{2}-\d{2}$/.test(v || "") ? (v as string) : lundiDe(new Date());
}

// Normalise le mois demandé (« AAAA-MM ») ou prend le mois en cours.
export function moisValide(v?: string): string {
  return /^\d{4}-\d{2}$/.test(v || "") ? (v as string) : new Date().toISOString().slice(0, 7);
}
// Mois adjacent : moisAdjacent("2026-09", -1) → "2026-08".
export function moisAdjacent(mois: string, n: number): string {
  const [y, m] = mois.split("-").map(Number);
  return new Date(Date.UTC(y, m - 1 + n, 1)).toISOString().slice(0, 7);
}
// Dernier jour du mois (« AAAA-MM-JJ »).
export function dernierJourMois(mois: string): string {
  const [y, m] = mois.split("-").map(Number);
  return new Date(Date.UTC(y, m, 0)).toISOString().slice(0, 10);
}
// "2026-09" → "septembre 2026".
const MOIS_FR = [
  "janvier", "février", "mars", "avril", "mai", "juin",
  "juillet", "août", "septembre", "octobre", "novembre", "décembre",
];
export function nomMois(mois: string): string {
  const [y, m] = mois.split("-");
  return `${MOIS_FR[Number(m) - 1] ?? m} ${y}`;
}

export type Jour = { date: string; label: string; num: string };
export type Cellule = { heures: number; type: string } | null;
export type LignePointage = {
  nom: string;
  contrat: number;
  dirigeant: boolean;
  cellules: Cellule[];
};

export type SemainePointage = {
  jours: Jour[];
  ops: { id: number; nom: string; estDirigeant: boolean }[];
  salaries: LignePointage[];
  dirigeants: LignePointage[];
  compteur: { nom: string; solde: number; semaines: number }[];
  conges: { nom: string; pris: number; restants: number }[];
  dirCumul: { nom: string; semaine: number; annee: number }[];
};

// Vrai si la base est prête (table `pointage` + colonne `est_dirigeant`).
export async function schemaPret(): Promise<boolean> {
  try {
    await db.select({ id: operateurs.id, d: operateurs.estDirigeant }).from(operateurs).limit(1);
    await db.select({ id: pointage.id }).from(pointage).limit(1);
    return true;
  } catch {
    return false;
  }
}

// ── Congés (demandes début → fin) ─────────────────────────────────────────
export type Conge = {
  id: number;
  operateur: string;
  dateDebut: string;
  dateFin: string;
  type: string;
  statut: string;
  commentaire: string;
  heuresStock: number; // heures retirées du stock d'heures à la validation
};

// Charge toutes les demandes de congés (tolérant : renvoie [] si la table
// n'existe pas encore, avant lancement de la migration). Triées par date.
export async function chargerConges(): Promise<Conge[]> {
  try {
    const rows = await db.select().from(conges).orderBy(asc(conges.dateDebut));
    // Colonne ajoutée par migration : lue à part, sans bloquer si absente.
    let heures = new Map<number, number>();
    try {
      const h = await sql`SELECT id, heures_stock FROM conges WHERE heures_stock > 0`;
      heures = new Map(h.map((r) => [Number(r.id), Number(r.heures_stock)]));
    } catch {
      // migration pas encore lancée
    }
    return rows.map((c) => ({
      id: Number(c.id),
      operateur: c.operateur,
      dateDebut: c.dateDebut,
      dateFin: c.dateFin,
      type: c.type ?? "Congé payé",
      statut: c.statut ?? "Demandé",
      commentaire: c.commentaire ?? "",
      heuresStock: heures.get(Number(c.id)) ?? 0,
    }));
  } catch {
    return [];
  }
}

export async function chargerSemaine(lundi: string): Promise<SemainePointage> {
  const vendredi = ajouterJours(lundi, 4);
  const jours: Jour[] = JOURS_FR.map((label, i) => {
    const date = ajouterJours(lundi, i);
    return { date, label, num: date.slice(8) };
  });

  const opsBruts = await db
    .select({
      id: operateurs.id,
      nom: operateurs.nom,
      heuresSemaine: operateurs.heuresSemaine,
      estDirigeant: operateurs.estDirigeant,
    })
    .from(operateurs)
    .where(eq(operateurs.actif, true))
    .orderBy(asc(operateurs.nom));

  const semaine = await db
    .select()
    .from(pointage)
    .where(and(gte(pointage.date, lundi), lte(pointage.date, vendredi)));

  const annee = lundi.slice(0, 4);
  const toutAn = await db
    .select()
    .from(pointage)
    .where(and(gte(pointage.date, `${annee}-01-01`), lte(pointage.date, `${annee}-12-31`)));

  const cle = (nom: string, date: string) => `${nom}|${date}`;
  const parCle = new Map(semaine.map((p) => [cle(p.operateur, p.date), p]));

  const construire = (dirigeant: boolean): LignePointage[] =>
    opsBruts
      .filter((o) => Boolean(o.estDirigeant) === dirigeant)
      .map((o) => ({
        nom: o.nom,
        contrat: Number(o.heuresSemaine),
        dirigeant,
        cellules: jours.map((j) => {
          const p = parCle.get(cle(o.nom, j.date));
          return p ? ({ heures: Number(p.heures ?? 0), type: p.type ?? "Travail" } as Cellule) : null;
        }),
      }));

  const salaries = construire(false);
  const dirigeants = construire(true);

  // Compteur : heures pointées − (contrat hebdo × semaines réellement pointées).
  const compteur = salaries.map((l) => {
    const lignes = toutAn.filter((p) => p.operateur === l.nom);
    const semaines = new Set(lignes.map((p) => lundiDe(new Date(p.date + "T00:00:00Z"))));
    const total = lignes.reduce((s, p) => s + Number(p.heures ?? 0), 0);
    return { nom: l.nom, solde: total - l.contrat * semaines.size, semaines: semaines.size };
  });

  const conges = salaries.map((l) => {
    const pris = toutAn.filter((p) => p.operateur === l.nom && p.type === "Congé").length;
    return { nom: l.nom, pris, restants: CONGES_PAR_AN - pris };
  });

  const dirCumul = dirigeants.map((l) => ({
    nom: l.nom,
    semaine: l.cellules.reduce((s, c) => s + (c ? c.heures : 0), 0),
    annee: toutAn
      .filter((p) => p.operateur === l.nom)
      .reduce((s, p) => s + Number(p.heures ?? 0), 0),
  }));

  return {
    jours,
    ops: opsBruts.map((o) => ({ id: o.id, nom: o.nom, estDirigeant: Boolean(o.estDirigeant) })),
    salaries,
    dirigeants,
    compteur,
    conges,
    dirCumul,
  };
}

// ── Mois de pointage + fiche navette (comptabilité) ───────────────────────
// Saisie et calculs strictement du 1er au dernier jour du mois, week-ends et
// fériés compris. Les HEURES SUP. se calculent PAR SEMAINE (lundi → dimanche),
// chaque semaine étant rattachée au mois de son LUNDI (usage du cabinet) :
//   heures faites + h/jour par férié ou congé (lun→ven) − 1 h de pause café
//   − horaire hebdo du contrat = heures sup. (jamais négatives).
// Chaque semaine d'heures sup. est soit PAYÉE (navette), soit STOCKÉE : elle
// alimente alors le stock d'heures (× COEF_STOCK) où puisent les récups.
// Les salariés en « horaire fixe » (Raphaël) sont exclus des heures sup.
//
// Les nouveautés (horaire fixe, motif d'absence, choix payer/stocker, stock)
// vivent dans des colonnes/tables lues en SQL brut, avec repli si la migration
// n'a pas encore été lancée : l'écran reste utilisable, sans ces options.
export const PAUSE_HEBDO = 1; // h retirée chaque semaine (pause café)
export const COEF_STOCK = 1.25; // 1 h sup. stockée = 1 h 15 de repos
export const MOTIFS_ABSENCE = [
  "Rendez-vous",
  "Enfant malade",
  "Événement familial",
  "Sans solde",
  "Retard",
  "Autre",
] as const;
export const SANS_SOLDE = "Sans solde";

export type JourMois = {
  date: string; // AAAA-MM-JJ
  num: number; // 1…31
  lettre: string; // L M M J V S D
  weekend: boolean;
  ferie: string | null; // libellé du jour férié
};
export type CelluleMois = {
  heures: number; // heures travaillées ce jour
  type: string; // Travail · Congé · Férié · Récup · Repos · Absence (· Maladie historique)
  motif: string; // motif d'absence
  hAbs: number; // heures d'absence (type Absence)
} | null;
export type SemaineHS = {
  lundi: string;
  dimanche: string;
  num: number; // n° de semaine ISO
  fait: number; // heures travaillées
  assim: number; // fériés / congés comptés au contrat
  retenu: number; // fait + assim − pause
  hs: number; // heures sup.
  mode: "payer" | "stocker";
  enCours: boolean; // semaine pas encore terminée (dimanche à venir) : chiffre provisoire
};
export type Plage = { du: string; au: string; motif: string; heures: number };
export type MouvementStock = {
  id: number | null; // id si ajustement manuel (supprimable)
  date: string;
  libelle: string;
  heures: number; // signé
};
export type LigneMois = {
  nom: string;
  contrat: number; // h / semaine
  hJour: number;
  horaireMensuel: number; // contrat × 52 / 12 (151,67 / 86,67)
  fixe: boolean;
  cellules: CelluleMois[]; // une par jour du mois
  total: number; // heures réalisées du mois
  semaines: SemaineHS[]; // semaines rattachées au mois
  hsPayees: number;
  hsStockees: number;
  stockDebut: number;
  mouvements: MouvementStock[]; // mouvements du mois
  stockFin: number;
  congesPlages: Plage[];
  sansSolde: Plage[];
  absences: Plage[];
  congesAn: number; // jours de congé posés sur l'année civile
};
export type MoisPointage = {
  mois: string;
  jours: JourMois[];
  salaries: LigneMois[];
  operateurs: string[]; // tous les opérateurs actifs (calendrier des congés)
  extrasPrets: boolean; // migration « navette » lancée
};

const LETTRES = ["D", "L", "M", "M", "J", "V", "S"];
// Date du jour à Poitiers (AAAA-MM-JJ), indépendante du fuseau du serveur.
const aujourdhui = () =>
  new Intl.DateTimeFormat("en-CA", { timeZone: "Europe/Paris" }).format(new Date());
const arrondi = (n: number) => Math.round(n * 100) / 100;
const dow = (iso: string) => new Date(iso + "T00:00:00Z").getUTCDay(); // 0 = dim

type LigneBrute = {
  operateur: string;
  date: string;
  heures: number;
  type: string;
  motif: string;
  hAbs: number;
};

// Lit les nouveautés en SQL brut ; null si la migration n'est pas passée.
async function lireExtras(finPlage: string) {
  try {
    const [fixes, choix, ajust, lignes] = await Promise.all([
      sql`SELECT nom FROM operateurs WHERE horaire_fixe = true`,
      sql`SELECT operateur, lundi, mode FROM hs_semaines`,
      sql`SELECT id, operateur, date, heures, libelle FROM stock_heures WHERE date <= ${finPlage}`,
      sql`SELECT operateur, date, heures, type, motif, heures_absence FROM pointage WHERE date <= ${finPlage}`,
    ]);
    return {
      fixes: new Set(fixes.map((r) => String(r.nom))),
      choix: new Map(choix.map((r) => [`${r.operateur}|${r.lundi}`, String(r.mode)])),
      ajust: ajust.map((r) => ({
        id: Number(r.id),
        operateur: String(r.operateur),
        date: String(r.date),
        heures: Number(r.heures ?? 0),
        libelle: String(r.libelle ?? ""),
      })),
      lignes: lignes.map(
        (r): LigneBrute => ({
          operateur: String(r.operateur),
          date: String(r.date),
          heures: Number(r.heures ?? 0),
          type: String(r.type ?? "Travail"),
          motif: String(r.motif ?? ""),
          hAbs: Number(r.heures_absence ?? 0),
        })
      ),
    };
  } catch {
    return null;
  }
}

// Demandes VALIDÉES qui retirent des heures du stock (null si colonne absente).
async function lireDemandesStock(finPlage: string) {
  try {
    const r = await sql`SELECT operateur, date_debut, date_fin, type, heures_stock FROM conges
      WHERE statut = 'Validé' AND heures_stock > 0 AND date_debut <= ${finPlage}`;
    return r.map((x) => ({
      operateur: String(x.operateur),
      du: String(x.date_debut),
      au: String(x.date_fin),
      type: String(x.type ?? ""),
      heures: Number(x.heures_stock),
    }));
  } catch {
    return [];
  }
}

// Heures sup. d'une semaine (lundi → dimanche).
function calculSemaine(
  lundi: string,
  parDate: Map<string, LigneBrute>,
  contrat: number,
  estFerie: (d: string) => boolean
) {
  const hJour = contrat / 5;
  let fait = 0;
  let assim = 0;
  for (let i = 0; i < 7; i++) {
    const d = ajouterJours(lundi, i);
    const p = parDate.get(d);
    const ouvre = i < 5;
    if (p) {
      if (p.type === "Travail" || p.type === "Absence") fait += p.heures;
      else if ((p.type === "Congé" || p.type === "Férié") && ouvre) assim += hJour;
    } else if (ouvre && estFerie(d)) {
      assim += hJour;
    }
  }
  const retenu = fait + assim - PAUSE_HEBDO;
  return {
    fait: arrondi(fait),
    assim: arrondi(assim),
    retenu: arrondi(retenu),
    hs: arrondi(Math.max(0, retenu - contrat)),
  };
}

// Regroupe des jours (triés) en plages : jours consécutifs (week-ends sautés)
// de même motif, en journée entière. Une absence partielle reste seule.
function plages(
  jours: { date: string; motif: string; heures: number; partiel: boolean }[]
): Plage[] {
  const out: (Plage & { partiel: boolean })[] = [];
  for (const j of jours) {
    const der = out[out.length - 1];
    if (der && !der.partiel && !j.partiel && der.motif === j.motif) {
      let d = ajouterJours(der.au, 1);
      while (d < j.date && dow(d) % 6 === 0) d = ajouterJours(d, 1);
      if (d === j.date) {
        der.au = j.date;
        der.heures += j.heures;
        continue;
      }
    }
    out.push({ du: j.date, au: j.date, motif: j.motif, heures: j.heures, partiel: j.partiel });
  }
  return out.map(({ partiel: _p, ...p }) => p);
}

export async function chargerMois(mois: string): Promise<MoisPointage> {
  const debut = `${mois}-01`;
  const fin = dernierJourMois(mois);
  const cacheFeries = new Map<number, Map<string, string>>();
  const ferie = (d: string) => {
    const an = Number(d.slice(0, 4));
    if (!cacheFeries.has(an)) cacheFeries.set(an, feriesFR(an));
    return cacheFeries.get(an)!.get(d) ?? null;
  };

  const jours: JourMois[] = [];
  for (let d = debut; d <= fin; d = ajouterJours(d, 1)) {
    const w = dow(d);
    jours.push({ date: d, num: Number(d.slice(8)), lettre: LETTRES[w], weekend: w === 0 || w === 6, ferie: ferie(d) });
  }

  // Semaines rattachées au mois : celles dont le LUNDI tombe dans le mois.
  const lundis: string[] = [];
  for (let l = lundiDe(new Date(debut + "T00:00:00Z")); l <= fin; l = ajouterJours(l, 7)) {
    if (l >= debut) lundis.push(l);
  }
  // Dernier jour à charger : dimanche de la dernière semaine (peut déborder).
  const finPlage = lundis.length ? ajouterJours(lundis[lundis.length - 1], 6) : fin;

  const actifs = await db
    .select({
      nom: operateurs.nom,
      heuresSemaine: operateurs.heuresSemaine,
      estDirigeant: operateurs.estDirigeant,
    })
    .from(operateurs)
    .where(eq(operateurs.actif, true))
    .orderBy(asc(operateurs.nom));
  const ops = actifs.filter((o) => !o.estDirigeant);

  const extras = await lireExtras(finPlage);
  const demandesStock = extras ? await lireDemandesStock(finPlage) : [];
  // Sans migration : lignes via Drizzle (sans motif), pas d'options.
  const lignes: LigneBrute[] = extras
    ? extras.lignes
    : (
        await db.select().from(pointage).where(lte(pointage.date, finPlage))
      ).map((p) => ({
        operateur: p.operateur,
        date: p.date,
        heures: Number(p.heures ?? 0),
        type: p.type ?? "Travail",
        motif: "",
        hAbs: 0,
      }));

  const annee = mois.slice(0, 4);
  const today = aujourdhui();

  const salaries = ops.map((o): LigneMois => {
    const contrat = Number(o.heuresSemaine);
    const hJour = contrat / 5;
    const fixe = extras?.fixes.has(o.nom) ?? false;
    const siens = lignes.filter((p) => p.operateur === o.nom);
    const parDate = new Map(siens.map((p) => [p.date, p]));

    // Cellules + total du mois (Absence partielle = heures faites ce jour).
    const cellules: CelluleMois[] = jours.map((j) => {
      const p = parDate.get(j.date);
      return p ? { heures: p.heures, type: p.type, motif: p.motif, hAbs: p.hAbs } : null;
    });
    const total = cellules.reduce(
      (s, c) => s + (c && (c.type === "Travail" || c.type === "Absence") ? c.heures : 0),
      0
    );

    // Heures sup. des semaines du mois.
    const mode = (l: string) =>
      extras?.choix.get(`${o.nom}|${l}`) === "stocker" ? "stocker" : "payer";
    const semaines: SemaineHS[] = lundis.map((l) => {
      const c = calculSemaine(l, parDate, contrat, (d) => !!ferie(d));
      return {
        lundi: l,
        dimanche: ajouterJours(l, 6),
        num: numeroSemaine(l),
        ...c,
        hs: fixe ? 0 : c.hs,
        mode: mode(l),
        enCours: ajouterJours(l, 6) >= today,
      };
    });
    const hsPayees = semaines.filter((s) => s.mode === "payer").reduce((a, s) => a + s.hs, 0);
    const hsStockees = semaines.filter((s) => s.mode === "stocker").reduce((a, s) => a + s.hs, 0);

    // Stock d'heures : tous les mouvements jusqu'à la fin du mois.
    const tous: MouvementStock[] = [];
    if (extras && !fixe) {
      for (const [cle, m] of Array.from(extras.choix.entries())) {
        const [nom, l] = cle.split("|");
        if (nom !== o.nom || m !== "stocker" || l > fin) continue;
        const { hs } = calculSemaine(l, parDate, contrat, (d) => !!ferie(d));
        if (hs > 0)
          tous.push({
            id: null,
            date: l,
            libelle: `S${numeroSemaine(l)} : ${nf(hs)} h sup. stockées × ${nf(COEF_STOCK)}`,
            heures: arrondi(hs * COEF_STOCK),
          });
      }
      // Demandes validées avec heures : retirées du stock (date de début).
      const demandes = demandesStock.filter((d) => d.operateur === o.nom && d.du <= fin);
      for (const d of demandes)
        tous.push({
          id: null,
          date: d.du,
          libelle: `Demande ${d.type.toLowerCase()} ${jourMois(d.du)}${d.au !== d.du ? `→${jourMois(d.au)}` : ""}`,
          heures: -d.heures,
        });
      // Récup posée au pointage : une journée, sauf si une demande validée
      // couvre déjà ce jour (pas de double retrait).
      const couvert = (date: string) => demandes.some((d) => d.du <= date && date <= d.au);
      for (const p of siens) {
        if (p.type === "Récup" && p.date <= fin && !couvert(p.date))
          tous.push({ id: null, date: p.date, libelle: "Récup (journée)", heures: -hJour });
      }
      for (const a of extras.ajust) {
        if (a.operateur === o.nom && a.date <= fin)
          tous.push({ id: a.id, date: a.date, libelle: a.libelle || "Ajustement", heures: a.heures });
      }
    }
    tous.sort((a, b) => a.date.localeCompare(b.date));
    // Une semaine stockée compte dans le mois de son lundi.
    const stockDebut = arrondi(tous.filter((m) => m.date < debut).reduce((s, m) => s + m.heures, 0));
    const mouvements = tous.filter((m) => m.date >= debut);
    const stockFin = arrondi(stockDebut + mouvements.reduce((s, m) => s + m.heures, 0));

    // Congés, sans solde, absences du mois (pour la navette).
    const duMois = siens.filter((p) => p.date >= debut && p.date <= fin).sort((a, b) => a.date.localeCompare(b.date));
    const congesPlages = plages(
      duMois.filter((p) => p.type === "Congé").map((p) => ({ date: p.date, motif: "", heures: hJour, partiel: false }))
    );
    const abs = duMois
      .filter((p) => p.type === "Absence")
      .map((p) => ({ date: p.date, motif: p.motif || "Autre", heures: p.hAbs, partiel: p.heures > 0 }));
    const sansSolde = plages(abs.filter((a) => a.motif === SANS_SOLDE));
    const absences = plages(abs.filter((a) => a.motif !== SANS_SOLDE));

    return {
      nom: o.nom,
      contrat,
      hJour,
      horaireMensuel: arrondi((contrat * 52) / 12),
      fixe,
      cellules,
      total: arrondi(total),
      semaines,
      hsPayees: arrondi(hsPayees),
      hsStockees: arrondi(hsStockees),
      stockDebut,
      mouvements,
      stockFin,
      congesPlages,
      sansSolde,
      absences,
      congesAn: siens.filter((p) => p.type === "Congé" && p.date.startsWith(annee)).length,
    };
  });

  return { mois, jours, salaries, operateurs: actifs.map((o) => o.nom), extrasPrets: !!extras };
}
