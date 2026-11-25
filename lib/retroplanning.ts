// Rétroplanning atelier : calcul À REBOURS depuis l'échéance de chaque dossier
// (pose / livraison), et charge cumulée par opérateur.
//
// Module PUR (aucune dépendance serveur) : utilisé par la page (proposition
// initiale) ET par le navigateur (charge recalculée en direct pendant qu'on
// déplace ou étire une étape sur le Gantt).
//
// Principe :
//   PO  Pose / livraison      = échéance (date de livraison ou début chantier)
//   AT  Confection atelier    = heures restantes réparties À REBOURS sur la
//                               capacité libre de l'opérateur, finit la veille
//                               de la pose (au plus tard possible)
//   RM  Réception matière     = la veille du début de l'atelier
//   CM  Commande matière      = DELAI_MATIERE jours ouvrés avant l'atelier
//   DV  Devis signé           = 2 jours ouvrés avant la commande
//   PC  Prise de cote         = date saisie sur le dossier, sinon 3 jours
//                               ouvrés avant le devis
// Une étape non faite dont la fin est passée est « en retard ».

import { feriesFR } from "@/lib/feries";

export const DELAI_MATIERE = 10; // jours ouvrés entre commande et début atelier

// Avancement implicite d'un statut de dossier (lib/dossiers.ts) :
// 1 = devis signé (cote + devis faits), 2 = en atelier (+ matière commandée et
// reçue), 3 = prêt à poser (+ confection faite).
const RANG_STATUT: Record<string, number> = {
  "Devis signé / Validé": 1,
  "En atelier": 2,
  "Prêt à poser": 3,
};

export const CODES_ETAPE = ["PC", "DV", "CM", "RM", "AT", "PO", "AU"] as const;
export type CodeEtape = (typeof CODES_ETAPE)[number];

export const ETAPES: Record<CodeEtape, string> = {
  PC: "Prise de cote",
  DV: "Devis signé",
  CM: "Commande matière",
  RM: "Réception matière",
  AT: "Confection atelier",
  PO: "Pose / livraison",
  AU: "Autre",
};

// Couleur de chaque type d'intervention (fond de barre + texte lisible).
// Les clés reprennent TYPES_INTERVENTION (lib/dossiers.ts).
export const COULEURS_INTERVENTION: Record<string, { fond: string; texte: string }> = {
  Tapisserie: { fond: "#B7793F", texte: "#FFFFFF" }, // ocre
  Rideaux: { fond: "#3E6E9E", texte: "#FFFFFF" }, // bleu
  Atelier: { fond: "#5B7F5B", texte: "#FFFFFF" }, // sauge
  Mixte: { fond: "#7A5C9A", texte: "#FFFFFF" }, // prune
  Autre: { fond: "#6B6B6B", texte: "#FFFFFF" }, // gris
};
export const couleurIntervention = (type: string | null | undefined) =>
  COULEURS_INTERVENTION[type ?? ""] ?? COULEURS_INTERVENTION.Autre;
// Classe CSS de la barre (voir app/(main)/planning/retroplanning.css).
export const classeIntervention = (type: string | null | undefined) =>
  `ri-${(COULEURS_INTERVENTION[type ?? ""] ? type! : "Autre").toLowerCase()}`;

export type Etape = {
  id: string; // texte stable : « d12-AT » pour une étape proposée, uuid sinon
  dossierId: number;
  code: CodeEtape;
  libelle: string;
  commentaire: string; // note libre (widget d'étape)
  operateurId: number | null;
  debut: string; // AAAA-MM-JJ
  fin: string; // AAAA-MM-JJ (inclus)
  heures: number;
  fait: boolean;
  ordre: number;
  propose: boolean; // calculée, pas encore enregistrée
};

export type DossierRetro = {
  id: number;
  nom: string;
  client: string;
  type: string; // type d'intervention
  statut: string;
  operateurId: number | null;
  echeance: string | null;
  finChantier: string | null;
  priseDeCote: string | null;
  heuresReste: number;
  etapeDevis: boolean;
  etapeCmde: boolean;
  etapeAtelier: boolean;
  etapeRealise: boolean;
  commandes: { total: number; commandees: number; recues: number };
};

export type OperateurRetro = { id: number; nom: string; heuresSemaine: number };
// Absence d'un opérateur (congé validé) ; operateur = null → fermeture atelier.
export type Absence = { operateur: string | null; debut: string; fin: string };

