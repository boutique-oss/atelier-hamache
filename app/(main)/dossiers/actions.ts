"use server";

import { eq, inArray } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";

import { db } from "@/db";
import { dossiers } from "@/db/schema";
import { withPieceFlag } from "@/lib/piece-classifier";
import {
  calendarConfigured,
  createEvent,
  deleteEvent,
  updateEvent,
} from "@/lib/google-calendar";
import { revalidateDossierViews } from "@/lib/revalidate";
import { parsePlaces } from "@/lib/sous-types";
import { ajouterSousTypeDb, ecrireSousType } from "@/lib/sous-types-db";
import { parseNum } from "@/lib/utils";
import { sundayOfWeek } from "@/lib/weeks";

// Lit les champs du formulaire (FormData) vers un objet dossier.
function readForm(fd: FormData) {
  const str = (k: string) => {
    const v = (fd.get(k) as string | null)?.trim();
    return v ? v : null;
  };
  const heures = parseNum(fd.get("heuresARealiser"));
  const operateur = fd.get("operateurId") as string | null;
  // Étiquettes : cases cochées (flagsList) + champ libre (flagsExtra),
  // dédoublonnées -> JSON '["a","b"]' (format carte).
  const flagsArr = [
    ...fd.getAll("flagsList").map(String),
    ...((fd.get("flagsExtra") as string | null) || "")
      .split(",")
      .map((s) => s.trim()),
  ]
    .map((s) => s.trim())
    .filter(Boolean);
  const flags = JSON.stringify([...new Set(flagsArr)]);
  return {
    nomDossier: str("nomDossier") || "Sans nom",
    clientNom: str("clientNom") ?? "",
    telephone: str("telephone") ?? "",
    email: str("email") ?? "",
    adresse: str("adresse") ?? "",
    typeIntervention: str("typeIntervention") ?? "Autre",
    statut: str("statut") || "Nouveau",
    flags,
    dateOuverture: str("dateOuverture"),
    dateDevis: str("dateDevis"),
    // Semaine de chantier : le formulaire soumet le lundi (chantierSemaine),
    // qu'on stocke en début, et le dimanche correspondant en fin.
    dateDebutChantier: str("chantierSemaine"),
    dateFinChantier: str("chantierSemaine")
      ? sundayOfWeek(str("chantierSemaine")!)
      : null,
    dateEnlevementDepot: str("dateEnlevementDepot"),
    dateLivraison: str("dateLivraison"),
    datePriseDeCote: str("datePriseDeCote"),
    commentaireEnlevement: str("commentaireEnlevement") ?? "",
    commentaireLivraison: str("commentaireLivraison") ?? "",
    commentairePriseCote: str("commentairePriseCote") ?? "",
    commentaireChantier: str("commentaireChantier") ?? "",
    operateurId: operateur ? Number(operateur) || null : null,
    heuresARealiser: heures && heures > 0 ? heures : 0,
    commentaires: str("commentaires") ?? "",
  };
}

// Les périodes de chantier (début / fin) ne sont volontairement PAS poussées
// dans Google Agenda (par souci de lisibilité : on ne garde en agenda que la
// livraison, la prise de cote et l'enlèvement/dépôt). Elles restent visibles
// dans le planning interne de l'application. Cette fonction se contente donc de
// nettoyer un éventuel ancien événement « Chantier » resté en agenda.
async function syncDossierCalendar(id: number) {
  if (!calendarConfigured()) return;
  try {
    const [d] = await db.select().from(dossiers).where(eq(dossiers.id, id));
    if (!d || !d.googleEventId) return;
    await deleteEvent(d.googleEventId);
    await db
      .update(dossiers)
      .set({ googleEventId: null })
      .where(eq(dossiers.id, id));
  } catch (e) {
    console.error("Nettoyage événement chantier échoué:", (e as Error).message);
  }
}

