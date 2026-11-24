import { and, count, desc, eq, ilike, inArray, isNotNull, or } from "drizzle-orm";
import { List } from "lucide-react";

import { db } from "@/db";
import { commandes, devisSignes, dossiers } from "@/db/schema";
import { DossierFiche } from "@/components/dossier-fiche";
import { DossierModal } from "@/components/dossier-modal";
import { DossiersImport } from "@/components/dossiers-import";
import { DossiersTable, type DossierRow } from "@/components/dossiers-table";
import { PageHeader } from "@/components/page-header";
import {
  normalizeStatut as fusionStatut,
  parseFlags,
  statutsEnBase,
  STATUTS_DOSSIER as STATUT_OPTIONS,
} from "@/lib/dossiers";
import { listerSousTypes } from "@/lib/sous-types-db";
import { dossierCompletion } from "@/lib/dossier-completion";

// Sur cet onglet, « Devis signé », « Validé » et « Devis signé / Validé » sont
// fusionnés sous un seul libellé, et « Lead » est fondu dans « Opportunité »
// (affichage et filtre), sans dépendre d'une migration en base.

// Données live : on ne met pas en cache (la base évolue).
export const dynamic = "force-dynamic";

const inputCls =
  "rounded-md border border-input bg-background px-3 py-1.5 text-sm focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring";