// ── Dates (AAAA-MM-JJ, UTC) ──────────────────────────────────────────────
export const estIso = (s: string | null | undefined): s is string =>
  !!s && /^\d{4}-\d{2}-\d{2}$/.test(s);
export function plusJours(iso: string, n: number): string {
  const [y, m, j] = iso.split("-").map(Number);
  return new Date(Date.UTC(y, m - 1, j + n)).toISOString().slice(0, 10);
}
const jourSemaine = (iso: string) => {
  const [y, m, j] = iso.split("-").map(Number);
  return new Date(Date.UTC(y, m - 1, j)).getUTCDay();
};
export const lundiDe = (iso: string) => plusJours(iso, -((jourSemaine(iso) + 6) % 7));
export const premierDuMois = (iso: string) => `${iso.slice(0, 7)}-01`;
export function dernierDuMois(iso: string): string {
  const [y, m] = iso.split("-").map(Number);
  return new Date(Date.UTC(y, m, 0)).toISOString().slice(0, 10);
}

const cacheFeries = new Map<number, Map<string, string>>();
export function estFerie(iso: string): boolean {
  const an = Number(iso.slice(0, 4));
  if (!cacheFeries.has(an)) cacheFeries.set(an, feriesFR(an));
  return cacheFeries.get(an)!.has(iso);
}
export const estOuvre = (iso: string) => {
  const k = jourSemaine(iso);
  return k !== 0 && k !== 6 && !estFerie(iso);
};
// Recule de n jours ouvrés (n ≥ 1). n = 0 → dernier jour ouvré ≤ iso.
export function reculerOuvres(iso: string, n: number): string {
  let x = iso;
  while (!estOuvre(x)) x = plusJours(x, -1);
  for (let i = 0; i < n; i++) {
    do x = plusJours(x, -1);
    while (!estOuvre(x));
  }
  return x;
}
export function joursEntre(debut: string, fin: string): string[] {
  const out: string[] = [];
  for (let x = debut; x <= fin; x = plusJours(x, 1)) out.push(x);
  return out;
}

// ── Capacité ─────────────────────────────────────────────────────────────
export class Calendrier {
  private ops: Map<number, OperateurRetro>;
  constructor(ops: OperateurRetro[], private absences: Absence[]) {
    this.ops = new Map(ops.map((o) => [o.id, o]));
  }
  operateur(id: number | null) {
    return id == null ? undefined : this.ops.get(id);
  }
  absent(opId: number | null, iso: string): boolean {
    const nom = this.operateur(opId)?.nom;
    return this.absences.some(
      (a) => (a.operateur == null || a.operateur === nom) && a.debut <= iso && a.fin >= iso
    );
  }
  // Heures disponibles d'un opérateur un jour donné (0 si week-end, férié,
  // congé ou fermeture). Sans opérateur : journée standard de 7 h.
  capacite(opId: number | null, iso: string): number {
    if (!estOuvre(iso) || this.absent(opId, iso)) return 0;
    if (opId == null) return 7;
    const op = this.ops.get(opId);
    return op ? (op.heuresSemaine || 0) / 5 : 7;
  }
}

// Répartition des heures d'une étape sur ses jours travaillés (au prorata de
// la capacité de l'opérateur ; à défaut, sur les jours ouvrés).
export function repartir(e: Etape, cal: Calendrier): Map<string, number> {
  const out = new Map<string, number>();
  if (!(e.heures > 0) || e.fin < e.debut) return out;
  const jours = joursEntre(e.debut, e.fin);
  let poids = jours.map((j) => cal.capacite(e.operateurId, j));
  if (poids.every((p) => p === 0)) poids = jours.map((j) => (estOuvre(j) ? 1 : 0));
  if (poids.every((p) => p === 0)) poids = jours.map(() => 1);
  const total = poids.reduce((s, p) => s + p, 0);
  jours.forEach((j, i) => {
    if (poids[i] > 0) out.set(j, (e.heures * poids[i]) / total);
  });
  return out;
}