// Les 3 événements ponctuels affichés sur le planning (point rouge/vert,
// carré jaune), chacun avec sa propre date et son propre événement Google.
// colorId Google Agenda, alignés sur les couleurs du planning interne :
//   Enlèvement/dépôt = rouge (Tomate 11), Livraison = vert (Basilic 10),
//   Prise de cote = jaune (Banane 5).
const EVENT_CONFIG = {
  dateEnlevementDepot: {
    eventIdCol: "googleEventIdEnlevement",
    commentCol: "commentaireEnlevement",
    heureCol: "heureEnlevement",
    rappelsCol: "rappelsEnlevement",
    label: "Enlèvement / dépôt",
    colorId: "11",
  },
  dateLivraison: {
    eventIdCol: "googleEventIdLivraison",
    commentCol: "commentaireLivraison",
    heureCol: "heureLivraison",
    rappelsCol: "rappelsLivraison",
    label: "Livraison",
    colorId: "10",
  },
  datePriseDeCote: {
    eventIdCol: "googleEventIdPriseCote",
    commentCol: "commentairePriseCote",
    heureCol: "heurePriseCote",
    rappelsCol: "rappelsPriseCote",
    label: "Prise de cote",
    colorId: "5",
  },
} as const;

export type DossierEventField = keyof typeof EVENT_CONFIG;

// Rappels par défaut si le dossier n'en définit pas : veille + jour même.
const RAPPELS_DEFAUT = [1440, 0];

// Parse une liste de rappels stockée en CSV (« 1440,0 ») -> minutes valides.
function parseRappels(csv: string | null | undefined): number[] {
  if (!csv) return RAPPELS_DEFAUT;
  const mins = csv
    .split(",")
    .map((s) => Number(s.trim()))
    .filter((n) => Number.isFinite(n) && n >= 0);
  return mins.length ? mins : RAPPELS_DEFAUT;
}

// Maps champ date -> colonne (interne au fichier ; un fichier "use server" ne
// peut exporter que des fonctions async).
const EVENT_COMMENT_COL: Record<DossierEventField, string> = {
  dateEnlevementDepot: "commentaireEnlevement",
  dateLivraison: "commentaireLivraison",
  datePriseDeCote: "commentairePriseCote",
};
const EVENT_HEURE_COL: Record<DossierEventField, string> = {
  dateEnlevementDepot: "heureEnlevement",
  dateLivraison: "heureLivraison",
  datePriseDeCote: "heurePriseCote",
};
const EVENT_RAPPELS_COL: Record<DossierEventField, string> = {
  dateEnlevementDepot: "rappelsEnlevement",
  dateLivraison: "rappelsLivraison",
  datePriseDeCote: "rappelsPriseCote",
};

// Synchronise l'événement Google Calendar (all-day, 1 jour) d'une des 3 dates
// ponctuelles. Même tolérance aux erreurs que syncDossierCalendar.
async function syncDossierEvent(id: number, field: DossierEventField) {
  if (!calendarConfigured()) return;
  try {
    const [d] = await db.select().from(dossiers).where(eq(dossiers.id, id));
    if (!d) return;
    const { eventIdCol, commentCol, heureCol, rappelsCol, label, colorId } =
      EVENT_CONFIG[field];
    const date = d[field];
    const existingEventId = d[eventIdCol];
    const commentaire = d[commentCol];
    const heure = d[heureCol];
    const rappels = parseRappels(d[rappelsCol]);

    if (date) {
      const ev = {
        summary: `${label} — ${d.nomDossier}`,
        description: [d.clientNom, d.adresse, d.telephone, commentaire]
          .filter(Boolean)
          .join(" · "),
        startDate: date,
        endDate: date,
        // Événement horaire à l'heure du dossier (défaut 07:00) + ses rappels
        // (défaut veille + jour même). Voir lib/google-calendar.
        heure: heure || null,
        rappels,
        // Couleur propre au type d'événement (voir EVENT_CONFIG).
        colorId,
      };
      if (existingEventId) {
        await updateEvent(existingEventId, ev);
      } else {
        const eventId = await createEvent(ev);
        await db
          .update(dossiers)
          .set({ [eventIdCol]: eventId })
          .where(eq(dossiers.id, id));
      }
    } else if (existingEventId) {
      await deleteEvent(existingEventId);
      await db
        .update(dossiers)
        .set({ [eventIdCol]: null })
        .where(eq(dossiers.id, id));
    }
  } catch (e) {
    console.error(`Sync Google Calendar (${field}) échouée:`, (e as Error).message);
  }
}

