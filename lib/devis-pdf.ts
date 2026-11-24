// Lecture d'un devis EBP (PDF « texte ») SANS IA, pour pré-remplir le dossier :
// infos client, lignes Travaux et fiches de travail. Tout est proposé dans un
// formulaire ajustable avant d'être appliqué : les règles devinent, l'atelier
// corrige.
//
// Ce que l'on sait des devis de l'atelier (réponses du 2026-10-21) :
//  - lignes en texte libre (pas de codes articles EBP) ;
//  - des TITRES de pièce (« SALON », « CHAMBRE 1 ») au-dessus des lignes ;
//  - soit une ligne = un ouvrage complet, soit un OUVRAGE suivi de ses
//    composants (tissu, doublure, galon, main-d'œuvre, pose…) à regrouper ;
//  - la main-d'œuvre est chiffrée EN HEURES ;
//  - le tissu peut être fourni par le client (« TFC », « tissu client »).
import { dateDuTexte, lignesDuPdf } from "@/lib/pdf-commande";

export type TissuLu = {
  ref: string;
  coloris: string;
  metrage: string;
  placement: string;
};

export type OuvrageLu = {
  texte: string; // libellé de l'ouvrage (lignes de suite fusionnées)
  composants: string[]; // sous-lignes rattachées (tissu, MO, pose…)
  piece: string; // titre de pièce au-dessus (« Salon »…)
  metier: string; // Tapisserie / Rideaux / Atelier / Autre
  realisation: string;
  quantite: string;
  montant: string;
  heures: string; // heures de main-d'œuvre lues (ouvrage + sous-lignes)
  tissuClient: boolean;
  pose: boolean;
  ficheType: string; // clé de SCHEMAS (lib/fiches-schemas)
  contenu: Record<string, string>; // champs de fiche devinés
  tissus: TissuLu[];
  etapes: string[]; // étapes de travail proposées
  probable: boolean; // ressemble à un ouvrage (pas une ligne isolée)
};

export type DevisLu = {
  numero: string;
  date: string;
  client: { nom: string; adresse: string; telephone: string; email: string };
  telephones: string[];
  emails: string[];
  ouvrages: OuvrageLu[];
  pages: number;
};

const PRIX = /^-?\d{1,3}(?:[ .]\d{3})*,\d{2}$|^-?\d+[.,]\d{2}$/;
const NOMBRE = /^-?\d+(?:[.,]\d+)?$/;
const UNITE_CELLULE = /^(ml|m|m²|m2|h|hr|heures?|u|un|pce|pcs|ens|fft|forfait|paire|pl|plaques?)$/i;
const FIN_TABLEAU =
  /\b(total|sous-total|net à payer|acompte|conditions|validité|bon pour accord|règlement|escompte|signature|d[ée]lai d.ex[ée]cution|en signant)\b|^taux\b/i;