// Charge planifiée : opérateur → jour → heures.
// Même logique que le calcul à rebours : pour chaque opérateur, les étapes
// sont servies de la fin la plus lointaine à la plus proche, et chacune remplit
// au plus tard la capacité ENCORE LIBRE de ses jours. Deux barres qui se
// chevauchent ne comptent donc pas deux fois la même journée. Ce qui ne tient
// pas dans la barre est réparti dessus en surcharge (affichée en rouge).
export type Charge = Map<number, Map<string, number>>;
export function calculerCharge(etapes: Etape[], cal: Calendrier): Charge {
  const charge: Charge = new Map();
  const avecHeures = etapes
    .filter((e) => e.operateurId != null && e.heures > 0 && e.fin >= e.debut)
    .sort((a, b) => (a.fin < b.fin ? 1 : a.fin > b.fin ? -1 : a.debut < b.debut ? 1 : -1));
  for (const e of avecHeures) {
    const op = e.operateurId!;
    const parJour = charge.get(op) ?? new Map<string, number>();
    charge.set(op, parJour);
    let reste = e.heures;
    const jours = joursEntre(e.debut, e.fin);
    for (let i = jours.length - 1; i >= 0 && reste > 0.001; i--) {
      const j = jours[i];
      const libre = cal.capacite(op, j) - (parJour.get(j) ?? 0);
      if (libre > 0.001) {
        const h = Math.min(libre, reste);
        parJour.set(j, (parJour.get(j) ?? 0) + h);
        reste -= h;
      }
    }
    if (reste > 0.001) {
      for (const [j, h] of Array.from(repartir({ ...e, heures: reste }, cal)))
        parJour.set(j, (parJour.get(j) ?? 0) + h);
    }
  }
  return charge;
}

export const enRetard = (e: Etape, today: string) => !e.fait && e.fin < today;

// ── Proposition à rebours ────────────────────────────────────────────────
// Calcule les étapes des dossiers qui n'en ont pas encore d'enregistrées.
// La capacité déjà prise par les étapes enregistrées est déduite d'abord ;
// les dossiers sont ensuite servis de l'échéance la plus lointaine à la plus
// proche, chacun au plus tard possible avant sa pose (ALAP).
export function proposerEtapes(
  dossiers: DossierRetro[],
  enregistrees: Etape[],
  cal: Calendrier,
  today: string
): { etapes: Etape[]; nonTenus: Map<number, number> } {
  const dejaPlanifies = new Set(enregistrees.map((e) => e.dossierId));
  const charge = calculerCharge(enregistrees, cal);
  const pris = (op: number | null, j: string) =>
    op == null ? 0 : charge.get(op)?.get(j) ?? 0;
  const prendre = (op: number | null, j: string, h: number) => {
    if (op == null) return;
    const m = charge.get(op) ?? new Map<string, number>();
    m.set(j, (m.get(j) ?? 0) + h);
    charge.set(op, m);
  };

  const aPlanifier = dossiers
    .filter((d) => !dejaPlanifies.has(d.id) && estIso(d.echeance))
    .sort((a, b) => (b.echeance! < a.echeance! ? -1 : b.echeance! > a.echeance! ? 1 : b.id - a.id));

  const etapes: Etape[] = [];
  const nonTenus = new Map<number, number>(); // dossier → heures qui ne tiennent pas
  for (const d of aPlanifier) {
    const ech = d.echeance!;
    const op = d.operateurId;
    const mk = (code: CodeEtape, debut: string, fin: string, heures: number, fait: boolean, ordre: number): Etape => ({
      id: `d${d.id}-${code}`,
      dossierId: d.id,
      code,
      libelle: ETAPES[code],
      commentaire: "",
      operateurId: code === "AT" ? op : null,
      debut,
      fin: fin < debut ? debut : fin,
      heures,
      fait,
      ordre,
      propose: true,
    });

    // Le statut du dossier dit quelles étapes sont forcément franchies
    // (évite de signaler en retard une prise de cote d'un dossier en atelier).
    const rang = RANG_STATUT[d.statut] ?? 0;

    // Confection : au plus tard, à rebours depuis la veille de la pose.
    const atFait = d.etapeAtelier || d.etapeRealise || rang >= 3;
    let reste = atFait ? 0 : Math.max(0, d.heuresReste);
    const heuresAT = reste;
    let jour = reculerOuvres(ech, 1);
    let debutAT = jour;
    let finAT: string | null = null;
    // Garde-fou : 2 ans de recherche maximum.
    for (let garde = 0; reste > 0.001 && garde < 520; garde++) {
      if (jour < today) break;
      const libre = cal.capacite(op, jour) - pris(op, jour);
      if (libre > 0.001) {
        const h = Math.min(libre, reste);
        prendre(op, jour, h);
        reste -= h;
        finAT ??= jour;
        debutAT = jour;
      }
      if (reste > 0.001) jour = reculerOuvres(jour, 1);
    }
    if (reste > 0.001) nonTenus.set(d.id, reste);
    finAT ??= debutAT;

    const finPO = estIso(d.finChantier) && d.finChantier > ech ? d.finChantier : ech;
    const rm = reculerOuvres(debutAT, 1);
    const cm = reculerOuvres(debutAT, DELAI_MATIERE);
    const dv = reculerOuvres(cm, 2);
    const pc = estIso(d.priseDeCote) ? d.priseDeCote : reculerOuvres(dv, 3);
    const c = d.commandes;

    etapes.push(
      mk("PC", pc, pc, 0, rang >= 1 || (estIso(d.priseDeCote) && d.priseDeCote <= today), 0),
      mk("DV", dv, dv, 0, rang >= 1 || d.etapeDevis, 1),
      mk("CM", cm, cm, 0, rang >= 2 || d.etapeCmde || (c.total > 0 && c.commandees >= c.total), 2),
      mk("RM", rm, rm, 0, rang >= 2 || (c.total > 0 && c.recues >= c.total), 3),
      mk("AT", debutAT, finAT, heuresAT, atFait, 4),
      mk("PO", ech, finPO, 0, d.etapeRealise || d.statut === "Clos", 5)
    );
  }
  return { etapes, nonTenus };
}

