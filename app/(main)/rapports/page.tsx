import { and, asc, desc, eq, gt, gte, inArray, lte, sql } from "drizzle-orm";
import Link from "next/link";
import {
  AlertTriangle,
  BarChart3,
  ChevronRight,
  Clock,
  FolderOpen,
  Gauge,
} from "lucide-react";

import { db } from "@/db";
import { dossiers, fichesAtelier, heures, operateurs } from "@/db/schema";
import { ClosDossierRow } from "@/components/clos-dossier-row";
import { buildFicheSummary, type FicheSummary } from "@/lib/fiche-summary";
import { PageHeader } from "@/components/page-header";
import { OperateursWidget } from "@/components/operateurs-widget";
import { PieceClasseur } from "@/components/piece-classeur";
import type { TypeChartRow } from "@/components/types-chart";
import type { MoisRow, OpTotal } from "@/components/heures-dashboard";
import { DashCard } from "@/components/dash-card";
import {
  ChargeGauge,
  MoisOperateursChart,
  OperateursDonut,
  PiecesChart,
  PointeSaisiChart,
  ReelPrevuChart,
  SuiviDevisChart,
  TypesChart,
} from "@/components/charts-lazy";
import { RapportPdfBouton } from "@/components/rapport-pdf-bouton";
import { SmallBox } from "@/components/small-box";
import {
  heuresParOperateur,
  indicateursPeriode,
  raccourcisPeriode,
  reelVsPrevuParDossier,
} from "@/lib/rapport-heures";
import { parseFlags } from "@/lib/dossiers";
import {
  classerTexte,
  decodeQuantite,
  normalizeMeuble,
  parsePieceFlag,
} from "@/lib/piece-classifier";

export const dynamic = "force-dynamic";

const inputCls =
  "rounded-md border border-input bg-background px-3 py-1.5 text-sm focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring";

