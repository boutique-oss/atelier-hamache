import { NextRequest, NextResponse } from "next/server";

import { sql } from "@/lib/raw-sql";
import { normalizeStatut } from "@/lib/dossiers";
import { chargerMois } from "@/lib/pointage";
import { SOUS_TYPES_BASE } from "@/lib/sous-types";
import { listerSousTypes } from "@/lib/sous-types-db";

// Toujours l'état courant de la base (voir export-ebp pour le pourquoi).
export const dynamic = "force-dynamic";
export const fetchCache = "force-no-store";
export const revalidate = 0;

// Résumé de l'atelier pour le widget Rainmeter du bureau
// (Documents\Rainmeter\Skins\ERPAtelier).
//
// Accès : cette route est exclue du middleware (pas de cookie possible depuis
// Rainmeter). Elle exige à la place ?cle=<RAINMETER_TOKEN> (variable Vercel).
// Sans variable configurée, la route est fermée.
//
// Format : texte brut UTF-8, une info par ligne, champs séparés par « | »,
// facile à lire en Lua :
//   OK|<horodatage Paris>
//   ACTIFS|<nb dossiers ni clos ni perdus>
//   STAT|<statut>|<nb>
//   HEURES|<total semaine>          HEURES_OP|<opérateur>|<h>
//   CMD_ATTENTE|<nb>                CMD|<fournisseur>|<désignation>|<client>|<date cde>
//   EVT|<AAAA-MM-JJ>|<type>|<dossier>|<heure>|<id dossier>|<id commande>
//   CONGE|<opérateur>|<début>|<fin>|<type>|<statut>
//   STOCK_ATELIER|<h restantes>|<chiffre HT>|<nb dossiers>   (signés + en atelier)
//   PAIE|<salarié>|<stock d'heures>|<h sup. à payer ce mois>
//   SOUSTYPE|<libellé>   (liste des types de réalisation, ajout rapide)
// Refonte 2026-10 (tuiles + tendance, entonnoir, activité) :
//   NOUVEAUX|<créés cette semaine>|<semaine dernière>
//   OPP_NOUV|<opportunités créées cette semaine>|<semaine dernière>
//   HEURES_SEM|<lundi>|<h>          (8 semaines, la plus ancienne d'abord)
//   FOUR|<fournisseur>|<nb en cours>|<âge en jours de la plus ancienne, vide si aucune date>|<nb sans date>
//   CMDF|<fournisseur>|<désignation>|<client>|<âge en jours, vide si sans date>|<id dossier>|<id commande>
//        (articles commandés non reçus, même regroupement que FOUR)
//   CAP|<opérateur>|<contrat h/sem>|<h saisies cette semaine>   (actifs hors dirigeant)
//   JOURS_OUVRES|<1..5>   (jours ouvrés écoulés, pour le repère de la jauge)
//   OPP|<dossier>|<jours>   NV|<dossier>   CARNET|<dossier>|<h restantes>   (infobulles)
//   ACT|<id>|<dossier>|<statut>|<1 si créé, 0 si modifié>|<quand : « 2 h », « hier », « 14/10 »>

const JOURS_AGENDA = 14;
const JOURS_CONGES = 30;
const MAX_CMD = 8;

// Date du jour (AAAA-MM-JJ) à Paris — Vercel tourne en UTC.
function aujourdhuiParis(): string {
  return new Intl.DateTimeFormat("en-CA", { timeZone: "Europe/Paris" }).format(new Date());
}