export default async function DossiersPage({
  searchParams,
}: {
  searchParams: { q?: string; statut?: string; type?: string; d?: string };
}) {
  const q = (searchParams.q || "").trim();
  const statut = searchParams.statut || "";
  const type = searchParams.type || "";
  const ficheId = Number(searchParams.d) || null;

  // Conditions de filtrage (combinées en ET).
  const conds = [];
  if (q)
    conds.push(
      or(ilike(dossiers.nomDossier, `%${q}%`), ilike(dossiers.clientNom, `%${q}%`))
    );
  if (statut)
    conds.push(
      inArray(dossiers.statut, statutsEnBase(fusionStatut(statut)))
    );
  if (type) conds.push(eq(dossiers.typeIntervention, type));

  let query = db.select().from(dossiers).$dynamic();
  if (conds.length) query = query.where(and(...conds));
  const rows = await query.orderBy(desc(dossiers.id));

  // Options de filtres (valeurs distinctes en base).
  const [statutsRows, typesRows, cmdCounts, devisRows] = await Promise.all([
    db.selectDistinct({ v: dossiers.statut }).from(dossiers),
    db.selectDistinct({ v: dossiers.typeIntervention }).from(dossiers),
    db
      .select({ dossierId: commandes.dossierId, n: count() })
      .from(commandes)
      .where(isNotNull(commandes.dossierId))
      .groupBy(commandes.dossierId),
    // Devis signés : id par dossier (dernier en premier) pour afficher, sur la
    // ligne du dossier, un accès direct au PDF via /api/devis/[id] (lien si un
    // seul, sinon vers la fiche).
    db
      .select({
        id: devisSignes.id,
        dossierId: devisSignes.dossierId,
      })
      .from(devisSignes)
      .where(isNotNull(devisSignes.dossierId))
      .orderBy(desc(devisSignes.id)),
  ]);
  const statuts = [
    ...new Set(
      statutsRows.map((r) => r.v).filter(Boolean).map((s) => fusionStatut(s!))
    ),
  ].sort();
  const types = typesRows.map((r) => r.v).filter(Boolean).sort() as string[];
  const cmdMap = new Map(cmdCounts.map((c) => [c.dossierId, c.n]));
  // dossierId -> { count, firstId }. Les lignes arrivent triées (dernier devis
  // en premier), donc firstId = le plus récent.
  const devisMap = new Map<number, { count: number; firstId: number }>();
  for (const r of devisRows) {
    if (r.dossierId == null) continue;
    const cur = devisMap.get(r.dossierId);
    if (cur) cur.count += 1;
    else devisMap.set(r.dossierId, { count: 1, firstId: r.id });
  }

  const filtre = q || statut || type;

  // Filtres courants de la liste : conservés quand on ouvre / ferme la fiche
  // en fenêtre (?d=<id>), pour revenir exactement à la même vue.
  const backQs = new URLSearchParams();
  if (q) backQs.set("q", q);
  if (statut) backQs.set("statut", statut);
  if (type) backQs.set("type", type);
  const backUrl = `/dossiers${backQs.toString() ? `?${backQs.toString()}` : ""}`;

  // Lignes préparées pour le tableau client (sélection multiple + actions
  // groupées). Le remplissage est calculé côté serveur.
  const tableRows: DossierRow[] = rows.map((d) => ({
    id: d.id,
    nomDossier: d.nomDossier,
    clientNom: d.clientNom,
    typeIntervention: d.typeIntervention,
    statut: fusionStatut(d.statut),
    flags: parseFlags(d.flags),
    heuresARealiser: d.heuresARealiser,
    cmdCount: cmdMap.get(d.id) ?? 0,
    completion: dossierCompletion(d),
    devisCount: devisMap.get(d.id)?.count ?? 0,
    devisFirstId: devisMap.get(d.id)?.firstId ?? null,
  }));

  return (
    <main className="container mx-auto py-10">
      <PageHeader
        className="mb-4"
        icon={List}
        tint="var(--brand-blue)"
        title="Dossiers"
        subtitle={`${rows.length} résultat${rows.length > 1 ? "s" : ""}${
          filtre ? " (filtré)" : ""
        }`}
        actions={
          <div className="flex flex-wrap items-center gap-2">
            <a
              href="/dossiers/nouveau#devis"
              className="inline-flex items-center rounded-md border px-3 py-1.5 text-sm font-medium hover:bg-accent"
              title="Créer un dossier client depuis le PDF du devis"
            >
              Depuis un devis (PDF)
            </a>
            <a
              href="/dossiers/nouveau"
              className="inline-flex items-center rounded-md bg-primary px-3 py-1.5 text-sm font-medium text-primary-foreground hover:bg-primary/90"
            >
              + Nouveau dossier
            </a>
          </div>
        }
      />

      {/* Import en masse depuis un fichier CSV / Excel (replié par défaut) */}
      <details className="mb-4 rounded-xl border">
        <summary className="cursor-pointer select-none bg-muted/40 px-4 py-2.5 text-sm font-semibold">
          Importer des dossiers
          <span className="ml-2 font-normal text-muted-foreground">
            Fichier CSV ou Excel (.xlsx, .xls) — une ligne par dossier
          </span>
        </summary>
        <DossiersImport listes={{ sousType: await listerSousTypes() }} />
      </details>

      {/* Barre de recherche / filtres (formulaire GET) */}
      <form method="get" className="mb-4 flex flex-wrap items-center gap-2">
        <input
          name="q"
          defaultValue={q}
          placeholder="Rechercher un nom ou un client…"
          className={`${inputCls} w-64`}
        />
        <select name="statut" defaultValue={statut} className={inputCls}>
          <option value="">Tous les statuts</option>
          {statuts.map((s) => (
            <option key={s} value={s}>
              {s}
            </option>
          ))}
        </select>
        <select name="type" defaultValue={type} className={inputCls}>
          <option value="">Tous les types</option>
          {types.map((t) => (
            <option key={t} value={t}>
              {t}
            </option>
          ))}
        </select>
        <button
          type="submit"
          className="rounded-md bg-primary px-3 py-1.5 text-sm font-medium text-primary-foreground hover:bg-primary/90"
        >
          Filtrer
        </button>
        {filtre ? (
          <a
            href="/dossiers"
            className="text-sm text-muted-foreground hover:underline"
          >
            Réinitialiser
          </a>
        ) : null}
      </form>

      <DossiersTable
        rows={tableRows}
        statutOptions={STATUT_OPTIONS}
        listeQs={backQs.toString()}
      />

      {/* Fiche ouverte en fenêtre depuis la liste (?d=<id>) */}
      {ficheId ? (
        <DossierModal key={ficheId} id={ficheId} closeHref={backUrl}>
          <DossierFiche id={ficheId} />
        </DossierModal>
      ) : null}
    </main>
  );
}