export default async function RapportsPage({
  searchParams,
}: {
  searchParams: { from?: string; to?: string; operateur?: string };
}) {
  const from = searchParams.from || "";
  const to = searchParams.to || "";
  const op = searchParams.operateur || "";

  // Filtres (dates en texte ISO -> comparaison lexicographique = chronologique).
  const conds = [];
  if (from) conds.push(gte(heures.date, from));
  if (to) conds.push(lte(heures.date, to));
  if (op) conds.push(eq(heures.operateur, op));
  const where = conds.length ? and(...conds) : undefined;

  // Bilan de la période (phase 6) : agrégats calculés en SQL.
  const filtre = { from, to, operateur: op };
  const [bilan, pointeSaisi, reelPrevu] = await Promise.all([
    indicateursPeriode(filtre),
    heuresParOperateur(filtre),
    reelVsPrevuParDossier(filtre),
  ]);
  const raccourcis = raccourcisPeriode();

  // Récap par mois (selon la date saisie) puis par opérateur.
  const totalExpr = sql<number>`coalesce(sum(${heures.heuresPassees}), 0)`;
  const moisExpr = sql<string>`substr(${heures.date}, 1, 7)`;
  let parOp = db
    .select({
      mois: moisExpr,
      operateur: heures.operateur,
      total: totalExpr,
      n: sql<number>`count(*)`,
    })
    .from(heures)
    .$dynamic();
  if (where) parOp = parOp.where(where);
  const lignes = await parOp
    .groupBy(moisExpr, heures.operateur)
    .orderBy(
      sql`substr(${heures.date}, 1, 7) desc`,
      sql`coalesce(sum(${heures.heuresPassees}), 0) desc`
    );

  // Récap par type de travail.
  let parType = db
    .select({ type: heures.typeTravail, total: totalExpr })
    .from(heures)
    .$dynamic();
  if (where) parType = parType.where(where);
  const types = await parType
    .groupBy(heures.typeTravail)
    .orderBy(sql`coalesce(sum(${heures.heuresPassees}), 0) desc`);

  // Récap PAR PIÈCE + classement des dossiers. Type de pièce résolu par ordre :
  // flag manuel « piece: » > type de réalisation saisi > champ meuble de la
  // fiche > détection sémantique dans le texte (nom/description/étapes).
  let hrsPieceQ = db
    .select({
      dossierId: heures.dossierId,
      typeRealisation: heures.typeRealisation,
      nombre: heures.nombre,
      h: heures.heuresPassees,
    })
    .from(heures)
    .$dynamic();
  if (where) hrsPieceQ = hrsPieceQ.where(where);
  const hrsPieceRows = await hrsPieceQ;

  // Par dossier : total heures + type de réalisation saisi (le 1er vu) + son nombre.
  const parDossierPiece = new Map<
    number,
    { h: number; tr: string | null; trNb: number }
  >();
  for (const r of hrsPieceRows) {
    const did = r.dossierId != null ? Number(r.dossierId) : null;
    if (did == null) continue;
    const cur = parDossierPiece.get(did) ?? { h: 0, tr: null, trNb: 0 };
    cur.h += Number(r.h) || 0;
    const tr = r.typeRealisation ? String(r.typeRealisation).trim() : "";
    if (tr) {
      cur.tr = cur.tr ?? tr;
      cur.trNb += Number(r.nombre) || 1;
    }
    parDossierPiece.set(did, cur);
  }

  const idsPiece = [...parDossierPiece.keys()];
  const [dInfos, fInfos] = idsPiece.length
    ? await Promise.all([
        db
          .select({
            id: dossiers.id,
            nom: dossiers.nomDossier,
            flags: dossiers.flags,
            type: dossiers.typeIntervention,
            commentaires: dossiers.commentaires,
          })
          .from(dossiers)
          .where(inArray(dossiers.id, idsPiece)),
        db
          .select({
            dossierId: fichesAtelier.dossierId,
            type: fichesAtelier.typeIntervention,
            contenu: fichesAtelier.contenuJson,
            notes: fichesAtelier.notesLibres,
          })
          .from(fichesAtelier)
          .where(inArray(fichesAtelier.dossierId, idsPiece)),
      ])
    : [[], []];
  const dInfoMap = new Map(dInfos.map((d) => [Number(d.id), d]));
  const fInfoMap = new Map<number, (typeof fInfos)[number]>();
  for (const f of fInfos) {
    const did = f.dossierId != null ? Number(f.dossierId) : null;
    if (did != null && !fInfoMap.has(did)) fInfoMap.set(did, f);
  }

  const aggPiece = new Map<string, { total: number; nb: number }>();
  const dossiersAClasser: {
    id: number;
    nom: string;
    heures: number;
    piece: string | null;
    quantite: number;
    source: "manuel" | "saisi" | "fiche" | "auto" | "aucun";
  }[] = [];

  for (const [did, agg] of parDossierPiece) {
    const d = dInfoMap.get(did);
    const f = fInfoMap.get(did);
    let contenu: Record<string, any> = {};
    try {
      contenu = f
        ? typeof f.contenu === "string"
          ? JSON.parse(f.contenu || "{}")
          : ((f.contenu as Record<string, any>) || {})
        : {};
    } catch {
      contenu = {};
    }
    const flags = d ? parseFlags(d.flags) : [];
    const manuel = parsePieceFlag(flags);
    const etapes = Array.isArray(contenu.etapes_custom)
      ? contenu.etapes_custom
          .map((e: any) => `${e.etape ?? ""} ${e.type ?? ""}`)
          .join(" ")
      : "";
    const texte = [
      d?.nom,
      d?.type,
      d?.commentaires,
      f?.type,
      contenu.meuble,
      contenu.type_store,
      contenu.description,
      contenu.observations,
      contenu.croquis,
      contenu.elements,
      f?.notes,
      etapes,
    ]
      .filter(Boolean)
      .join(" · ");
    const rawMeuble = String(contenu.meuble || contenu.type_store || "").trim();

    let piece: string | null = null;
    let quantite = 1;
    let source: (typeof dossiersAClasser)[number]["source"] = "aucun";
    if (manuel && manuel.piece) {
      piece = manuel.piece;
      quantite = manuel.quantite;
      source = "manuel";
    } else if (agg.tr) {
      piece = agg.tr;
      quantite = agg.trNb > 0 ? agg.trNb : 1;
      source = "saisi";
    } else if (rawMeuble) {
      piece = normalizeMeuble(rawMeuble, f?.type || d?.type || "");
      quantite = decodeQuantite(contenu, texte);
      source = "fiche";
    } else {
      const c = classerTexte(texte);
      if (c) {
        piece = c;
        quantite = decodeQuantite(contenu, texte);
        source = "auto";
      }
    }

    if (piece) {
      const cur = aggPiece.get(piece) ?? { total: 0, nb: 0 };
      cur.total += agg.h;
      cur.nb += quantite;
      aggPiece.set(piece, cur);
    }
    dossiersAClasser.push({
      id: did,
      nom: d?.nom ?? `#${did}`,
      heures: Math.round(agg.h * 10) / 10,
      piece,
      quantite,
      source,
    });
  }

  const pieces = [...aggPiece.entries()]
    .map(([type, v]) => ({
      type,
      total: v.total,
      nb: v.nb,
      parPiece: v.nb > 0 ? v.total / v.nb : 0,
    }))
    .filter((p) => p.nb > 0)
    .sort((a, b) => b.total - a.total);

  dossiersAClasser.sort((a, b) => b.heures - a.heures);

  const ops = await db
    .select({
      id: operateurs.id,
      nom: operateurs.nom,
      actif: operateurs.actif,
      heuresSemaine: operateurs.heuresSemaine,
      estDirigeant: operateurs.estDirigeant,
    })
    .from(operateurs)
    .orderBy(asc(operateurs.nom));
  const opsNoms = ops.map((o) => o.nom).filter(Boolean);

  // Dossiers terminés (statut « Clos ») : on les liste pour saisir leurs heures.
  // Pour chacun : heures estimées (heures_a_realiser) vs heures déjà saisies.
  const closDossiers = await db
    .select({
      id: dossiers.id,
      nom: dossiers.nomDossier,
      client: dossiers.clientNom,
      estime: dossiers.heuresARealiser,
      type: dossiers.typeIntervention,
    })
    .from(dossiers)
    .where(eq(dossiers.statut, "Clos"))
    .orderBy(desc(dossiers.id));

  // Fiches de travail des dossiers Clos → résumé pour l'aperçu (clic droit / œil).
  const closIds = closDossiers.map((d) => d.id);
  const fichesClos = closIds.length
    ? await db
        .select()
        .from(fichesAtelier)
        .where(inArray(fichesAtelier.dossierId, closIds))
    : [];
  const ficheSummaryByDossier = new Map<number, FicheSummary>();
  for (const f of fichesClos) {
    const did = f.dossierId != null ? Number(f.dossierId) : null;
    if (did == null || ficheSummaryByDossier.has(did)) continue;
    ficheSummaryByDossier.set(
      did,
      buildFicheSummary({
        id: f.id,
        type_intervention: f.typeIntervention,
        contenu_json: f.contenuJson,
        notes_libres: f.notesLibres,
      })
    );
  }

  // Somme des heures saisies par dossier (toutes périodes confondues).
  const sommes = await db
    .select({
      dossierId: heures.dossierId,
      total: sql<number>`coalesce(sum(${heures.heuresPassees}), 0)`,
    })
    .from(heures)
    .groupBy(heures.dossierId);
  const saisiParDossier = new Map<number, number>(
    sommes
      .filter((s) => s.dossierId != null)
      .map((s) => [Number(s.dossierId), Number(s.total)])
  );
  const aCompleter = closDossiers.filter(
    (d) => (saisiParDossier.get(d.id) ?? 0) === 0
  ).length;

  // Tri : dossiers « à compléter » (0 h saisie) en premier, puis plus récents.
  const closTries = [...closDossiers].sort((a, b) => {
    const aVide = (saisiParDossier.get(a.id) ?? 0) === 0 ? 0 : 1;
    const bVide = (saisiParDossier.get(b.id) ?? 0) === 0 ? 0 : 1;
    if (aVide !== bVide) return aVide - bVide;
    return b.id - a.id;
  });

  // Suivi des devis : dossiers dont les heures saisies approchent (« à risque »,
  // ≥ 90 %) ou dépassent les heures estimées (heures_a_realiser).
  // C'est « quand je dépasse » + « sur quoi ça pèche ».
  const SEUIL_RISQUE = 0.9; // 90 % du devis = alerte préventive
  const dossiersEstimes = await db
    .select({
      id: dossiers.id,
      nom: dossiers.nomDossier,
      client: dossiers.clientNom,
      estime: dossiers.heuresARealiser,
      statut: dossiers.statut,
    })
    .from(dossiers)
    .where(gt(dossiers.heuresARealiser, 0));
  const suivis = dossiersEstimes
    .map((d) => {
      const saisi = saisiParDossier.get(d.id) ?? 0;
      const estime = Number(d.estime ?? 0);
      const pct = estime > 0 ? Math.round((saisi / estime) * 100) : 0;
      const niveau: "depasse" | "risque" =
        saisi > estime ? "depasse" : "risque";
      return {
        id: d.id,
        nom: d.nom,
        client: d.client,
        statut: d.statut,
        saisi,
        estime,
        ecart: saisi - estime,
        pct,
        niveau,
      };
    })
    .filter((d) => d.estime > 0 && d.saisi >= d.estime * SEUIL_RISQUE)
    // Dépassés d'abord (par écart), puis « à risque » (par % décroissant).
    .sort((a, b) => {
      if (a.niveau !== b.niveau) return a.niveau === "depasse" ? -1 : 1;
      return a.niveau === "depasse" ? b.ecart - a.ecart : b.pct - a.pct;
    });
  // « Sur quoi ça pèche » par type de travail : pour les dossiers réellement
  // dépassés, on répartit leurs heures saisies par type (mêmes filtres période).
  const depIds = suivis.filter((d) => d.niveau === "depasse").map((d) => d.id);
  const depByType = new Map<string, number>();
  if (depIds.length > 0) {
    let q = db
      .select({ type: heures.typeTravail, total: totalExpr })
      .from(heures)
      .$dynamic();
    const condsDep = [inArray(heures.dossierId, depIds)];
    if (where) condsDep.push(where);
    q = q.where(and(...condsDep));
    const rows = await q.groupBy(heures.typeTravail);
    for (const r of rows) depByType.set(r.type ?? "—", Number(r.total));
  }
  const chartData: TypeChartRow[] = types.map((t) => {
    const label = t.type ?? "—";
    return {
      type: label,
      total: Number(t.total),
      depasse: depByType.get(label) ?? 0,
    };
  });

  const grandTotal = lignes.reduce((s, l) => s + Number(l.total), 0);

  // Charge de l'atelier : heures à réaliser des dossiers au statut « En atelier »
  // UNIQUEMENT, confrontées à la capacité mensuelle de l'atelier.
  const [atelierAgg] = await db
    .select({
      charge: sql<number>`coalesce(sum(${dossiers.heuresARealiser}), 0)`,
      n: sql<number>`count(*)`,
    })
    .from(dossiers)
    .where(eq(dossiers.statut, "En atelier"));
  const chargeAtelier = Number(atelierAgg?.charge ?? 0);
  const nAtelier = Number(atelierAgg?.n ?? 0);
  // Capacité mensuelle de l'atelier (h) = total des opérateurs (heures/sem × 4).
  // Valeur de référence fixe — modifier ICI si l'équipe change.
  const STOCK_ATELIER_MENSUEL = 560;
  const stockMois = STOCK_ATELIER_MENSUEL;
  const pctOccup =
    stockMois > 0 ? Math.round((chargeAtelier / stockMois) * 100) : 0;
  const surcharge = stockMois > 0 && chargeAtelier > stockMois;

  // Total des heures en dépassement (dossiers dont le réalisé excède l'estimé).
  const depassementTotal = suivis
    .filter((d) => d.niveau === "depasse")
    .reduce((s, d) => s + Math.max(0, d.ecart), 0);

  // Heures par opérateur rangées en listes par mois (mois → opérateurs).
  // lignes est déjà trié par mois décroissant, donc l'ordre d'insertion l'est.
  const parMois = new Map<string, { operateur: string; total: number }[]>();
  for (const l of lignes) {
    const arr = parMois.get(l.mois) ?? [];
    arr.push({ operateur: l.operateur, total: Number(l.total) });
    parMois.set(l.mois, arr);
  }
  // Données des graphiques. Opérateurs rangés par volume total (ordre = couleur).
  const totParOp = new Map<string, number>();
  for (const l of lignes) {
    const nom = l.operateur ?? "—";
    totParOp.set(nom, (totParOp.get(nom) ?? 0) + Number(l.total));
  }
  const opTotals: OpTotal[] = [...totParOp.entries()]
    .map(([operateur, total]) => ({ operateur, total }))
    .sort((a, b) => b.total - a.total);
  const ordreOps = opTotals.map((o) => o.operateur);
  // Mois en ordre chronologique pour l'axe X (parMois est décroissant).
  const moisRows: MoisRow[] = [...parMois.entries()].reverse().map(([mois, arr]) => {
    const row: MoisRow = { mois, label: formatMoisCourt(mois) };
    for (const o of arr) row[o.operateur ?? "—"] = Math.round(o.total * 10) / 10;
    return row;
  });

  return (
    <main className="container mx-auto max-w-6xl py-10">
      <PageHeader
        icon={BarChart3}
        tint="var(--brand-pink)"
        title="Rapport des heures"
      />

      {/* Filtres période / opérateur */}
      <form method="get" className="mt-4 flex flex-wrap items-end gap-2">
        <label className="flex flex-col gap-1 text-xs">
          <span className="text-muted-foreground">Du</span>
          <input name="from" type="date" defaultValue={from} className={inputCls} />
        </label>
        <label className="flex flex-col gap-1 text-xs">
          <span className="text-muted-foreground">Au</span>
          <input name="to" type="date" defaultValue={to} className={inputCls} />
        </label>
        <label className="flex flex-col gap-1 text-xs">
          <span className="text-muted-foreground">Opérateur</span>
          <select name="operateur" defaultValue={op} className={inputCls}>
            <option value="">Tous</option>
            {ops.map((o) => (
              <option key={o.nom} value={o.nom}>
                {o.nom}
              </option>
            ))}
          </select>
        </label>
        <button
          type="submit"
          className="rounded-md bg-primary px-3 py-1.5 text-sm font-medium text-primary-foreground hover:bg-primary/90"
        >
          Filtrer
        </button>
        {(from || to || op) && (
          <Link
            href="/rapports"
            className="text-sm text-muted-foreground hover:underline"
          >
            Réinitialiser
          </Link>
        )}
        {(from || to) && (
          <span className="ml-auto text-xs text-muted-foreground">
            Période : {from || "…"} → {to || "…"}
          </span>
        )}
      </form>
      <nav aria-label="Raccourcis de période" className="mt-2 flex flex-wrap gap-1.5">
        {raccourcis.map((r) => {
          const actif = r.from === from && r.to === to;
          const qs = new URLSearchParams({ from: r.from, to: r.to, ...(op ? { operateur: op } : {}) });
          return (
            <Link
              key={r.libelle}
              href={`/rapports?${qs}`}
              aria-current={actif ? "true" : undefined}
              className={`rounded-full border px-3 py-1 text-xs [@media(pointer:coarse)]:py-2 ${
                actif ? "border-foreground bg-foreground text-background" : "text-muted-foreground hover:bg-muted"
              }`}
            >
              {r.libelle}
            </Link>
          );
        })}
      </nav>

      {/* Chiffres clés (small-box AdminLTE) */}
      <div className="mt-4 grid grid-cols-2 gap-3 lg:grid-cols-4">
        <SmallBox
          value={`${Math.round(grandTotal * 10) / 10} h`}
          label="Total saisi"
          icon={Clock}
          ton="info"
          href="#mois"
        />
        <SmallBox
          value={`${pctOccup}%`}
          label="Charge atelier"
          icon={Gauge}
          ton={surcharge ? "danger" : pctOccup >= 80 ? "warning" : "success"}
          href="#charge"
        />
        <SmallBox
          value={`${Math.round(depassementTotal)} h`}
          label="Heures en dépassement"
          icon={AlertTriangle}
          ton={depassementTotal > 0 ? "danger" : "success"}
          href="#devis"
        />
        <SmallBox
          value={String(aCompleter)}
          label="Dossiers à compléter"
          icon={FolderOpen}
          ton={aCompleter > 0 ? "warning" : "success"}
          href="#saisie"
        />
      </div>

      {/* Bilan de la période : présence pointée, saisi, prévu vs réel. */}
      <DashCard
        id="bilan"
        title="Bilan de la période"
        subtitle={from || to ? `${from || "…"} → ${to || "…"}` : "toutes dates"}
        ton="navy"
        className="mt-4"
      >
        <dl className="grid grid-cols-2 gap-px bg-border sm:grid-cols-3 lg:grid-cols-6">
          {[
            {
              t: "Heures pointées",
              v: bilan.pointees == null ? "—" : heuresFr(bilan.pointees),
              d: "présence (jours travaillés)",
            },
            { t: "Saisies sur dossiers", v: heuresFr(bilan.saisies), d: "heures imputées" },
            { t: "Heures prévues", v: heuresFr(bilan.prevues), d: "dossiers travaillés" },
            { t: "Réel de ces dossiers", v: heuresFr(bilan.reelles), d: "cumul toutes dates" },
            {
              t: "Écart",
              v: `${bilan.ecart > 0 ? "+" : ""}${heuresFr(bilan.ecart)}`,
              d: bilan.ecart > 0 ? "au-delà du prévu" : "dans le prévu",
              alerte: bilan.ecart > 0,
            },
            {
              t: "Fiches à saisir",
              v: String(bilan.fichesASaisir),
              d: "fiches navettes",
              alerte: bilan.fichesASaisir > 0,
            },
          ].map((k) => (
            <div key={k.t} className="bg-card px-4 py-3">
              <dt className="text-xs text-muted-foreground">{k.t}</dt>
              <dd
                className={`mt-0.5 text-xl font-semibold tabular-nums ${k.alerte ? "text-destructive" : ""}`}
              >
                {k.v}
              </dd>
              <dd className="text-xs text-muted-foreground">{k.d}</dd>
            </div>
          ))}
        </dl>
      </DashCard>

      <div className="mt-4 grid gap-4 lg:grid-cols-5">
        <DashCard
          title="Réel vs prévu par dossier"
          subtitle="dossiers travaillés sur la période"
          ton="primary"
          className="lg:col-span-3"
        >
          <ReelPrevuChart data={reelPrevu} />
        </DashCard>
        <DashCard
          title="Présence et saisie"
          subtitle="par opérateur"
          ton="info"
          className="lg:col-span-2"
        >
          <PointeSaisiChart data={pointeSaisi} />
        </DashCard>
      </div>

      {reelPrevu.length > 0 && (
        <section className="mt-4 rounded-lg border">
          <details className="group">
            <summary className="flex cursor-pointer list-none items-center gap-2 border-b bg-muted/40 px-4 py-2 text-sm font-semibold [&::-webkit-details-marker]:hidden">
              <ChevronRight className="h-4 w-4 transition-transform group-open:rotate-90" />
              Rapports par dossier{" "}
              <span className="font-normal text-muted-foreground">
                · {reelPrevu.length} dossier{reelPrevu.length > 1 ? "s" : ""} · PDF enregistré
                dans les documents du dossier
              </span>
            </summary>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="text-left text-xs text-muted-foreground">
                  <tr className="border-b">
                    <th className="px-4 py-2 font-medium">Dossier</th>
                    <th className="px-2 py-2 text-right font-medium">Période</th>
                    <th className="px-2 py-2 text-right font-medium">Réel</th>
                    <th className="px-2 py-2 text-right font-medium">Prévu</th>
                    <th className="px-2 py-2 text-right font-medium">Écart</th>
                    <th className="px-4 py-2" />
                  </tr>
                </thead>
                <tbody className="divide-y">
                  {reelPrevu.map((d) => {
                    const ecart = d.reel - d.prevu;
                    return (
                      <tr key={d.id}>
                        <td className="px-4 py-2">
                          <Link href={`/dossiers/${d.id}`} className="font-medium hover:underline">
                            {d.nom}
                          </Link>
                          {d.client && (
                            <span className="block text-xs text-muted-foreground">{d.client}</span>
                          )}
                        </td>
                        <td className="px-2 py-2 text-right tabular-nums">{heuresFr(d.periode)}</td>
                        <td className="px-2 py-2 text-right tabular-nums">{heuresFr(d.reel)}</td>
                        <td className="px-2 py-2 text-right tabular-nums text-muted-foreground">
                          {d.prevu > 0 ? heuresFr(d.prevu) : "—"}
                        </td>
                        <td
                          className={`px-2 py-2 text-right tabular-nums ${
                            d.prevu > 0 && ecart > 0 ? "font-semibold text-destructive" : ""
                          }`}
                        >
                          {d.prevu > 0 ? `${ecart > 0 ? "+" : ""}${heuresFr(ecart)}` : "—"}
                        </td>
                        <td className="px-4 py-2 text-right">
                          <RapportPdfBouton dossierId={d.id} nom={d.nom} />
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </details>
        </section>
      )}

      <div className="mt-4 grid gap-4 lg:grid-cols-2">
        <DashCard id="charge" title="Charge de l’atelier" subtitle="vs capacité" ton="warning">
          <ChargeGauge
            charge={chargeAtelier}
            capacite={stockMois}
            nAtelier={nAtelier}
          />
        </DashCard>
        <DashCard title="Répartition par opérateur" subtitle="période" ton="info">
          <OperateursDonut data={opTotals} ordre={ordreOps} />
        </DashCard>
      </div>

      <DashCard
        id="mois"
        title="Heures par mois"
        subtitle="empilées par opérateur"
        ton="primary"
        className="mt-4"
      >
        <MoisOperateursChart data={moisRows} ordre={ordreOps} />
      </DashCard>

      <div className="mt-4 grid gap-4 lg:grid-cols-2">
        <DashCard title="Heures par type de travail" ton="navy">
          <TypesChart data={chartData} />
        </DashCard>
        <DashCard
          id="devis"
          title="Suivi des devis"
          subtitle="réalisé vs estimé (≥ 90 %)"
          ton="danger"
        >
          <SuiviDevisChart data={suivis.slice(0, 12)} />
        </DashCard>
      </div>

      <DashCard
        title="Temps moyen par pièce"
        subtitle="h / pièce, base de chiffrage"
        ton="success"
        className="mt-4"
      >
        <PiecesChart data={pieces} />
      </DashCard>

      {/* ── Bas de page : outils de saisie / gestion, repliés par défaut ── */}

      {/* Gestion des opérateurs (ex-page dédiée, désormais en widget) */}
      <div className="mt-6">
        <OperateursWidget ops={ops} />
      </div>


      {/* Saisie des heures : dossiers terminés (Clos) à compléter. Saisie inline
          (opérateur + heures) alimentant la table heures. Aperçu de la fiche au
          clic droit / bouton œil sur chaque ligne. Replié par défaut. */}
      <section id="saisie" className="mt-6 scroll-mt-6 rounded-lg border">
        <details className="group">
          <summary className="flex cursor-pointer list-none items-center justify-between border-b bg-muted/40 px-4 py-2 text-sm font-semibold [&::-webkit-details-marker]:hidden">
            <span className="flex items-center gap-2">
              <ChevronRight className="h-4 w-4 transition-transform group-open:rotate-90" />
              Saisie des heures{" "}
              <span className="font-normal text-muted-foreground">
                · dossiers terminés à compléter ({closDossiers.length})
              </span>
            </span>
            {aCompleter > 0 && (
              <span className="rounded-md bg-amber-100 px-2 py-0.5 text-xs font-medium text-amber-800">
                {aCompleter} à compléter
              </span>
            )}
          </summary>

          {closTries.length === 0 ? (
            <p className="px-4 py-4 text-sm text-muted-foreground">
              Aucun dossier au statut « Clos ».
            </p>
          ) : (
            <div className="divide-y">
              {closTries.map((d) => (
                <ClosDossierRow
                  key={d.id}
                  dossier={{
                    id: d.id,
                    nom: d.nom,
                    client: d.client,
                    estime: d.estime,
                    type: d.type,
                  }}
                  saisi={saisiParDossier.get(d.id) ?? 0}
                  summary={ficheSummaryByDossier.get(d.id) ?? null}
                  operateurs={opsNoms}
                />
              ))}
            </div>
          )}
        </details>
      </section>

      {/* Écriveur de flag : classer / corriger le type de pièce de chaque dossier
          ayant des heures (alimente « heures par pièce »). Replié par défaut. */}
      <section className="mt-4 rounded-lg border">
        <details className="group">
          <summary className="flex cursor-pointer list-none items-center justify-between border-b bg-muted/40 px-4 py-2 text-sm font-semibold [&::-webkit-details-marker]:hidden">
            <span className="flex items-center gap-2">
              <ChevronRight className="h-4 w-4 transition-transform group-open:rotate-90" />
              Classer les pièces{" "}
              <span className="font-normal text-muted-foreground">
                · {dossiersAClasser.length} dossier
                {dossiersAClasser.length > 1 ? "s" : ""} avec heures
              </span>
            </span>
          </summary>
          {dossiersAClasser.length === 0 ? (
            <p className="px-4 py-4 text-sm text-muted-foreground">
              Aucun dossier avec des heures sur cette période.
            </p>
          ) : (
            <PieceClasseur items={dossiersAClasser} />
          )}
        </details>
      </section>
    </main>
  );
}

const MOIS_FR = [
  "janvier", "février", "mars", "avril", "mai", "juin",
  "juillet", "août", "septembre", "octobre", "novembre", "décembre",
];
const heuresFr = (v: number) => `${String(Math.round(v * 10) / 10).replace(".", ",")} h`;

// "AAAA-MM" → "juil. 26" (axe des graphiques).
function formatMoisCourt(m: string): string {
  const [y, mm] = (m || "").split("-");
  const nom = MOIS_FR[Number(mm) - 1];
  if (!nom) return m;
  return `${nom.length > 4 ? nom.slice(0, 4) + "." : nom} ${y.slice(2)}`;
}