function plusJours(iso: string, n: number): string {
  const d = new Date(`${iso}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() + n);
  return d.toISOString().slice(0, 10);
}

function lundiDe(iso: string): string {
  const d = new Date(`${iso}T00:00:00Z`);
  return plusJours(iso, -((d.getUTCDay() + 6) % 7));
}

// Un champ ne doit contenir ni séparateur ni saut de ligne.
function f(v: unknown): string {
  return String(v ?? "").replace(/[|\r\n]+/g, " ").trim();
}

function num(v: unknown): number {
  const n = typeof v === "number" ? v : Number(v);
  return Number.isFinite(n) ? n : 0;
}

type Dossier = {
  id: number;
  nom_dossier: string;
  date_prise_de_cote: string | null;
  heure_prise_cote: string | null;
  date_enlevement_depot: string | null;
  heure_enlevement: string | null;
  date_livraison: string | null;
  heure_livraison: string | null;
  date_debut_chantier: string | null;
  date_fin_chantier: string | null;
};

export async function GET(req: NextRequest) {
  const attendu = process.env.RAINMETER_TOKEN;
  const cle = req.nextUrl.searchParams.get("cle");
  if (!attendu || cle !== attendu) {
    return new NextResponse("ERREUR|Cle invalide\n", {
      status: 401,
      headers: { "Content-Type": "text/plain; charset=utf-8" },
    });
  }

  const jour = aujourdhuiParis();
  try {
    return await resume(jour);
  } catch (e) {
    console.error("[api/rainmeter]", e);
    return new NextResponse("ERREUR|Base injoignable\n", {
      status: 503,
      headers: { "Content-Type": "text/plain; charset=utf-8" },
    });
  }
}

async function resume(jour: string) {
  const finAgenda = plusJours(jour, JOURS_AGENDA - 1);
  const lundi = lundiDe(jour);
  const dimanche = plusJours(lundi, 6);
  const finConges = plusJours(jour, JOURS_CONGES);

  const [statuts, heuresOp, cmdCount, cmds, dossiers, conges, stockAtelier, mois, sousTypes] = await Promise.all([
    sql`SELECT statut, COUNT(*)::int AS n FROM dossiers
        WHERE statut NOT IN ('Clos', 'Perdu') GROUP BY statut`,
    sql`SELECT operateur, SUM(heures_passees) AS h FROM heures
        WHERE date >= ${lundi} AND date <= ${dimanche}
        GROUP BY operateur ORDER BY operateur`,
    sql`SELECT COUNT(*)::int AS n FROM commandes
        WHERE est_commande = true AND COALESCE(est_recu, false) = false`,
    sql`SELECT c.fournisseur, c.designation, COALESCE(NULLIF(c.client, ''), d.nom_dossier, '') AS client, c.date_cde
        FROM commandes c LEFT JOIN dossiers d ON d.id = c.dossier_id
        WHERE c.est_commande = true AND COALESCE(c.est_recu, false) = false
        ORDER BY c.id LIMIT ${MAX_CMD}`,
    sql`SELECT id, nom_dossier, date_prise_de_cote, heure_prise_cote,
               date_enlevement_depot, heure_enlevement, date_livraison, heure_livraison,
               date_debut_chantier, date_fin_chantier
        FROM dossiers
        WHERE statut NOT IN ('Clos', 'Perdu') AND (
          date_prise_de_cote BETWEEN ${jour} AND ${finAgenda}
          OR date_enlevement_depot BETWEEN ${jour} AND ${finAgenda}
          OR date_livraison BETWEEN ${jour} AND ${finAgenda}
          OR date_debut_chantier BETWEEN ${jour} AND ${finAgenda}
          OR date_fin_chantier BETWEEN ${jour} AND ${finAgenda})`,
    sql`SELECT operateur, date_debut, date_fin, type, statut FROM conges
        WHERE COALESCE(statut, '') <> 'Refusé'
          AND date_fin >= ${jour} AND date_debut <= ${finConges}
        ORDER BY date_debut, operateur`,
    // Carnet de l'atelier : dossiers signés ou en atelier. Heures restantes =
    // heures à réaliser − heures déjà passées ; chiffre = total HT du dernier
    // prédevis rattaché (les dossiers sans prédevis ne comptent pas).
    sql`SELECT COUNT(*)::int AS n,
               COALESCE(SUM(GREATEST(COALESCE(d.heures_a_realiser, 0) - COALESCE(h.passe, 0), 0)), 0) AS reste,
               COALESCE(SUM(p.total_ht), 0) AS chiffre
        FROM dossiers d
        LEFT JOIN (SELECT dossier_id, SUM(heures_passees) AS passe FROM heures GROUP BY dossier_id) h
          ON h.dossier_id = d.id
        LEFT JOIN LATERAL (SELECT total_ht FROM predevis WHERE dossier_id = d.id
          ORDER BY updated_at DESC NULLS LAST, id DESC LIMIT 1) p ON true
        WHERE d.statut IN ('Devis signé', 'Validé', 'En atelier')`,
    // Navette paie du mois : même calcul que la page Pointage. Facultatif —
    // une erreur ici (migration non lancée…) ne doit pas casser le widget.
    chargerMois(jour.slice(0, 7)).catch((e) => {
      console.error("[api/rainmeter] pointage", e);
      return null;
    }),
    listerSousTypes().catch(() => SOUS_TYPES_BASE),
  ]);

  // Refonte du widget : facultatif aussi — une requête en échec ne doit pas
  // masquer le reste du résumé.
  const lundiPrec = plusJours(lundi, -7);
  const debutSpark = plusJours(lundi, -7 * 7);
  // Fournisseur et date de commande normalisés, partagés par FOUR et CMDF.
  const cmdNonRecues = (rows: number) => sql`
        SELECT COALESCE(NULLIF(trim(c.fournisseur), ''), 'Sans fournisseur') AS four,
               COALESCE(NULLIF(trim(c.designation), ''), NULLIF(trim(c.reference), ''), '') AS designation,
               COALESCE(NULLIF(c.client, ''), d.nom_dossier, '') AS client, c.dossier_id, c.id,
               ${jour}::date - CASE
                 WHEN c.date_cde ~ '^[0-9]{4}-[0-9]{2}-[0-9]{2}' THEN substr(c.date_cde, 1, 10)::date
                 WHEN c.date_cde ~ '^[0-9]{2}/[0-9]{2}/[0-9]{4}' THEN to_date(substr(c.date_cde, 1, 10), 'DD/MM/YYYY')
               END AS age
        FROM commandes c LEFT JOIN dossiers d ON d.id = c.dossier_id
        WHERE c.est_commande = true AND COALESCE(c.est_recu, false) = false
        ORDER BY age DESC NULLS LAST, c.id
        LIMIT ${rows}`;
  const [nouveaux, heuresSem, parFour, activite, articles] = await Promise.all([
    sql`SELECT
          COUNT(*) FILTER (WHERE j >= ${lundi})::int AS cette,
          COUNT(*) FILTER (WHERE j < ${lundi})::int AS prec,
          COUNT(*) FILTER (WHERE j >= ${lundi} AND statut = 'Opportunité')::int AS opp_cette,
          COUNT(*) FILTER (WHERE j < ${lundi} AND statut = 'Opportunité')::int AS opp_prec
        FROM (SELECT (created_at AT TIME ZONE 'Europe/Paris')::date AS j, statut FROM dossiers) t
        WHERE j >= ${lundiPrec}::date AND j <= ${dimanche}::date`.catch(() => []),
    sql`SELECT to_char(date_trunc('week', date::date), 'YYYY-MM-DD') AS lundi, SUM(heures_passees) AS h
        FROM heures
        WHERE date ~ '^[0-9]{4}-[0-9]{2}-[0-9]{2}' AND date >= ${debutSpark} AND date <= ${dimanche}
        GROUP BY 1`.catch(() => []),
    // Date de commande au format ISO (AAAA-MM-JJ) ou français (JJ/MM/AAAA).
    sql`SELECT four, COUNT(*)::int AS n,
               MAX(${jour}::date - d) AS age,
               COUNT(*) FILTER (WHERE d IS NULL)::int AS sans_date
        FROM (SELECT COALESCE(NULLIF(trim(fournisseur), ''), 'Sans fournisseur') AS four,
                     CASE WHEN date_cde ~ '^[0-9]{4}-[0-9]{2}-[0-9]{2}' THEN substr(date_cde, 1, 10)::date
                          WHEN date_cde ~ '^[0-9]{2}/[0-9]{2}/[0-9]{4}' THEN to_date(substr(date_cde, 1, 10), 'DD/MM/YYYY')
                     END AS d
              FROM commandes WHERE est_commande = true AND COALESCE(est_recu, false) = false) c
        GROUP BY four
        ORDER BY MAX(${jour}::date - d) DESC NULLS LAST, COUNT(*) DESC
        LIMIT 30`.catch(() => []),
    sql`SELECT id, nom_dossier, statut,
               (updated_at IS NULL OR updated_at - created_at < interval '1 minute') AS cree,
               EXTRACT(EPOCH FROM (now() - COALESCE(updated_at, created_at)))::int AS il_y_a,
               to_char(COALESCE(updated_at, created_at) AT TIME ZONE 'Europe/Paris', 'DD/MM') AS le,
               to_char(COALESCE(updated_at, created_at) AT TIME ZONE 'Europe/Paris', 'YYYY-MM-DD') AS jour_maj
        FROM dossiers
        WHERE COALESCE(updated_at, created_at) IS NOT NULL
        ORDER BY COALESCE(updated_at, created_at) DESC
        LIMIT 5`.catch(() => []),
    cmdNonRecues(150).catch(() => []),
  ]);

  // Charge de la semaine + détails des infobulles (facultatifs aussi).
  const [capacite, opps, nouveauxNoms, carnet] = await Promise.all([
    sql`SELECT nom, heures_semaine FROM operateurs
        WHERE actif = true AND COALESCE(est_dirigeant, false) = false
        ORDER BY nom`.catch(() => []),
    sql`SELECT nom_dossier,
               ${jour}::date - (COALESCE(created_at, now()) AT TIME ZONE 'Europe/Paris')::date AS jours
        FROM dossiers WHERE statut = 'Opportunité'
        ORDER BY created_at ASC NULLS LAST LIMIT 8`.catch(() => []),
    sql`SELECT nom_dossier FROM dossiers
        WHERE (created_at AT TIME ZONE 'Europe/Paris')::date >= ${lundi}::date
        ORDER BY created_at DESC LIMIT 8`.catch(() => []),
    sql`SELECT d.nom_dossier,
               GREATEST(COALESCE(d.heures_a_realiser, 0) - COALESCE(h.passe, 0), 0) AS reste
        FROM dossiers d
        LEFT JOIN (SELECT dossier_id, SUM(heures_passees) AS passe FROM heures GROUP BY dossier_id) h
          ON h.dossier_id = d.id
        WHERE d.statut IN ('Devis signé', 'Validé', 'En atelier')
        ORDER BY reste DESC LIMIT 6`.catch(() => []),
  ]);

  const lignes: string[] = [];
  const maintenant = new Intl.DateTimeFormat("fr-FR", {
    timeZone: "Europe/Paris",
    dateStyle: "short",
    timeStyle: "short",
  }).format(new Date());
  lignes.push(`OK|${maintenant}|${jour}`);

  // Statuts : on fusionne « Devis signé » + « Validé » comme le reste de l'ERP.
  const parStatut = new Map<string, number>();
  for (const r of statuts) {
    const s = normalizeStatut(String(r.statut));
    parStatut.set(s, (parStatut.get(s) ?? 0) + num(r.n));
  }
  const actifs = Array.from(parStatut.values()).reduce((a, b) => a + b, 0);
  lignes.push(`ACTIFS|${actifs}`);
  Array.from(parStatut.entries())
    .sort((a, b) => b[1] - a[1])
    .forEach(([s, n]) => lignes.push(`STAT|${f(s)}|${n}`));

  const totalH = heuresOp.reduce((a, r) => a + num(r.h), 0);
  lignes.push(`HEURES|${totalH.toFixed(1)}|${lundi}`);
  for (const r of heuresOp) lignes.push(`HEURES_OP|${f(r.operateur)}|${num(r.h).toFixed(1)}`);

  lignes.push(`CMD_ATTENTE|${num(cmdCount[0]?.n)}`);
  for (const r of cmds) {
    lignes.push(`CMD|${f(r.fournisseur)}|${f(r.designation)}|${f(r.client)}|${f(r.date_cde)}`);
  }

  // Une ligne par date ponctuelle qui tombe dans la fenêtre.
  const evts: { date: string; type: string; nom: string; heure: string; id: number }[] = [];
  const dans = (d: string | null) => !!d && d >= jour && d <= finAgenda;
  for (const d of dossiers as Dossier[]) {
    const ajout = (date: string | null, type: string, heure: string | null) => {
      if (dans(date)) evts.push({ date: date!, type, nom: d.nom_dossier, heure: heure ?? "", id: d.id });
    };
    ajout(d.date_prise_de_cote, "Prise de cotes", d.heure_prise_cote);
    ajout(d.date_enlevement_depot, "Enlèvement", d.heure_enlevement);
    ajout(d.date_livraison, "Livraison", d.heure_livraison);
    ajout(d.date_debut_chantier, "Début chantier", null);
    if (d.date_fin_chantier !== d.date_debut_chantier) ajout(d.date_fin_chantier, "Fin chantier", null);
  }
  evts.sort((a, b) => (a.date + a.heure).localeCompare(b.date + b.heure));
  for (const e of evts) lignes.push(`EVT|${e.date}|${e.type}|${f(e.nom)}|${f(e.heure)}|${e.id}`);

  for (const r of conges) {
    lignes.push(`CONGE|${f(r.operateur)}|${f(r.date_debut)}|${f(r.date_fin)}|${f(r.type)}|${f(r.statut)}`);
  }

  const sa = stockAtelier[0] ?? {};
  lignes.push(`STOCK_ATELIER|${num(sa.reste).toFixed(1)}|${Math.round(num(sa.chiffre))}|${num(sa.n)}`);
  for (const s of mois?.salaries ?? []) {
    lignes.push(`PAIE|${f(s.nom)}|${s.stockFin.toFixed(2)}|${s.hsPayees.toFixed(2)}`);
  }

  for (const st of sousTypes) lignes.push(`SOUSTYPE|${f(st)}`);

  const nv = (nouveaux as Record<string, unknown>[])[0] ?? {};
  lignes.push(`NOUVEAUX|${num(nv.cette)}|${num(nv.prec)}`);
  lignes.push(`OPP_NOUV|${num(nv.opp_cette)}|${num(nv.opp_prec)}`);

  // 8 semaines, y compris celles sans heures saisies (0).
  const parLundi = new Map((heuresSem as Record<string, unknown>[]).map((r) => [String(r.lundi), num(r.h)]));
  for (let i = 7; i >= 0; i--) {
    const l = plusJours(lundi, -7 * i);
    lignes.push(`HEURES_SEM|${l}|${(parLundi.get(l) ?? 0).toFixed(1)}`);
  }

  for (const r of parFour as Record<string, unknown>[]) {
    const age = r.age == null ? "" : String(num(r.age));
    lignes.push(`FOUR|${f(r.four)}|${num(r.n)}|${age}|${num(r.sans_date)}`);
  }

  for (const r of articles as Record<string, unknown>[]) {
    const age = r.age == null ? "" : String(num(r.age));
    lignes.push(`CMDF|${f(r.four)}|${f(r.designation)}|${f(r.client)}|${age}|${r.dossier_id ?? ""}|${r.id}`);
  }

  // Capacité : contrat hebdo des opérateurs actifs (hors dirigeant) ; heures
  // saisies sur les dossiers cette semaine (même source que HEURES_OP).
  const hParOp = new Map(heuresOp.map((r) => [String(r.operateur), num(r.h)]));
  for (const r of capacite as Record<string, unknown>[]) {
    lignes.push(`CAP|${f(r.nom)}|${num(r.heures_semaine)}|${(hParOp.get(String(r.nom)) ?? 0).toFixed(1)}`);
  }
  // Jours ouvrés écoulés cette semaine (lundi = 1 … vendredi et week-end = 5).
  const jourSem = (new Date(`${jour}T00:00:00Z`).getUTCDay() + 6) % 7;
  lignes.push(`JOURS_OUVRES|${Math.min(jourSem + 1, 5)}`);
  for (const r of opps as Record<string, unknown>[]) lignes.push(`OPP|${f(r.nom_dossier)}|${num(r.jours)}`);
  for (const r of nouveauxNoms as Record<string, unknown>[]) lignes.push(`NV|${f(r.nom_dossier)}`);
  for (const r of carnet as Record<string, unknown>[]) lignes.push(`CARNET|${f(r.nom_dossier)}|${num(r.reste).toFixed(1)}`);

  const hier = plusJours(jour, -1);
  for (const r of activite as Record<string, unknown>[]) {
    const s = num(r.il_y_a);
    const j = String(r.jour_maj ?? "");
    const quand =
      s < 3600 ? `${Math.max(1, Math.round(s / 60))} min`
      : j === jour ? `${Math.round(s / 3600)} h`
      : j === hier ? "hier"
      : f(r.le);
    lignes.push(`ACT|${num(r.id)}|${f(r.nom_dossier)}|${f(normalizeStatut(String(r.statut ?? "")))}|${r.cree ? 1 : 0}|${quand}`);
  }

  lignes.push("FIN");
  return new NextResponse(lignes.join("\n") + "\n", {
    headers: { "Content-Type": "text/plain; charset=utf-8", "Cache-Control": "no-store" },
  });
}