// ── Synthèse de charge par opérateur sur une période + cumul du mois ─────
export type LigneCharge = {
  op: OperateurRetro;
  colonnes: { cle: string; label: string; heures: number; capacite: number }[];
  periode: { heures: number; capacite: number };
  cumulMois: { heures: number; capacite: number }; // 1er du mois → fin de période
  mois: { heures: number; capacite: number }; // mois entier
};

export type Vue = "jour" | "semaine" | "mois";

// Bornes de la période affichée pour une vue et une date de référence.
export function periode(vue: Vue, ref: string): { debut: string; fin: string } {
  if (vue === "jour") return { debut: ref, fin: ref };
  if (vue === "semaine") {
    const l = lundiDe(ref);
    return { debut: l, fin: plusJours(l, 6) };
  }
  return { debut: premierDuMois(ref), fin: dernierDuMois(ref) };
}

// Colonnes de la synthèse : jours (vue jour/semaine) ou semaines (vue mois).
function colonnes(vue: Vue, debut: string, fin: string) {
  const fmt = (iso: string) => `${iso.slice(8)}/${iso.slice(5, 7)}`;
  if (vue === "mois") {
    const out: { cle: string; label: string; debut: string; fin: string }[] = [];
    for (let l = lundiDe(debut); l <= fin; l = plusJours(l, 7)) {
      const d = l < debut ? debut : l;
      const f = plusJours(l, 6) > fin ? fin : plusJours(l, 6);
      out.push({ cle: l, label: `${fmt(d)}–${fmt(f)}`, debut: d, fin: f });
    }
    return out;
  }
  const noms = ["dim.", "lun.", "mar.", "mer.", "jeu.", "ven.", "sam."];
  // Vue semaine : du lundi au vendredi (le week-end n'a pas de capacité).
  return joursEntre(debut, fin)
    .filter((j) => vue === "jour" || (jourSemaine(j) !== 0 && jourSemaine(j) !== 6))
    .map((j) => ({ cle: j, label: `${noms[jourSemaine(j)]} ${fmt(j)}`, debut: j, fin: j }));
}

export function syntheseCharge(
  etapes: Etape[],
  ops: OperateurRetro[],
  cal: Calendrier,
  vue: Vue,
  ref: string
): LigneCharge[] {
  const charge = calculerCharge(etapes, cal);
  const { debut, fin } = periode(vue, ref);
  const debutMois = premierDuMois(ref);
  const finMois = dernierDuMois(ref);
  const cols = colonnes(vue, debut, fin);

  const somme = (op: OperateurRetro, a: string, b: string) => {
    let heures = 0;
    let capacite = 0;
    const parJour = charge.get(op.id);
    for (const j of joursEntre(a, b)) {
      heures += parJour?.get(j) ?? 0;
      capacite += cal.capacite(op.id, j);
    }
    return { heures, capacite };
  };

  return ops.map((op) => ({
    op,
    colonnes: cols.map((c) => ({ cle: c.cle, label: c.label, ...somme(op, c.debut, c.fin) })),
    periode: somme(op, debut, fin),
    cumulMois: somme(op, debutMois, fin < finMois ? fin : finMois),
    mois: somme(op, debutMois, finMois),
  }));
}