// Édition rapide (clic droit sur le planning) d'une des 3 dates ponctuelles,
// avec son commentaire associé. `comment` non défini = on ne touche pas au
// commentaire existant ; chaîne (même vide) = on l'écrase.
export async function setDossierEventDate(
  id: number,
  field: DossierEventField,
  value: string | null,
  comment?: string | null,
  heure?: string | null,
  rappels?: number[] | null
) {
  const set: Record<string, unknown> = {
    [field]: value,
    updatedAt: new Date().toISOString(),
  };
  if (comment !== undefined) {
    set[EVENT_COMMENT_COL[field]] = comment ?? "";
  }
  // heure : undefined = on ne touche pas ; "HH:MM" stocké ; null/"" = 07:00 défaut.
  if (heure !== undefined) {
    set[EVENT_HEURE_COL[field]] = heure ? heure : null;
  }
  // rappels : undefined = on ne touche pas ; liste stockée en CSV ; vide = défaut.
  if (rappels !== undefined) {
    set[EVENT_RAPPELS_COL[field]] =
      rappels && rappels.length ? rappels.join(",") : null;
  }
  await db.update(dossiers).set(set).where(eq(dossiers.id, id));
  await syncDossierEvent(id, field);
  revalidateDossierViews(id);
}

// Édition rapide (clic droit sur le planning) de la PÉRIODE de chantier :
// début, fin et commentaire. Resynchronise l'événement « Chantier » Google.
export async function setDossierChantier(
  id: number,
  debut: string | null,
  fin: string | null,
  comment?: string | null
) {
  const set: Record<string, unknown> = {
    dateDebutChantier: debut,
    dateFinChantier: fin,
    updatedAt: new Date().toISOString(),
  };
  if (comment !== undefined) {
    set.commentaireChantier = comment ?? "";
  }
  await db.update(dossiers).set(set).where(eq(dossiers.id, id));
  await syncDossierCalendar(id);
  revalidateDossierViews(id);
}

// Édition rapide en ligne (liste des dossiers) : statut seul.
export async function setStatutDossier(id: number, statut: string) {
  await db
    .update(dossiers)
    .set({ statut, updatedAt: new Date().toISOString() })
    .where(eq(dossiers.id, id));
  revalidateDossierViews(id);
}

// Édition rapide en ligne (liste des dossiers) : flags seuls.
// flags est stocké en texte JSON (ex: '["Standby","Urgent"]').
export async function setFlagsDossier(id: number, flags: string[]) {
  const clean = [...new Set(flags.map((s) => s.trim()).filter(Boolean))];
  await db
    .update(dossiers)
    .set({ flags: JSON.stringify(clean), updatedAt: new Date().toISOString() })
    .where(eq(dossiers.id, id));
  revalidateDossierViews(id);
}

// Écrit / met à jour la classification « pièce » d'un dossier via un flag
// « piece:<type>|<quantité> » (écriveur de flag). piece vide = on retire la
// classification. Alimente « heures par pièce » du Rapport heures.
export async function setPieceDossier(
  id: number,
  piece: string,
  quantite: number
) {
  const [r] = await db
    .select({ flags: dossiers.flags })
    .from(dossiers)
    .where(eq(dossiers.id, id));
  let cur: string[] = [];
  try {
    const a = JSON.parse(r?.flags || "[]");
    cur = Array.isArray(a) ? a.map(String) : [];
  } catch {
    cur = [];
  }
  const next = withPieceFlag(cur, piece, quantite);
  await db
    .update(dossiers)
    .set({ flags: JSON.stringify(next), updatedAt: new Date().toISOString() })
    .where(eq(dossiers.id, id));
  revalidateDossierViews(id);
  revalidatePath("/rapports");
}

// ── Actions groupées (outil de sélection multiple sur la liste des dossiers) ──

