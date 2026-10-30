// ============================================================
//  Calculateur devis rideaux — logique de calcul PURE
//  Port à l'identique du prototype validé (calculateur-devis-rideaux-reference.html).
//  Aucun accès base ni interface : appelée côté client (affichage en direct)
//  et côté serveur (recalcul des totaux à l'enregistrement).
//  Toutes les longueurs sont en cm.
// ============================================================

export type Tete = {
  id: string;
  nom: string;
  amp: number; // ampleur
  src: string; // origine de l'ampleur
  tm: number; // temps de tête (min/m)
  fo: number; // fourniture (€/m)
};

export type ParamsRideaux = {
  rempli: number;
  ourletBas: number;
  ourletCote: number;
  debordDef: number;
  seuil: number;
  raccordM: "exact" | "simple";
  demiLe: boolean;
  taux: number;
  coef: number;
  lestPrix: number;
  tva: number;
  tPrepa: number;
  tCoupe: number;
  tAssemb: number;
  tOCote: number;
  tOBas: number;
  tDoubl: number;
  tInter: number;
  tLest: number;
  tMitre: number;
  tGalon: number;
  tFinition: number;
  kMain: number;
  kRaccord: number;
  kDelicat: number;
  tetes: Tete[];
};

export type Tombe = "net" | "flottant" | "casse" | "oeillets" | "libre";
export type Doublure = "aucune" | "satinette" | "occultante" | "thermique";

// Une ligne = une fenêtre. Les champs numériques peuvent être "" (vide en saisie).
export type LigneRideau = {
  id: string;
  nom: string;
  qte: number | "";
  panneaux: 1 | 2;
  tringle: number | "";
  debord: number | "";
  hauteur: number | "";
  tombe: Tombe;
  ajust: number | "";
  tete: string;
  ampleur: number | null; // null = valeur de la tête
  voilage: boolean;
  tissu: string;
  laize: number | "";
  raccord: number | "";
  prix: number | "";
  retrait: number | "";
  travers: boolean;
  delicat: boolean;
  nonfeu: boolean;
  doublure: Doublure;
  laizeD: number | "";
  prixD: number | "";
  interdoublure: boolean;
  prixI: number | "";
  lestage: boolean;
  mitres: boolean;
  main: boolean;
  galonMl: number | "";
  galonPrix: number | "";
  pose: number | "";
};

export const TETES_DEF: Tete[] = [
  { id: "plate", nom: "Plate", amp: 1, src: "BAC tapissier", tm: 6, fo: 2.5 },
  { id: "pattes", nom: "Pattes", amp: 1.4, src: "usage courant", tm: 15, fo: 0 },
  { id: "ruflette", nom: "Fronces ruflette", amp: 2, src: "Maison des Rideaux", tm: 5, fo: 2 },
  { id: "oeillets", nom: "Œillets", amp: 2, src: "les deux sources", tm: 12, fo: 9 },
  { id: "wave", nom: "Wave", amp: 2.1, src: "usage courant", tm: 10, fo: 6 },
  { id: "flamands", nom: "Plis flamands", amp: 2.5, src: "Maison des Rideaux", tm: 20, fo: 4 },
  { id: "creux", nom: "Plis creux", amp: 2.5, src: "usage courant", tm: 18, fo: 4 },
];

export const PARAMS_DEF: ParamsRideaux = {
  rempli: 13, ourletBas: 25, ourletCote: 5, debordDef: 10, seuil: 0.15, raccordM: "exact", demiLe: true,
  taux: 45, coef: 1, lestPrix: 3, tva: 20,
  tPrepa: 15, tCoupe: 6, tAssemb: 8, tOCote: 6, tOBas: 8, tDoubl: 10, tInter: 8, tLest: 5, tMitre: 5, tGalon: 6, tFinition: 15,
  kMain: 2.5, kRaccord: 10, kDelicat: 20,
  tetes: TETES_DEF,
};

// Ajustement de hauteur par défaut selon le tombé.
export const AJUST: Record<Tombe, number> = { net: -1, flottant: -3, casse: 4, oeillets: 3, libre: 0 };

export const TOMBES: { v: Tombe; label: string }[] = [
  { v: "net", label: "Net (effleure le sol)" },
  { v: "flottant", label: "Flottant" },
  { v: "casse", label: "Cassé au sol" },
  { v: "oeillets", label: "Œillets (mesure au-dessus de la barre)" },
  { v: "libre", label: "Hauteur finie saisie telle quelle" },
];