// En-tête du tableau. EBP : « Description | Unité | Qté | P.U. HT | Montant HT | TVA ».
const ENTETE_TABLEAU = /\b(désignation|designation|description|libellé)\b.*\b(qt[ée]|quantit[ée]|prix|montant)\b/i;
const TEL = /(?:\+33\s?|0)[1-9](?:[ .-]?\d{2}){4}/g;
const EMAIL = /[\w.+-]+@[\w-]+(?:\.[\w-]+)+/g;
const CP_VILLE = /\b\d{5}\s+[A-ZÀ-Ÿa-zà-ÿ][\wÀ-ÿ' -]+/;
// Coordonnées de l'atelier (en-tête des devis EBP) : jamais proposées comme
// client.
const ATELIER = /hamache|atelier\s+st[ée]phan|faubourg\s+du\s+pont\s+neuf|site\s+web|siret|iban/i;
const TELS_ATELIER = ["0549468388", "0612533054"];

const nettoyerNombre = (s: string) => s.replace(/\s?€$/, "").replace(/\s/g, "");
const versPoint = (s: string) => s.replace(",", ".");

// ─── Vocabulaire ───────────────────────────────────────────────────────────

type Regle = { re: RegExp; metier: string; realisation: string; fiche: string };
const REGLES: Regle[] = [
  { re: /voilage/i, metier: "Rideaux", realisation: "Voilage", fiche: "Rideaux" },
  { re: /doubles?[- ]rideaux?/i, metier: "Rideaux", realisation: "Double rideaux", fiche: "Rideaux" },
  { re: /store\s+bateau/i, metier: "Rideaux", realisation: "Store bateau", fiche: "Stores" },
  { re: /\bstores?\b/i, metier: "Rideaux", realisation: "Store enrouleur", fiche: "Stores" },
  { re: /rideaux?|panneaux?\s+japonais/i, metier: "Rideaux", realisation: "Rideau (pan)", fiche: "Rideaux" },
  { re: /t[êe]te\s+de\s+lit/i, metier: "Tapisserie", realisation: "Tête de lit", fiche: "Tête de lit" },
  { re: /(?:habillage|dessus|jet[ée])\s+de\s+lit|ciel\s+de\s+lit|cache[- ]sommier/i, metier: "Tapisserie", realisation: "Autre", fiche: "Habillage de lit" },
  { re: /tenture/i, metier: "Tapisserie", realisation: "Tenture murale", fiche: "Tenture murale" },
  { re: /galettes?/i, metier: "Tapisserie", realisation: "Galette", fiche: "Galettes" },
  { re: /coussins?/i, metier: "Tapisserie", realisation: "Coussin", fiche: "Coussins" },
  { re: /berg[èe]re/i, metier: "Tapisserie", realisation: "Bergère", fiche: "Tapisserie" },
  { re: /fauteuils?|cabriolet|voltaire|crapaud|marquise/i, metier: "Tapisserie", realisation: "Fauteuil", fiche: "Tapisserie" },
  { re: /canap[ée]s?|sofa|m[ée]ridienne|chesterfield/i, metier: "Tapisserie", realisation: "Canapé", fiche: "Tapisserie" },
  { re: /banquettes?/i, metier: "Tapisserie", realisation: "Banquette", fiche: "Tapisserie" },
  { re: /chaises?/i, metier: "Tapisserie", realisation: "Chaise", fiche: "Tapisserie" },
  { re: /poufs?/i, metier: "Tapisserie", realisation: "Pouf", fiche: "Tapisserie" },
  { re: /tabourets?/i, metier: "Tapisserie", realisation: "Tabouret", fiche: "Tapisserie" },
];

// Composants d'un ouvrage (sous-lignes) : jamais un ouvrage à eux seuls.
const MAIN_OEUVRE = /main[- ]d['’ ]?\s*[œo]e?uvre|\bm\.?\s?o\.?\b|fa[çc]on\b|heures?\s+(?:d['’]atelier|de\s+travail)/i;
const POSE = /\bpose\b|installation|d[ée]placement/i;
const TISSU = /\b(tissu|velours|lin\b|toile|soierie|jacquard|cuir|simili|skai|voile\b|etamine|étamine)\b/i;
const FOURNITURE = /\b(doublure|galon|passepoil|ganse|cloutage|clous|mousse|ouate|molleton|crin|sangles?|ressorts?|toile\s+(?:blanche|d['’]embourrure|de\s+jute)|tringle|rail|embrasses?|plombs?|ruban|fournitures?|thermocollant|entoilage)\b/i;
// « TFC », « tissu client », « TISSU FOURNI » (EBP de l'atelier).
const TISSU_CLIENT = /\bT\.?F\.?C\.?\b|tissu\s+(?:fourni\s+)?(?:par\s+(?:le|la|les)\s+)?client|fourni\s+par\s+(?:le|la|les)\s+client|tissu\s+fourni\b/i;

const estComposant = (t: string) =>
  !REGLES.some((r) => r.re.test(t)) &&
  (MAIN_OEUVRE.test(t) || POSE.test(t) || TISSU.test(t) || FOURNITURE.test(t) || TISSU_CLIENT.test(t));

// Titre de pièce : court, sans chiffre de prix, en MAJUSCULES (ou finissant
// par « : »), et pas un composant.
function estTitre(l: string): boolean {
  const t = l.replace(/\s*\|\s*/g, " ").trim();
  if (!t || t.length > 40 || /\d[.,]\d{2}/.test(t) || FIN_TABLEAU.test(t)) return false;
  const lettres = t.replace(/[^A-Za-zÀ-ÿ]/g, "");
  if (lettres.length < 3) return false;
  const maj = lettres.replace(/[^A-ZÀ-Þ]/g, "").length / lettres.length;
  return (maj > 0.8 || /:$/.test(t)) && !REGLES.some((r) => r.re.test(t));
}

const joliePiece = (t: string) => {
  const s = t.replace(/[:|]/g, " ").replace(/\s+/g, " ").trim().toLowerCase();
  return s.charAt(0).toUpperCase() + s.slice(1);
};

const premier = (texte: string, re: RegExp) => versPoint(texte.match(re)?.[1] ?? "");

function heuresDe(t: string): number {
  const m = t.match(/(\d+(?:[.,]\d+)?)\s*(?:h\b|hr?s?\b|heures?)/i);
  return m ? Number(versPoint(m[1])) : 0;
}

function dimensions(t: string): { l: string; h: string } {
  const l = premier(t, /\bl(?:arg(?:eur)?)?\.?\s*[:=]?\s*(\d{2,4}(?:[.,]\d+)?)\s*(?:cm)?\b/i);
  const h = premier(t, /\bh(?:aut(?:eur)?)?\.?\s*[:=]?\s*(\d{2,4}(?:[.,]\d+)?)\s*(?:cm)?\b/i);
  if (l || h) return { l, h };
  const m = t.match(/(\d{2,4}(?:[.,]\d+)?)\s*(?:cm)?\s*[x×*]\s*(\d{2,4}(?:[.,]\d+)?)/i);
  return m ? { l: versPoint(m[1]), h: versPoint(m[2]) } : { l: "", h: "" };
}

function tissuDe(t: string, qte: string, unite: string): TissuLu | null {
  if (!TISSU.test(t) && !FOURNITURE.test(t) && !/r[ée]f\.?\s*:|coloris/i.test(t)) return null;
  // « Tissu canovas Réf :roma forét » (EBP) → « canovas roma forét ».
  const nomTissu = t.match(/\btissu\s+(?!fourni|client)([a-zà-ÿ][\wà-ÿ-]+)/i)?.[1] ?? "";
  const apresRef =
    // « réf. X », « réf : X », « référence X » — pas « réfection ».
    t.match(/\br[ée]f(?:[ée]rence)?(?:\.\s*|\s*:\s*|\s+)([A-Z0-9À-ÿ][^,;|()]{1,40})/i)?.[1]?.trim() ??
    t.match(/\b([A-Z]{2,}[\-\s]?\d{2,}[\w\-/]*)\b/)?.[1] ??
    "";
  // Ligne « TISSU … » d'EBP : tout ce qui suit est le nom du tissu
  // (« TISSU Prestigious RUNWAY Marilyn 3885 », « TISSU romo Réf :8021/03 »).
  const resteTissu = t
    .match(/^\s*(?:tissus?|simili(?:cuir)?|velours|satinette)(?:\s+(?:rideaux?|voilages?))?\s*:?\s+(.+)$/i)?.[1]
    ?.replace(/\br[ée]f(?:[ée]rence)?\s*[.:]?\s*/i, "")
    .replace(/\s*\d+(?:[.,]\d+)?\s*(?:ml|m)\b.*$/i, "")
    // Le coloris a sa propre colonne (« … coloris au choix »).
    .replace(/\s*\b(?:coloris|col\.)\s*:?.*$/i, "")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, 60);
  const ref =
    resteTissu ||
    [nomTissu, apresRef.replace(/\s*\d+(?:[.,]\d+)?\s*(?:ml|m)\b.*$/i, "")].filter(Boolean).join(" ");
  const coloris = (t.match(/(?:coloris|col\.|coul(?:eur)?\.?|teinte)\s*:?\s*([^,;|()]+)/i)?.[1] ?? "")
    .replace(/\s*\d+(?:[.,]\d+)?\s*(?:ml|m|mètres?)\b.*$/i, "")
    .trim();
  const metrage =
    t.match(/(\d+(?:[.,]\d+)?)\s*(?:ml|m\b|mètres?)/i)?.[1] ??
    (/^(ml|m)$/i.test(unite) ? qte : "");
  const placement = /doublure|satinette|occultant|black\s*out/i.test(t)
    ? "Doublure"
    : /galon|passepoil|ganse|clou/i.test(t)
      ? "Finition"
      : /mousse|ouate|crin|molleton/i.test(t)
        ? "Garnissage"
        : TISSU.test(t)
          ? "Principal"
          : "Fourniture";
  // Libellé court quand il n'y a ni réf ni coloris (ex. « Galon »).
  // Sans référence : le libellé (court) de la fourniture, ex. « sangles,
  // profilés, mousse et matériaux divers ».
  const nomCourt =
    ref || (FOURNITURE.test(t) || TISSU.test(t) ? t.replace(/\s+/g, " ").trim().slice(0, 60) : "");
  if (!nomCourt && !coloris && !metrage) return null;
  return { ref: nomCourt, coloris, metrage, placement };
}

// ─── Fiche de travail ──────────────────────────────────────────────────────

function etapesDe(fiche: string, tout: string, pose: boolean): string[] {
  // Tête de lit neuve : fabrication, pas de découverture.
  if (fiche === "Tête de lit" && !/r[ée]fection|recouvr|existante/i.test(tout)) {
    return [
      "STRUCTURE / GABARIT",
      "MOUSSE",
      "OUATE",
      "POSE TISSU",
      ...(/capitonn/i.test(tout) ? ["CAPITONNAGE"] : []),
      "FINITION",
      ...(pose ? ["POSE"] : []),
    ];
  }
  if (fiche === "Tapisserie" || fiche === "Tête de lit") {
    if (/crin|traditionnel|guindage|ressorts?|toile\s+blanche|embourrure/i.test(tout)) {
      return ["DÉCOUVERTURE", "SANGLAGE", "RESSORTS / GUINDAGE", "CRIN", "TOILE BLANCHE", "POSE TISSU", "FINITION (galon / clous)"];
    }
    if (/mousse|ouate/i.test(tout)) {
      return ["DÉCOUVERTURE", "SANGLAGE", "MOUSSE", "OUATE", "POSE TISSU", "FINITION"];
    }
    // Simple recouverture (on garde la garniture) : découvrir et recouvrir.
    if (/d[ée]couverture|recouverture|recouvrir/i.test(tout)) {
      return [
        "DÉCOUVERTURE",
        "CONTRÔLE GARNITURE",
        "POSE TISSU",
        /galon|clou/i.test(tout) ? "FINITION (galon / clous)" : "FINITION",
      ];
    }
    return [];
  }
  if (fiche === "Rideaux") {
    const tete = /[œo]e?illet/i.test(tout)
      ? "TÊTES (œillets)"
      : /pinces?\s+(?:triple|flamande)/i.test(tout)
        ? "TÊTES (pinces triples)"
        : /pinces?/i.test(tout)
          ? "TÊTES (pinces)"
          : /ruban|fronc/i.test(tout)
            ? "TÊTES (ruban fronceur)"
            : /wave|vagues?/i.test(tout)
              ? "TÊTES (wave)"
              : "TÊTES";
    return [
      "COUPE",
      "ASSEMBLAGE",
      ...(/doubl|occult|thermique|obscurc/i.test(tout) ? ["DOUBLURE"] : []),
      tete,
      "OURLETS / PLOMBS",
      "REPASSAGE",
      ...(pose ? ["POSE"] : []),
    ];
  }
  if (fiche === "Stores") return ["DÉCOUPE", "MONTAGE", "ESSAI", ...(pose ? ["POSE"] : [])];
  return [];
}

function contenuFiche(
  fiche: string,
  realisation: string,
  t: string,
  piece: string,
  pose: boolean
): Record<string, string> {
  const c: Record<string, string> = {};
  const { l, h } = dimensions(t);
  switch (fiche) {
    case "Rideaux": {
      if (piece) c.piece = piece;
      if (l) c.largeur_fini = l;
      if (h) c.hauteur_fini = h;
      const pans = premier(t, /(\d+)\s*(?:pans?|panneaux|lés)\b/i);
      if (pans) c.nb_panneaux = pans;
      else if (/\bpaires?\b/i.test(t)) c.nb_panneaux = String(2 * (Number(premier(t, /(\d+)\s*paires?/i)) || 1));
      const amp = premier(t, /(?:ampleur|fronce|coef(?:ficient)?)\s*(?:x|de|:)?\s*(\d(?:[.,]\d)?)/i);
      if (["1.5", "1.8", "2", "2.5", "3"].includes(amp)) c.coeff_fonce = amp;
      if (/[œo]e?illet/i.test(t)) c.type_tete = "Œillets";
      else if (/ruban|fronc/i.test(t)) c.type_tete = "Ruban fronceur";
      else if (/pinces?\s+(?:triple|flamande)/i.test(t)) c.type_tete = "Pince triple";
      else if (/pinces?/i.test(t)) c.type_tete = "Pince simple";
      else if (/passants?/i.test(t)) c.type_tete = "Passants";
      else if (/smock/i.test(t)) c.type_tete = "Smocks";
      else if (/wave|vagues?/i.test(t)) c.type_tete = "Wave (vague)";
      else if (/accord[ée]on/i.test(t)) c.type_tete = "Accordéon";
      else if (/t[êe]te\s+plate|plats?\b/i.test(t)) c.type_tete = "Plats";
      const occ = /occult|obscurc|blackout/i.test(t);
      const th = /thermique/i.test(t);
      if (occ && th) c.doublure = "Thermique + obscurcissante";
      else if (occ) c.doublure = "Obscurcissante";
      else if (th) c.doublure = "Thermique";
      else if (/doubl[ée]|doublure/i.test(t)) c.doublure = "Simple";
      else c.doublure = "Non";
      if (/motoris/i.test(t)) c.type_pose = "Motorisé";
      else if (/embrasse/i.test(t)) c.type_pose = "Tringle + embrasses";
      else if (/\brail\b/i.test(t)) c.type_pose = "Rail";
      else if (/c[âa]ble/i.test(t)) c.type_pose = "Câble";
      else if (/tringle/i.test(t)) c.type_pose = "Tringle";
      const refTringle = t.match(/(?:tringle|rail)\s+([A-Z0-9][\w\-/.]{2,})/i)?.[1];
      if (refTringle && /\d/.test(refTringle)) c.ref_tringle = refTringle;
      break;
    }
    case "Stores": {
      c.type_store = /bateau/i.test(t)
        ? "Store bateau"
        : /pliss/i.test(t)
          ? "Store plissé"
          : /v[ée]nitien/i.test(t)
            ? "Store vénitien"
            : /californien|bandes?\s+verticales/i.test(t)
              ? "Store californien"
              : "Store enrouleur";
      if (piece) c.piece = piece;
      const n = premier(t, /(\d+)\s*stores?/i);
      if (n) c.nb_stores = n;
      if (l) c.largeur = l;
      if (h) c.hauteur = h;
      if (/radio|somfy|t[ée]l[ée]commande/i.test(t)) c.motorisation = "Oui - radio";
      else if (/motoris/i.test(t)) c.motorisation = "Oui - filaire";
      else c.motorisation = "Non";
      c.pose_incluse = pose ? "Oui" : "Non";
      break;
    }
    case "Tête de lit":
      if (l) c.largeur = l;
      if (h) c.hauteur = h;
      if (/capitonn/i.test(t)) c.forme = "Capitonnée";
      else if (/cintr/i.test(t)) c.forme = "Cintrée";
      else if (/oreilles/i.test(t)) c.forme = "Avec oreilles";
      else if (/arrondi/i.test(t)) c.forme = "Arrondie";
      if (/pieds/i.test(t)) c.fixation = "Pieds";
      else if (/suspendu|cr[ée]maill[èe]re/i.test(t)) c.fixation = "Suspendu";
      else if (/patte/i.test(t)) c.fixation = "Pattes de fixation";
      break;
    case "Tenture murale":
      if (l) c.largeur_mur = l;
      if (h) c.hauteur_mur = h;
      if (/baguette/i.test(t)) c.technique_pose = "Baguettes bois";
      else if (/agraf/i.test(t)) c.technique_pose = "Agrafage";
      else if (/coll[ée]/i.test(t)) c.technique_pose = "Collé";
      if (/molleton|toile\s+de\s+fond|thermique|acoustique/i.test(t)) {
        c.toile_fond = /acoustique/i.test(t) ? "Oui - acoustique" : /thermique/i.test(t) ? "Oui - thermique" : "Oui - simple";
      }
      break;
    case "Coussins":
    case "Galettes": {
      const d = t.match(/(\d{2,3}\s*[x×]\s*\d{2,3}(?:\s*[x×]\s*\d{1,2})?\s*(?:cm)?|[∅ø]\s*\d{2,3}\s*(?:cm)?)/i);
      if (d) c.dimensions = d[1];
      const n = premier(t, /(\d+)\s*(?:coussins?|galettes?)/i);
      if (n) c[fiche === "Coussins" ? "nb_coussins" : "nb_galettes"] = n;
      if (/zip|fermeture\s+[ée]clair/i.test(t)) c.fermeture = /invisible/i.test(t) ? "Zip invisible" : "Zip apparent";
      if (fiche === "Galettes" && /liens?/i.test(t)) c.liens_attaches = "Oui - liens tissu";
      break;
    }
    case "Tapisserie": {
      c.meuble = realisation;
      const places = premier(t, /(\d+)\s*places?\b/i);
      if (places) c.nb_places = places;
      const ep = t.match(/\b(louis\s+[xvi]+|empire|directoire|napol[ée]on\s+iii|art\s+d[ée]co|voltaire|crapaud|cabriolet|m[ée]daillon|chesterfield|scandinave|contemporain|ann[ée]es\s+\d0)\b/i);
      if (ep) c.epoque = ep[1];
      if (/consolid|recoll|r[ée]paration\s+(?:de\s+)?(?:la\s+)?structure/i.test(t)) c.etat_structure = "À consolider";
      if (/r[ée]fection\s+compl[èe]te|d[ée]garnissage|tout\s+refaire|traditionnel|crin/i.test(t)) {
        c.depose_necessaire = "Complète";
      } else if (/recouverture|recouvrir|changement\s+(?:de\s+)?tissu/i.test(t)) {
        c.depose_necessaire = "Partielle";
      }
      break;
    }
    case "Pose seule":
      c.type_pose = t.slice(0, 80);
      break;
  }
  return c;
}

// ─── Lecture complète ───────────────────────────────────────────────────────
//
// Structure réelle des devis EBP de l'atelier (33 devis étudiés) :
//   Référence : SALON SUR MESURE                 ← objet du devis (en-tête)
//   Description | Unité | Qté | P.U. HT | Montant HT | TVA
//   0,00 | 0,00 | 0,00 | 0,00                    ← ligne vide (séparateur)
//   CANAPÉS SUR MESURE                           ← titre = l'OUVRAGE
//   Fabrication des structures | H | 70,00 | …   ← main-d'œuvre en heures
//   Sanglage                                     ← … suivie des ÉTAPES
//   Coupe et collage de mousse
//   MATÉRIAUX | ENS | 2,00 | …                   ← composants de l'ouvrage
//   TISSU | ML | 22,00 | …                       ← tissu, nom sur les lignes
//   Prestigious / RUNWAY / Marilyn 3885             suivantes
//   0,00 | 0,00 | 0,00 | 0,00
//   FAUTEUIL TONNEAU                             ← ouvrage suivant…

type Brut = {
  texte: string; // première ligne (libellé chiffré)
  suite: string[]; // lignes suivantes sans prix (étapes, nom du tissu…)
  notes: string[]; // lignes libres juste avant (« TISSU FOURNI »…)
  titre: string; // titre d'ouvrage au-dessus (« FAUTEUIL TONNEAU »)
  regleTitre?: Regle;
  quantite: string;
  unite: string;
  montant: string;
  piece: string;
};

// Quantité écrite dans un titre / objet (« DEUX FAUTEUILS », « 4 galettes »).
const NOMBRES_LETTRES: Record<string, number> = {
  un: 1, une: 1, deux: 2, trois: 3, quatre: 4, cinq: 5, six: 6, sept: 7,
  huit: 8, neuf: 9, dix: 10, douze: 12, paire: 2,
};
// Seulement devant un nom d'ouvrage (« 3 paires », « deux fauteuils ») : pas
// « 2 plis » ni « 45 cm ».
const NOM_OUVRAGE =
  "(?:paires?|fauteuils?|chaises?|doubles?\\s+rideaux|rideaux?|voilages?|stores?|galettes?|coussins?|banquettes?|canap[ée]s?|berg[èe]res?|t[êe]tes?\\s+de\\s+lit|panneaux|pans|tabourets?|poufs?|housses?)";
function quantiteDe(t: string): string {
  const chiffre = t.match(new RegExp(`\\b(\\d{1,3})\\s+(?:[a-zà-ÿ]+\\s+)?${NOM_OUVRAGE}\\b`, "i"))?.[1];
  if (chiffre) return chiffre;
  const mot = t
    .toLowerCase()
    .match(new RegExp(`\\b(une?|deux|trois|quatre|cinq|six|sept|huit|neuf|dix|douze)\\s+(?:[a-zà-ÿ]+\\s+)?${NOM_OUVRAGE}\\b`))?.[1];
  if (mot) return String(NOMBRES_LETTRES[mot]);
  return /\bpaire\b/i.test(t) ? "1" : "";
}

// Mots d'étape de travail (pour reconnaître une liste d'étapes du devis).
const MOT_ETAPE =
  /^(d[ée]garnissage|d[ée]couverture|sanglage|sangles?|coupe|collage|couverture|recouverture|finitions?|fabrication|structure|garnissage|garniture|confection|cr[ée]ation|r[ée]fection|r[ée]stauration|restauration|enl[èe]vement|peinture|nettoyage|pose|changement|mousses?|ouate|crin|guindage|ressorts?|capitonnage|gainage|modification|surpiq[ûu]re|piq[ûu]re|montage|assemblage|repassage|ourlets?|t[êe]tes?|doublure)\b/i;
// Lignes de bas / haut de page qui se glissent dans le tableau.
const BRUIT_PAGE = /^\d+\s+sur\s+\d+$|siret|\bape\b|logiciels?\s+de\s+gestion|document\s+cr[ée]{2}\s+par|^(num[ée]ro|date)\s*\|/i;

// Ligne de travail sans nom d'ouvrage (« Dégarnissage, réfection… »).
const TRAVAIL = /r[ée]fection|recouverture|recouvrir|d[ée]garnissage|garnissage|restauration|confection|fabrication|capitonnage|r[ée]novation|cr[ée]ation|gainage/i;
// Ligne de tissu / fourniture, même si elle cite « rideau » ou « voilage »
// (« TISSU RIDEAU Montsouris », « voilage ado ref basic 3101 »).
const LIGNE_TISSU = /^\s*(?:(?:tissus?|simili(?:cuir)?|cuir|velours|toile|satinette|doublure|mousse|mat[ée]riaux|tringles?|tringlerie|rails?|cordons?|corde|double\s+corde|galons?)\b|structure\s*:|garniture\s*:)/i;
// Pose / logistique : composant de l'ouvrage précédent.
const LIGNE_POSE = /^\s*(pose|repose|d[ée]pose|d[ée]montage|installation)\b/i;
const LOGISTIQUE = /enl[èe]vement|livraison|emballage|d[ée]placement|transport/i;
const enHeures = (u: string) => /^(h|hr|heures?)$/i.test(u);

// Découpe une ligne de tableau en libellé / quantité / unité / montant.
// `tvaEnDernier` : la dernière colonne est le taux de TVA (devis EBP), donc
// le montant de la ligne est l'avant-dernier nombre.
function decouper(l: string, tvaEnDernier = false) {
  const cellules = l.split(" | ").map((c) => c.trim()).filter(Boolean);
  const uniteCellule = cellules.find((c) => UNITE_CELLULE.test(c)) ?? "";
  const tousNombres = cellules.filter(
    (c) => NOMBRE.test(nettoyerNombre(c)) || PRIX.test(nettoyerNombre(c))
  );
  const nombres =
    tvaEnDernier && tousNombres.length >= 2 ? tousNombres.slice(0, -1) : tousNombres;
  let textes = cellules.filter((c) => !tousNombres.includes(c) && c !== uniteCellule);
  let unite = uniteCellule;
  // EBP colle parfois l'unité au libellé (« … recouverture et H »), avec le
  // nombre éventuel qui la précède (« … Sable 9 ml »).
  if (!unite && textes.length && tousNombres.length) {
    const dernier = textes[textes.length - 1];
    const fin = dernier.match(/\s(?:\d+(?:[.,]\d+)?\s*)?(ml|m|m²|h|u|ens|pce|pcs|fft|pl)$/i);
    if (fin) {
      unite = fin[1];
      textes = [...textes.slice(0, -1), dernier.slice(0, -fin[0].length).trim()];
    }
  }
  textes = textes.filter(Boolean);
  const aPrix = cellules.some((c) => PRIX.test(nettoyerNombre(c)));
  const montant = nettoyerNombre(nombres[nombres.length - 1] ?? "");
  const qte =
    nombres.length >= 3 ||
    (nombres.length === 2 && Number(versPoint(nettoyerNombre(nombres[0]))) < 100)
      ? nettoyerNombre(nombres[0]).replace(/[.,]0+$/, "")
      : "1";
  // Ligne « vide » d'EBP : que des zéros, aucun libellé.
  const vide = !textes.length && tousNombres.every((n) => Number(versPoint(nettoyerNombre(n))) === 0);
  return { textes, aPrix, montant, qte, unite, vide };
}

// Titre qui nomme un ouvrage (« FAUTEUIL TONNEAU », « Chaise Deauville »).
function estTitreOuvrage(t: string): Regle | undefined {
  if (t.length > 50 || LIGNE_TISSU.test(t) || LIGNE_POSE.test(t)) return undefined;
  // « Tringlerie, tissus, voilages, supports » : un bloc de fournitures.
  if (/tringl|\btissus?\b|fournitures?|mat[ée]riaux|supports?/i.test(t)) return undefined;
  return REGLES.find((r) => r.re.test(t));
}

// Étapes écrites dans le devis sous la ligne de main-d'œuvre : soit
// annoncées (« ETAPES »), soit une liste de phrases courtes qui commencent
// par un mot de métier (« Sanglage », « Coupe et collage de mousse »…).
function etapesDuDevis(b: Brut): string[] {
  const brutes = [b.texte, ...b.suite].map((l) => l.trim()).filter(Boolean);
  const annoncees = brutes.some((l) => /^[ée]tapes?\b/i.test(l));
  const lignes = brutes
    .map((l) => l.replace(/^[ée]tapes?\s*:?\s*/i, "").replace(/\s*:\s*$/, "").trim())
    .filter((l) => /^[A-Za-zÀ-ÿ]/.test(l) && l.length <= 70 && !/minutes?\s+par/i.test(l));
  if (annoncees) return lignes.map((l) => l.toUpperCase());
  if (lignes.length < 2 || lignes.some((l) => l.length > 45)) return [];
  const metier = lignes.filter((l) => MOT_ETAPE.test(l)).length;
  return metier / lignes.length >= 0.8 ? lignes.map((l) => l.toUpperCase()) : [];
}

export async function lireDevis(data: Uint8Array): Promise<DevisLu> {
  const { lignes, pages } = await lignesDuPdf(data);
  return lireDevisLignes(lignes, pages);
}

// Même lecture à partir de lignes déjà découpées (cellules séparées par
// « | ») : PDF EBP, ou devis Markdown converti par lib/devis-markdown.
export function lireDevisLignes(lignes: string[], pages = 1): DevisLu {
  const texte = lignes.join("\n");

  // 1) En-tête | tableau.
  let debut = lignes.findIndex((l) => ENTETE_TABLEAU.test(l));
  if (debut < 0) {
    debut = lignes.findIndex((l) => l.split(" | ").some((c) => PRIX.test(nettoyerNombre(c))));
    debut = debut < 0 ? lignes.length : debut - 1;
  }
  const entete = lignes.slice(0, Math.max(debut, 0));
  const tvaEnDernier = debut >= 0 && /\btva\s*$/i.test(lignes[debut] ?? "");

  // Objet du devis (« Référence : RESTAURATION DE DEUX FAUTEUILS ») : donne
  // l'ouvrage quand le tableau ne le nomme pas.
  const objet = (entete.join("\n").match(/\br[ée]f[ée]rence\s*:\s*([^\n|]+)/i)?.[1] ?? "").trim();
  const regleObjet = REGLES.find((r) => r.re.test(objet));
  const qteObjet = quantiteDe(objet);

  // 2) Lignes du tableau → libellés chiffrés + leurs suites, titres, notes.
  const bruts: Brut[] = [];
  let piece = "";
  let titre: { label: string; regle: Regle } | null = null;
  let notes: string[] = [];
  let suitePossible = false;
  for (const l of lignes.slice(Math.max(debut + 1, 0))) {
    if (FIN_TABLEAU.test(l)) {
      if (bruts.length) break;
      continue;
    }
    if (ENTETE_TABLEAU.test(l)) continue; // en-tête répété (page suivante)
    if (/\bremise\b/i.test(l)) continue; // remise commerciale
    // Bas / haut de page (n° de page, Siret, en-tête client répété).
    if (BRUIT_PAGE.test(l) || ATELIER.test(l) || entete.includes(l)) continue;
    const d = decouper(l, tvaEnDernier);
    if (d.vide) {
      suitePossible = false;
      continue;
    }
    if (d.aPrix) {
      // Libellé absent (« Création » puis « H | 120,00 | … ») : on prend la
      // dernière note comme libellé.
      const texteLigne = d.textes.join(" ") || notes.pop() || "";
      if (!texteLigne) continue;
      bruts.push({
        texte: texteLigne,
        suite: [],
        notes,
        titre: titre?.label ?? "",
        regleTitre: titre?.regle,
        quantite: d.qte,
        unite: d.unite,
        montant: d.montant,
        piece,
      });
      titre = null;
      notes = [];
      suitePossible = true;
      continue;
    }
    const t = d.textes.join(" ").trim();
    if (!t) continue;
    if (suitePossible && bruts.length) {
      // Suite du libellé chiffré : étapes, nom du tissu, « Réf : … ».
      bruts[bruts.length - 1].suite.push(t);
      continue;
    }
    const regleTitre = estTitreOuvrage(t);
    if (regleTitre) {
      titre = { label: t, regle: regleTitre };
      continue;
    }
    if (estTitre(l) && !TISSU.test(t) && !FOURNITURE.test(t) && !TISSU_CLIENT.test(t) && !TRAVAIL.test(t)) {
      piece = joliePiece(l);
      continue;
    }
    notes.push(t);
  }

  // 3) Regroupement : ouvrages et leurs composants.
  const ouvrages: OuvrageLu[] = [];
  const heures = new Map<OuvrageLu, number>();
  const sources = new Map<OuvrageLu, Brut>();
  let objetUtilise = false;
  for (const b of bruts) {
    const ligne = [b.texte, ...b.suite].join(" ").replace(/\s+/g, " ").trim();
    const parent = ouvrages[ouvrages.length - 1];
    const estTissu =
      !b.regleTitre &&
      (LIGNE_TISSU.test(b.texte) || (/^(ml|m)$/i.test(b.unite) && !TRAVAIL.test(ligne)));
    const estPose =
      !b.regleTitre &&
      !TRAVAIL.test(ligne) &&
      (LIGNE_POSE.test(b.texte) || (LOGISTIQUE.test(b.texte) && ligne.length < 60));
    // L'ouvrage nommé dans la ligne elle-même prime sur le titre au-dessus
    // (« Rideaux + voilages » puis « Confection double rideaux 3 paires »).
    let regle: Regle | undefined =
      estTissu || estPose
        ? undefined
        : REGLES.find((r) => r.re.test(ligne)) ?? b.regleTitre;
    // Travail sans ouvrage nommé : l'ouvrage vient de l'objet du devis.
    // (Sauf une ligne d'heures / de main-d'œuvre juste après un ouvrage
    // reconnu : ce sont SES heures, pas un second ouvrage.)
    const heuresDuParent =
      !!parent?.probable && (enHeures(b.unite) || MAIN_OEUVRE.test(ligne)) && !TRAVAIL.test(ligne);
    if (!regle && !estTissu && !estPose && !objetUtilise && regleObjet && !heuresDuParent && (enHeures(b.unite) || TRAVAIL.test(ligne))) {
      regle = regleObjet;
      objetUtilise = true;
    }
    // Toute ligne chiffrée sans ouvrage qui suit un ouvrage lui appartient
    // (fournitures, cordon, heures en plus, pose…).
    const composant = !regle && !!parent;
    if (composant) {
      const texteComp = [...b.notes, ligne].join(" ");
      parent.composants.push(texteComp);
      if (TISSU_CLIENT.test(texteComp)) parent.tissuClient = true;
      if (enHeures(b.unite) || MAIN_OEUVRE.test(ligne)) {
        const h = enHeures(b.unite) ? Number(versPoint(b.quantite)) : heuresDe(ligne);
        heures.set(parent, (heures.get(parent) ?? 0) + (h || 0));
      } else if (!estPose && !TISSU_CLIENT.test(ligne)) {
        const tissu = tissuDe(ligne, b.quantite, b.unite);
        if (tissu) {
          // Sans unité, la Qté d'une ligne de tissu reste son métrage.
          if (!tissu.metrage && !b.unite && estTissu) tissu.metrage = b.quantite;
          parent.tissus.push(tissu);
        } else if (estTissu) {
          // Ligne vendue au mètre sans mot « tissu » (« heavensgate col ») :
          // c'est le tissu, nommé par la ligne elle-même.
          parent.tissus.push({
            ref: ligne.replace(/\s+col\.?$/i, "").slice(0, 60),
            coloris: "",
            metrage: /^(ml|m)$/i.test(b.unite) ? b.quantite : "",
            placement: "Principal",
          });
        }
      }
      if (estPose && !LOGISTIQUE.test(b.texte)) parent.pose = true;
      continue;
    }
    const libelle = [b.titre, ligne].filter(Boolean).join(" — ");
    // Quantité : en heures ou en mètres, la colonne Qté n'est pas un nombre
    // d'ouvrages → on la lit dans le libellé, le titre ou l'objet du devis.
    const quantite =
      enHeures(b.unite) || /^(ml|m)$/i.test(b.unite)
        ? quantiteDe(ligne) || quantiteDe(b.titre) || (regle === regleObjet ? qteObjet : "") || "1"
        : b.quantite || "1";
    const o: OuvrageLu = {
      texte: libelle,
      composants: b.notes.length ? [b.notes.join(" ")] : [],
      piece: b.piece,
      metier: regle?.metier ?? "Autre",
      realisation: regle?.realisation ?? "Autre",
      quantite,
      montant: b.montant,
      heures: "",
      tissuClient: TISSU_CLIENT.test(b.notes.join(" ")),
      pose: estPose,
      ficheType: regle?.fiche ?? (estPose ? "Pose seule" : "Autre"),
      contenu: {},
      tissus: [],
      etapes: [],
      probable: !!regle,
    };
    if (enHeures(b.unite)) heures.set(o, Number(versPoint(b.quantite)) || 0);
    sources.set(o, b);
    ouvrages.push(o);
  }

  // 4) Analyse de chaque ouvrage avec ses composants.
  for (const o of ouvrages) {
    const viaObjet = o.probable && objet && !REGLES.some((r) => r.re.test(o.texte));
    const tout = [viaObjet ? objet : "", o.texte, ...o.composants].filter(Boolean).join(" ; ");
    o.tissuClient = o.tissuClient || TISSU_CLIENT.test(tout);
    // Pose chez le client (pas « Pose du simili » = étape d'atelier).
    o.pose = o.pose || /pose\s+(?:comprise|incluse)|avec\s+pose|\bpos[ée]e?s?\s+(?:sur|chez|à)\b/i.test(o.texte);
    const h = (heures.get(o) ?? 0) || heuresDe(o.texte);
    o.heures = h ? String(Math.round(h * 100) / 100).replace(".", ",") : "";
    // Tissu cité dans le libellé même de l'ouvrage (réf / coloris).
    const dansLibelle = tissuDe(o.texte, "", "");
    const citeUnTissu =
      /\br[ée]f(?:\.|\s*:|\s)|coloris/i.test(o.texte) || /\b[A-Z]{2,}[\-\s]?\d{2,}/.test(o.texte);
    // Seulement avec une vraie référence (« coloris noir doublé » seul ne suffit pas).
    if (dansLibelle && citeUnTissu && /\d/.test(dansLibelle.ref) && !TISSU_CLIENT.test(o.texte)) {
      o.tissus.unshift(dansLibelle);
    }
    if (o.tissuClient) {
      o.tissus.unshift({ ref: "Tissu fourni par le client", coloris: "", metrage: "", placement: "Principal" });
    }
    o.contenu =
      o.ficheType === "Autre"
        ? { description: tout }
        : contenuFiche(o.ficheType, o.realisation, tout, o.piece, o.pose);
    if (o.ficheType === "Pose seule" && o.tissuClient) o.contenu.fournitures_client = "Oui - complètes";
    // Étapes : celles écrites dans le devis (sous la ligne d'heures) si
    // présentes, sinon celles déduites du type d'ouvrage.
    const src = sources.get(o);
    const ecrites = src && enHeures(src.unite) ? etapesDuDevis(src) : [];
    o.etapes =
      ecrites.length >= 2
        ? [...ecrites, ...(o.pose && !ecrites.some((e) => /POSE$/.test(e)) ? ["POSE"] : [])]
        : etapesDe(o.ficheType, tout, o.pose);
    const alertes = [
      o.tissuClient ? "⚠ TISSU FOURNI PAR LE CLIENT" : "",
      viaObjet ? `Objet du devis : ${objet}` : "",
      o.piece ? `Pièce : ${o.piece}` : "",
    ].filter(Boolean);
    o.contenu.observations = [...alertes, o.texte, ...o.composants.map((c) => `• ${c}`)].join("\n");
  }

  // 5) Client : premier bloc « CP Ville » de l'en-tête qui n'est pas celui de
  //    l'atelier (EBP : client en haut, atelier en dessous).
  const cellulesEntete = entete.map((l) => l.split(" | ").map((c) => c.trim()));
  let nom = "";
  let adresse = "";
  for (let i = 0; i < cellulesEntete.length && !adresse; i++) {
    const row = cellulesEntete[i];
    for (let k = row.length - 1; k >= 0; k--) {
      const c = row[k];
      if (!CP_VILLE.test(c) || ATELIER.test(entete[i])) continue;
      const auDessus = (j: number) => {
        const r = cellulesEntete[j];
        if (!r) return "";
        return (k === row.length - 1 ? r[r.length - 1] : r[k]) ?? "";
      };
      if ([1, 2].some((dd) => ATELIER.test(auDessus(i - dd)))) continue;
      const rue = auDessus(i - 1);
      const n = auDessus(i - 2);
      adresse = [rue, c].filter((x) => x && !ATELIER.test(x)).join(", ");
      nom = n && !/\d{3}/.test(n) && !ATELIER.test(n) && !/^devis$/i.test(n) ? n : "";
      break;
    }
  }
  // « Client : NOM » dans l'en-tête seulement (pas « tissu client » du tableau).
  const nomClient = entete.join("\n").match(/\bclient\s*:\s*([^\n|]{3,60})/i)?.[1]?.trim();
  if (nomClient && !/n°|code/i.test(nomClient)) nom = nomClient;

  const lignesHorsAtelier = entete.filter((l) => !ATELIER.test(l)).join("\n");
  const telephones = [...new Set(lignesHorsAtelier.match(TEL) ?? [])].filter(
    (t) => !TELS_ATELIER.includes(t.replace(/\D/g, ""))
  );
  const emails = [
    ...new Set((lignesHorsAtelier.match(EMAIL) ?? []).filter((e) => !ATELIER.test(e))),
  ];

  const numero =
    texte.match(/devis\s*(?:n°|no|num[ée]ro)\s*:?\s*([A-Z0-9][\w\-/]*)/i)?.[1] ??
    texte.match(/\b(DE\d{3,}|DV\d{3,})\b/)?.[1] ??
    "";

  return {
    numero,
    date: dateDuTexte(entete.join("\n") || texte),
    client: {
      nom,
      adresse,
      telephone: telephones[telephones.length - 1] ?? "",
      email: emails[emails.length - 1] ?? "",
    },
    telephones,
    emails,
    ouvrages,
    pages,
  };
}