// Applique un statut à plusieurs dossiers d'un coup.
export async function bulkSetStatut(ids: number[], statut: string) {
  if (ids.length === 0) return;
  await db
    .update(dossiers)
    .set({ statut, updatedAt: new Date().toISOString() })
    .where(inArray(dossiers.id, ids));
  revalidateDossierViews();
}

// Marque / retire « fiche atelier à imprimer » sur plusieurs dossiers.
export async function bulkSetEtapePrint(ids: number[], valeur: boolean) {
  if (ids.length === 0) return;
  await db
    .update(dossiers)
    .set({ etapePrint: valeur, updatedAt: new Date().toISOString() })
    .where(inArray(dossiers.id, ids));
  revalidateDossierViews();
}

// Ajoute et/ou retire des étiquettes sur plusieurs dossiers (fusion par
// dossier : on lit les flags existants, on ajoute `add`, on retire `remove`).
export async function bulkUpdateFlags(
  ids: number[],
  add: string[],
  remove: string[]
) {
  if (ids.length === 0) return;
  const rows = await db
    .select({ id: dossiers.id, flags: dossiers.flags })
    .from(dossiers)
    .where(inArray(dossiers.id, ids));
  for (const r of rows) {
    let cur: string[] = [];
    try {
      const a = JSON.parse(r.flags || "[]");
      cur = Array.isArray(a) ? a.map(String) : [];
    } catch {
      cur = [];
    }
    const set = new Set(cur.map((s) => s.trim()).filter(Boolean));
    for (const f of add) set.add(f.trim());
    for (const f of remove) set.delete(f.trim());
    await db
      .update(dossiers)
      .set({
        flags: JSON.stringify([...set].filter(Boolean)),
        updatedAt: new Date().toISOString(),
      })
      .where(eq(dossiers.id, r.id));
  }
  revalidateDossierViews();
}

// Bascule le flag « fiche atelier à imprimer / imprimée » (etapePrint).
export async function toggleEtapePrint(id: number, valeur: boolean) {
  await db
    .update(dossiers)
    .set({ etapePrint: valeur, updatedAt: new Date().toISOString() })
    .where(eq(dossiers.id, id));
  revalidateDossierViews(id);
}

// Supprime un dossier (les commandes liées sont détachées, les fiches et
// heures liées sont supprimées en cascade par la base). On retire d'abord les
// éventuels événements Google Agenda liés pour ne pas laisser d'orphelins.
export async function deleteDossier(id: number) {
  if (calendarConfigured()) {
    try {
      const [d] = await db.select().from(dossiers).where(eq(dossiers.id, id));
      if (d) {
        const ids = [
          d.googleEventId,
          d.googleEventIdEnlevement,
          d.googleEventIdLivraison,
          d.googleEventIdPriseCote,
        ].filter(Boolean) as string[];
        for (const eid of ids) {
          await deleteEvent(eid).catch(() => {});
        }
      }
    } catch (e) {
      console.error("Nettoyage agenda (suppression) échoué:", (e as Error).message);
    }
  }
  await db.delete(dossiers).where(eq(dossiers.id, id));
  revalidateDossierViews(id);
}

// Sous-type + places assises (colonnes hors Drizzle, voir lib/sous-types-db).
async function ecrireSousTypeForm(id: number, fd: FormData) {
  await ecrireSousType(
    id,
    String(fd.get("sousType") ?? ""),
    parsePlaces(fd.get("placesAssises"))
  );
}

// Ajout en direct d'un sous-type depuis le formulaire dossier. Renvoie le
// libellé retenu (vide si rien de valide).
export async function ajouterSousType(libelle: string): Promise<string> {
  return ajouterSousTypeDb(libelle);
}

// Crée un dossier puis redirige vers son détail.
export async function createDossier(fd: FormData) {
  const data = readForm(fd);
  const [row] = await db
    .insert(dossiers)
    .values(data)
    .returning({ id: dossiers.id });
  await ecrireSousTypeForm(row.id, fd);
  await syncDossierCalendar(row.id);
  for (const field of Object.keys(EVENT_CONFIG) as DossierEventField[]) {
    await syncDossierEvent(row.id, field);
  }
  revalidateDossierViews(row.id);
  redirect(`/dossiers/${row.id}`);
}