export const DOUBLURES: { v: Doublure; label: string }[] = [
  { v: "aucune", label: "Sans doublure" },
  { v: "satinette", label: "Satinette / coton" },
  { v: "occultante", label: "Occultante" },
  { v: "thermique", label: "Thermique" },
];

export function clone<T>(o: T): T {
  return JSON.parse(JSON.stringify(o));
}

export function newLigne(i: number, P: ParamsRideaux): LigneRideau {
  return {
    id: Date.now() + "-" + Math.random().toString(36).slice(2, 6),
    nom: "Fenêtre " + i, qte: 1, panneaux: 2,
    tringle: 180, debord: P.debordDef, hauteur: 225, tombe: "net", ajust: -1,
    tete: "flamands", ampleur: null, voilage: false,
    tissu: "", laize: 138, raccord: 64, prix: 42, retrait: 0, travers: false, delicat: false, nonfeu: false,
    doublure: "satinette", laizeD: 140, prixD: 9, interdoublure: false, prixI: 8,
    lestage: true, mitres: false, main: false, galonMl: 0, galonPrix: 0, pose: 0,
  };
}

// ---------------------------------------------------------------- formats
const NF0 = new Intl.NumberFormat("fr-FR", { maximumFractionDigits: 0 });
const NF1 = new Intl.NumberFormat("fr-FR", { maximumFractionDigits: 1 });
const NF2 = new Intl.NumberFormat("fr-FR", { minimumFractionDigits: 0, maximumFractionDigits: 2 });
const NFM = new Intl.NumberFormat("fr-FR", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
const EUR = new Intl.NumberFormat("fr-FR", { style: "currency", currency: "EUR" });
export const f0 = (n: number) => NF0.format(n);
export const f1 = (n: number) => NF1.format(n);
export const f2 = (n: number) => NF2.format(n);
export const eur = (n: number) => EUR.format(n);
export const m2 = (cm: number) => NFM.format(cm / 100); // cm -> m, 2 décimales
export function fh(h: number) {
  const t = Math.round(h * 60);
  const hh = Math.floor(t / 60), mm = t % 60;
  return hh + " h " + (mm < 10 ? "0" : "") + mm;
}

// ---------------------------------------------------------------- calcul
export function num(v: unknown, d = 0): number {
  const n = typeof v === "number" ? v : parseFloat(String(v ?? "").replace(",", "."));
  return Number.isFinite(n) ? n : d;
}

export function teteOf(P: ParamsRideaux, id: string): Tete {
  return P.tetes.find((t) => t.id === id) ?? P.tetes[0];
}

export type DetailLigne = { k: string; v: number; d: string };

export type Resultat = {
  invalid?: boolean;
  warn: string[];
  amp: number;
  hFinie: number;
  hBase: number;
  hRet: number;
  hCoupe: number;
  lBase: number;
  nOurlets: number;
  lTot: number;
  mode: "travers" | "les";
  ampReelle: number;
  lesBrut: number;
  nLes: number;
  coutures: number;
  metrage: number;
  metrageBrut: number;
  doubl: number;
  inter: number;
  nLesD?: number;
  hD?: number;
  heuresDetail: DetailLigne[];
  sousTotMin: number;
  maj: number;
  majTxt: string[];
  minutes: number;
  heures: number;
  prix: DetailLigne[];
  ht1: number;
  qte: number;
  ht: number;
  tete: Tete;
  pan: 1 | 2;
};

export function calc(L: LigneRideau, P: ParamsRideaux): Resultat {
  const r = { warn: [] as string[] } as Resultat;
  const T = teteOf(P, L.tete);
  const pan: 1 | 2 = num(L.panneaux, 1) === 2 ? 2 : 1;
  const qte = Math.max(1, Math.round(num(L.qte, 1)));
  const tringle = num(L.tringle), debord = num(L.debord), haut = num(L.hauteur);
  const laize = num(L.laize), R = num(L.raccord), retrait = num(L.retrait) / 100;
  r.tete = T; r.pan = pan; r.qte = qte;
  if (tringle <= 0 || haut <= 0 || laize <= 0) { r.invalid = true; return r; }

  const amp = L.ampleur != null && (L.ampleur as unknown) !== "" ? num(L.ampleur, T.amp) : L.voilage ? 2.5 : T.amp;
  r.amp = amp;
  const hFinie = L.tombe === "libre" ? haut : haut + num(L.ajust);
  r.hFinie = hFinie;
  const hBase = hFinie + P.rempli + P.ourletBas;
  const hRet = hBase * (1 + retrait);
  r.hBase = hBase; r.hRet = hRet;
  let hCoupe = hRet;
  if (R > 0) {
    hCoupe = P.raccordM === "exact" ? Math.ceil(hRet / R - 1e-9) * R : hRet + R;
  }
  r.hCoupe = hCoupe;

  const lBase = tringle + 2 * debord;
  const nOurlets = 2 * pan;
  const lTot = lBase * amp + nOurlets * P.ourletCote;
  r.lBase = lBase; r.nOurlets = nOurlets; r.lTot = lTot;

  let metrage: number, nLes = 0, lesBrut = 0, coutures = 0;
  if (L.travers && hCoupe > laize) {
    r.warn.push("La hauteur de coupe (" + f1(hCoupe) + " cm) dépasse la laize (" + f0(laize) + " cm) : coupe en travers impossible, calcul fait en lés.");
  }
  if (L.travers && hCoupe <= laize) {
    r.mode = "travers";
    metrage = lTot;
    r.ampReelle = amp;
  } else {
    r.mode = "les";
    lesBrut = lTot / laize;
    const step = pan === 2 && P.demiLe ? 0.5 : 1;
    const units = lesBrut / step;
    const base = Math.floor(units + 1e-9);
    const reste = (units - base) * step;
    nLes = (reste > P.seuil ? base + 1 : base) * step;
    if (nLes < step) nLes = step;
    if (pan === 2 && !P.demiLe && nLes % 2 === 1) {
      r.warn.push("Nombre de lés impair pour une paire : un lé sera partagé ou les rideaux auront des largeurs différentes.");
    }
    metrage = Math.ceil(nLes) * hCoupe; // un demi-lé se coupe dans un lé entier
    r.ampReelle = (nLes * laize - nOurlets * P.ourletCote) / lBase;
    const lesParPan = nLes / pan;
    coutures = Math.max(0, Math.ceil(lesParPan) - 1) * pan;
    if (nLes < lesBrut - 1e-9) r.warn.push("Arrondi à la baisse : ampleur réelle " + f2(r.ampReelle) + " au lieu de " + f2(amp) + ".");
  }
  r.lesBrut = lesBrut; r.nLes = nLes; r.coutures = coutures;
  r.metrage = Math.ceil(metrage / 10) * 10; // arrondi aux 10 cm
  r.metrageBrut = metrage;

  // doublure
  r.doubl = 0; r.inter = 0;
  if (L.doublure !== "aucune") {
    const lzD = num(L.laizeD, 140) || 140;
    const hD = hFinie + P.rempli + P.ourletBas;
    let nD = Math.ceil(lTot / lzD - P.seuil);
    if (nD < 1) nD = 1;
    r.nLesD = nD; r.hD = hD;
    r.doubl = Math.ceil((nD * hD) / 10) * 10;
    if (L.interdoublure) r.inter = r.doubl;
  }

  // heures (minutes)
  const hm = hFinie / 100, lm = lTot / 100;
  const lignesM: DetailLigne[] = [];
  const add = (k: string, v: number, d: string) => { if (v > 0) lignesM.push({ k, v, d }); };
  const nLesCoupe = r.mode === "les" ? Math.ceil(nLes) : pan;
  const kOurlet = L.main ? P.kMain : 1;
  const galonMl = num(L.galonMl);
  add("Préparation, fiche", P.tPrepa * pan, pan + " pan. × " + P.tPrepa + " min");
  add("Coupe", P.tCoupe * nLesCoupe, nLesCoupe + (r.mode === "les" ? " lé(s)" : " pièce(s)") + " × " + P.tCoupe + " min");
  add("Assemblage des lés", P.tAssemb * coutures, coutures + " couture(s) × " + P.tAssemb + " min");
  add("Ourlets de côté", P.tOCote * 2 * pan * hm * kOurlet, f2(2 * pan * hm) + " m × " + P.tOCote + " min" + (L.main ? " × " + P.kMain + " (main)" : ""));
  add("Ourlet bas", P.tOBas * lm * kOurlet, f2(lm) + " m × " + P.tOBas + " min" + (L.main ? " × " + P.kMain + " (main)" : ""));
  if (L.doublure !== "aucune") add("Montage doublure", P.tDoubl * lm, f2(lm) + " m × " + P.tDoubl + " min");
  if (L.doublure !== "aucune" && L.interdoublure) add("Interdoublure", P.tInter * lm, f2(lm) + " m × " + P.tInter + " min");
  add("Tête — " + T.nom, T.tm * lm, f2(lm) + " m × " + T.tm + " min");
  if (L.lestage) add("Lestage", P.tLest * pan, pan + " pan. × " + P.tLest + " min");
  if (L.mitres) add("Angles mitrés", P.tMitre * 2 * pan, 2 * pan + " angles × " + P.tMitre + " min");
  if (galonMl > 0) add("Pose galon", P.tGalon * galonMl, f2(galonMl) + " m × " + P.tGalon + " min");
  add("Repassage, contrôle", P.tFinition * pan, pan + " pan. × " + P.tFinition + " min");
  const sousTot = lignesM.reduce((s, x) => s + x.v, 0);
  let maj = 0;
  const majTxt: string[] = [];
  if (R > 0 && P.kRaccord > 0) { maj += P.kRaccord; majTxt.push("raccord +" + P.kRaccord + " %"); }
  if (L.delicat && P.kDelicat > 0) { maj += P.kDelicat; majTxt.push("tissu délicat +" + P.kDelicat + " %"); }
  const totMin = sousTot * (1 + maj / 100);
  r.heuresDetail = lignesM; r.sousTotMin = sousTot; r.maj = maj; r.majTxt = majTxt;
  r.minutes = totMin; r.heures = totMin / 60;

  // prix (pour 1 fenêtre)
  const c = P.coef;
  const pTissu = (r.metrage / 100) * num(L.prix) * c;
  const pDoubl = (r.doubl / 100) * num(L.prixD) * c;
  const pInter = (r.inter / 100) * num(L.prixI) * c;
  const pTete = lm * T.fo * c;
  const pLest = L.lestage ? P.lestPrix * pan * c : 0;
  const pGalon = galonMl * num(L.galonPrix) * c;
  const pMO = r.heures * P.taux;
  const pPose = num(L.pose);
  r.prix = [
    { k: "Tissu", v: pTissu, d: f2(r.metrage / 100) + " m × " + f2(num(L.prix)) + " €" + (c !== 1 ? " × " + c : "") },
    { k: "Doublure", v: pDoubl, d: r.doubl ? f2(r.doubl / 100) + " m × " + f2(num(L.prixD)) + " €" : "" },
    { k: "Interdoublure", v: pInter, d: r.inter ? f2(r.inter / 100) + " m × " + f2(num(L.prixI)) + " €" : "" },
    { k: "Fourniture de tête", v: pTete, d: f2(lm) + " m × " + f2(T.fo) + " €" },
    { k: "Lestage", v: pLest, d: L.lestage ? pan + " pan. × " + f2(P.lestPrix) + " €" : "" },
    { k: "Galon", v: pGalon, d: galonMl ? f2(galonMl) + " m × " + f2(num(L.galonPrix)) + " €" : "" },
    { k: "Confection", v: pMO, d: fh(r.heures) + " × " + f0(P.taux) + " €/h" },
    { k: "Pose", v: pPose, d: "" },
  ].filter((x) => x.v > 0);
  const tot = r.prix.reduce((s, x) => s + x.v, 0);
  r.ht1 = tot; r.ht = tot * qte;
  if (L.nonfeu) r.warn.push("Non-feu exigé : vérifier le classement du tissu (M1 / B1) et l'indiquer sur le devis.");
  return r;
}

// Totaux d'un projet (somme des fenêtres).
export type Totaux = { tissu: number; doubl: number; h: number; ht: number; ttc: number; nbFenetres: number };
export function totaux(lignes: LigneRideau[], P: ParamsRideaux): Totaux {
  const T = { tissu: 0, doubl: 0, h: 0, ht: 0, ttc: 0, nbFenetres: 0 };
  for (const L of lignes) {
    const r = calc(L, P);
    if (r.invalid) continue;
    T.tissu += r.metrage * r.qte;
    T.doubl += (r.doubl + r.inter) * r.qte;
    T.h += r.heures * r.qte;
    T.ht += r.ht;
    T.nbFenetres += r.qte;
  }
  T.ttc = T.ht * (1 + P.tva / 100);
  return T;
}

// ---------------------------------------------------------------- validation
// Normalise des données venues de l'extérieur (formulaire, base) : chaque champ
// est ramené au type attendu, les valeurs inconnues sont remplacées par défaut.
const nOrEmpty = (v: unknown): number | "" => {
  if (v === "" || v == null) return "";
  const n = num(v, NaN);
  return Number.isFinite(n) ? n : "";
};
const pick = <T extends string>(v: unknown, allowed: readonly T[], d: T): T =>
  allowed.includes(v as T) ? (v as T) : d;
const txt = (v: unknown, max = 200) => String(v ?? "").slice(0, max);

export function sanitizeLigne(raw: unknown, i: number, P: ParamsRideaux): LigneRideau {
  const d = newLigne(i, P);
  if (!raw || typeof raw !== "object") return d;
  const o = raw as Record<string, unknown>;
  const amp = o.ampleur == null || o.ampleur === "" ? null : num(o.ampleur, NaN);
  return {
    id: txt(o.id || d.id, 60),
    nom: txt(o.nom),
    qte: nOrEmpty(o.qte),
    panneaux: num(o.panneaux, 2) === 1 ? 1 : 2,
    tringle: nOrEmpty(o.tringle),
    debord: nOrEmpty(o.debord),
    hauteur: nOrEmpty(o.hauteur),
    tombe: pick(o.tombe, ["net", "flottant", "casse", "oeillets", "libre"] as const, "net"),
    ajust: nOrEmpty(o.ajust),
    tete: txt(o.tete || d.tete, 40),
    ampleur: amp != null && Number.isFinite(amp) ? amp : null,
    voilage: !!o.voilage,
    tissu: txt(o.tissu),
    laize: nOrEmpty(o.laize),
    raccord: nOrEmpty(o.raccord),
    prix: nOrEmpty(o.prix),
    retrait: nOrEmpty(o.retrait),
    travers: !!o.travers,
    delicat: !!o.delicat,
    nonfeu: !!o.nonfeu,
    doublure: pick(o.doublure, ["aucune", "satinette", "occultante", "thermique"] as const, "aucune"),
    laizeD: nOrEmpty(o.laizeD),
    prixD: nOrEmpty(o.prixD),
    interdoublure: !!o.interdoublure,
    prixI: nOrEmpty(o.prixI),
    lestage: !!o.lestage,
    mitres: !!o.mitres,
    main: !!o.main,
    galonMl: nOrEmpty(o.galonMl),
    galonPrix: nOrEmpty(o.galonPrix),
    pose: nOrEmpty(o.pose),
  };
}

export function sanitizeParams(raw: unknown): ParamsRideaux {
  const P = clone(PARAMS_DEF);
  if (!raw || typeof raw !== "object") return P;
  const o = raw as Record<string, unknown>;
  const numKeys = Object.keys(PARAMS_DEF).filter(
    (k) => typeof (PARAMS_DEF as Record<string, unknown>)[k] === "number"
  ) as (keyof ParamsRideaux)[];
  for (const k of numKeys) {
    if (o[k] != null && o[k] !== "") (P as Record<string, unknown>)[k] = num(o[k], PARAMS_DEF[k] as number);
  }
  P.raccordM = pick(o.raccordM, ["exact", "simple"] as const, "exact");
  if (typeof o.demiLe === "boolean") P.demiLe = o.demiLe;
  if (Array.isArray(o.tetes) && o.tetes.length) {
    P.tetes = o.tetes.slice(0, 30).map((t, i) => {
      const x = (t ?? {}) as Record<string, unknown>;
      const def = TETES_DEF[i] ?? TETES_DEF[0];
      return {
        id: txt(x.id || def.id, 40),
        nom: txt(x.nom || def.nom, 60),
        amp: num(x.amp, def.amp),
        src: txt(x.src, 80),
        tm: num(x.tm, def.tm),
        fo: num(x.fo, def.fo),
      };
    });
  }
  return P;
}