// Ligne de dossier issue d'un fichier CSV / Excel (déjà mappée côté client).
export type LigneDossierImport = Partial<
  Record<
    | "nomDossier"
    | "clientNom"
    | "telephone"
    | "email"
    | "adresse"
    | "typeIntervention"
    | "sousType"
    | "placesAssises"
    | "statut"
    | "dateOuverture"
    | "dateDevis"
    | "datePriseDeCote"
    | "dateEnlevementDepot"
    | "dateLivraison"
    | "heuresARealiser"
    | "lienDossierExterne"
    | "commentaires",
    string
  >
>;

// Import en masse depuis la liste des dossiers. Nom de dossier obligatoire
// (repli sur le nom du client). Un dossier dont le nom existe déjà (casse
// ignorée) est sauté pour qu'un ré-import ne crée pas de doublons. Seules les
// dates ponctuelles À VENIR sont poussées dans Google Agenda (un import
// d'historique ne remplit pas l'agenda d'événements passés).
export async function importDossiers(lignes: LigneDossierImport[]) {
  const existants = await db
    .select({ nom: dossiers.nomDossier })
    .from(dossiers);
  const vus = new Set(existants.map((d) => d.nom.trim().toLowerCase()));
  const aujourdhui = new Date().toISOString().slice(0, 10);
  const dateOk = (v: string) => (/^\d{4}-\d{2}-\d{2}$/.test(v) ? v : null);

  let importes = 0;
  let doublons = 0;
  let ignores = 0;
  let erreurs = 0;
  for (const l of lignes) {
    const t = (k: keyof LigneDossierImport) => (l[k] ?? "").toString().trim();
    const nom = t("nomDossier") || t("clientNom");
    if (!nom) {
      ignores++;
      continue;
    }
    if (vus.has(nom.toLowerCase())) {
      doublons++;
      continue;
    }
    const heures = parseNum(t("heuresARealiser"));
    try {
      const [row] = await db
        .insert(dossiers)
        .values({
          nomDossier: nom,
          clientNom: t("clientNom"),
          telephone: t("telephone"),
          email: t("email"),
          adresse: t("adresse"),
          typeIntervention: t("typeIntervention") || "Autre",
          statut: t("statut") || "Nouveau",
          dateOuverture: dateOk(t("dateOuverture")) ?? aujourdhui,
          dateDevis: dateOk(t("dateDevis")),
          datePriseDeCote: dateOk(t("datePriseDeCote")),
          dateEnlevementDepot: dateOk(t("dateEnlevementDepot")),
          dateLivraison: dateOk(t("dateLivraison")),
          heuresARealiser: heures && heures > 0 ? heures : 0,
          lienDossierExterne: t("lienDossierExterne"),
          commentaires: t("commentaires"),
        })
        .returning({ id: dossiers.id });
      vus.add(nom.toLowerCase());
      if (t("sousType") || t("placesAssises")) {
        await ecrireSousType(row.id, t("sousType"), parsePlaces(t("placesAssises")));
      }
      for (const field of Object.keys(EVENT_CONFIG) as DossierEventField[]) {
        const d = dateOk(t(field));
        if (d && d >= aujourdhui) await syncDossierEvent(row.id, field);
      }
      importes++;
    } catch (e) {
      console.error("Import dossier échoué:", nom, (e as Error).message);
      erreurs++;
    }
  }

  revalidateDossierViews();
  return { ok: importes > 0, importes, doublons, ignores, erreurs };
}

// Met à jour un dossier existant (id lié via .bind côté page).
export async function updateDossier(id: number, fd: FormData) {
  const data = readForm(fd);
  await db
    .update(dossiers)
    .set({ ...data, updatedAt: new Date().toISOString() })
    .where(eq(dossiers.id, id));
  await ecrireSousTypeForm(id, fd);
  await syncDossierCalendar(id);
  for (const field of Object.keys(EVENT_CONFIG) as DossierEventField[]) {
    await syncDossierEvent(id, field);
  }
  revalidateDossierViews(id);
  redirect(`/dossiers/${id}`);
}
