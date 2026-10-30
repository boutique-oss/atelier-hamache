import Link from "next/link";
import {
  BarChart3,
  Clock,
  FolderOpen,
  Package,
  Search,
  Users,
  ArrowRight,
  type LucideIcon,
} from "lucide-react";

import { PageHeader } from "@/components/page-header";
import { DocumentsDossier } from "@/components/documents-dossier";
import {
  compteursRubriques,
  lireDossierDocs,
  listerDossiersDocs,
  type CompteursRubriques,
} from "@/lib/documents-arbre";
import {
  listerCommandesDocs,
  optionsFiltresCommandes,
  STATUTS_COMMANDE,
  type StatutCommande,
} from "@/lib/documents-commandes";
import { normalizeStatut, statutClasses } from "@/lib/dossiers";
import { cn } from "@/lib/utils";

import { lireFiche, listerFiches } from "@/lib/fiches-navettes";
import type { StatutFicheNavette } from "@/lib/documents-db";

import { FiltresCommandesForm, TableauCommandes } from "./rubrique-commandes";
import { FicheNavetteVue, ListeFichesNavettes } from "./rubrique-pointages";

export const dynamic = "force-dynamic";

// Page Documents : rubriques à gauche (Clients, Commandes, Pointages ;
// Rapports d'heures renvoie vers /rapports). Clients : liste des dossiers filtrable puis l'arborescence du
// dossier choisi. Commandes : commandes fournisseur filtrables avec leurs
// pièces jointes. `?dossier=` est partagé : dossier ouvert côté Clients,
// filtre par dossier côté Commandes. Les URL /documents/<imprimable> (prédevis vierge, bon de
// commande…) vivent hors de ce layout, dans app/documents/.

const RUBRIQUES: {
  cle: keyof CompteursRubriques;
  libelle: string;
  icon: LucideIcon;
  tint: string;
  active: boolean;
  /** Rubrique tenue par une autre page de l'ERP (lien direct). */
  href?: string;
}[] = [
  { cle: "clients", libelle: "Clients", icon: Users, tint: "var(--brand-blue)", active: true },
  { cle: "commandes", libelle: "Commandes", icon: Package, tint: "var(--brand-orange)", active: true },
  { cle: "heures", libelle: "Rapports d'heures", icon: BarChart3, tint: "var(--brand-pink)", active: true, href: "/rapports" },
  { cle: "pointages", libelle: "Pointages", icon: Clock, tint: "var(--brand-violet)", active: true },
];

export default async function DocumentsPage({
  searchParams,
}: {
  searchParams: {
    rubrique?: string;
    dossier?: string;
    q?: string;
    statut?: string;
    fournisseur?: string;
    fiche?: string;
    du?: string;
    au?: string;
    pj?: string;
  };
}) {
  const rubrique =
    searchParams.rubrique === "commandes" || searchParams.rubrique === "pointages"
      ? searchParams.rubrique
      : "clients";
  const clients = rubrique === "clients";
  const commandes = rubrique === "commandes";
  const pointages = rubrique === "pointages";
  const statutFiche = (["a_saisir", "verifiee", "integree"].includes(searchParams.statut ?? "")
    ? searchParams.statut
    : "") as StatutFicheNavette | "";
  const ficheId = Number(searchParams.fiche);
  const aFiche = pointages && Number.isInteger(ficheId) && ficheId > 0;
  const q = (searchParams.q || "").slice(0, 100);
  const choisiId = Number(searchParams.dossier);
  const aChoisi = Number.isFinite(choisiId) && choisiId > 0;
  const filtres = {
    statut: (STATUTS_COMMANDE.some((s) => s.cle === searchParams.statut)
      ? searchParams.statut
      : "") as StatutCommande | "",
    fournisseur: (searchParams.fournisseur || "").slice(0, 100),
    dossierId: aChoisi ? choisiId : null,
    q: commandes ? q : "",
    du: (searchParams.du || "").slice(0, 10),
    au: (searchParams.au || "").slice(0, 10),
    pj: (searchParams.pj === "avec" || searchParams.pj === "sans" ? searchParams.pj : "") as "" | "avec" | "sans",
  };

  const [compteurs, dossiers, choisi, cmds, options, fiches, fiche] = await Promise.all([
    compteursRubriques().catch(() => null),
    clients ? listerDossiersDocs(q) : Promise.resolve([]),
    clients && aChoisi ? lireDossierDocs(choisiId) : Promise.resolve(null),
    commandes ? listerCommandesDocs(filtres) : Promise.resolve(null),
    commandes ? optionsFiltresCommandes() : Promise.resolve(null),
    pointages ? listerFiches(statutFiche) : Promise.resolve(null),
    aFiche ? lireFiche(ficheId) : Promise.resolve(null),
  ]);
  const ouvert = Boolean(choisi || fiche);

  // Lien d'une rubrique : le dossier choisi est conservé (il devient le
  // filtre par dossier côté Commandes, et inversement).
  const lienRubrique = (cle: string) => {
    const p = new URLSearchParams();
    if (cle !== "clients") p.set("rubrique", cle);
    if (aChoisi) p.set("dossier", String(choisiId));
    const s = p.toString();
    return s ? `/documents?${s}` : "/documents";
  };

  const lienDossier = (id: number) => {
    const p = new URLSearchParams({ dossier: String(id) });
    if (q) p.set("q", q);
    return `/documents?${p.toString()}`;
  };

  return (
    <main className="mx-auto max-w-7xl px-4 py-8 sm:px-6 sm:py-10">
      <PageHeader
        className="mb-6"
        icon={FolderOpen}
        tint="var(--brand-blue)"
        eyebrow="Classement"
        title="Documents"
        subtitle="Tous les fichiers d'un dossier client, rangés par catégorie et sous-dossier"
      />

      <div className="grid gap-6 lg:grid-cols-[270px_minmax(0,1fr)]">
        {/* Colonne gauche : rubriques + filtre + dossiers. Sur téléphone, elle
            passe sous le dossier ouvert pour qu'on voie d'abord ses fichiers. */}
        <aside className={cn("space-y-4", ouvert && "order-2 lg:order-1")}>
          <nav aria-label="Rubriques" className="overflow-hidden rounded-lg border bg-card">
            <ul className="divide-y">
              {RUBRIQUES.map(({ cle, libelle, icon: Icon, tint, active, href }) => {
                const courante = cle === rubrique;
                const contenu = (
                  <>
                    <span
                      className="flex h-7 w-7 shrink-0 items-center justify-center rounded-md"
                      style={{
                        backgroundColor: `hsl(${tint} / ${active ? 0.2 : 0.1})`,
                        color: `hsl(${tint})`,
                      }}
                    >
                      <Icon size={15} aria-hidden />
                    </span>
                    <span className="min-w-0 flex-1 truncate">{libelle}</span>
                    {active ? (
                      <span className="tabular-nums text-xs text-muted-foreground">
                        {compteurs ? compteurs[cle] : "—"}
                      </span>
                    ) : (
                      <span className="rounded bg-muted px-1.5 py-0.5 text-[11px] font-medium text-muted-foreground">
                        Bientôt
                      </span>
                    )}
                  </>
                );
                return (
                  <li key={cle}>
                    {active ? (
                      <Link
                        href={href ?? lienRubrique(cle)}
                        aria-current={courante ? "page" : undefined}
                        style={{ borderLeftColor: courante ? "#F26A21" : "transparent" }}
                        className={cn(
                          "flex items-center gap-3 border-l-2 px-3 py-2.5 text-sm transition-colors [@media(pointer:coarse)]:py-3",
                          courante ? "bg-foreground/[0.07] font-medium" : "hover:bg-foreground/5"
                        )}
                      >
                        {contenu}
                      </Link>
                    ) : (
                      <div className="flex items-center gap-3 border-l-2 border-transparent px-3 py-2.5 text-sm text-muted-foreground">
                        {contenu}
                      </div>
                    )}
                  </li>
                );
              })}
            </ul>
          </nav>

          {pointages && fiches ? (
            <ListeFichesNavettes fiches={fiches} statut={statutFiche} ficheId={aFiche ? ficheId : null} />
          ) : commandes && options ? (
            <FiltresCommandesForm
              filtres={filtres}
              fournisseurs={options.fournisseurs}
              dossiers={options.dossiers}
            />
          ) : (
            <>
              <form role="search" className="flex gap-2">
                {aChoisi && <input type="hidden" name="dossier" value={choisiId} />}
                <label className="relative flex-1">
                  <span className="sr-only">Filtrer les dossiers</span>
                  <Search
                    size={15}
                    aria-hidden
                    className="pointer-events-none absolute left-2.5 top-1/2 -translate-y-1/2 text-muted-foreground"
                  />
                  <input
                    name="q"
                    defaultValue={q}
                    placeholder="Dossier ou client…"
                    className="h-9 w-full rounded-md border border-input bg-background pl-8 pr-2 text-sm [@media(pointer:coarse)]:h-11"
                  />
                </label>
                <button
                  type="submit"
                  className="h-9 rounded-md border border-input bg-background px-3 text-sm font-medium hover:bg-accent [@media(pointer:coarse)]:h-11"
                >
                  Filtrer
                </button>
              </form>

              <div className="overflow-hidden rounded-lg border bg-card">
                <p className="flex items-center justify-between border-b bg-muted/40 px-3 py-2 text-xs font-medium text-muted-foreground">
                  <span>Dossiers clients</span>
                  <span className="tabular-nums">{dossiers.length}</span>
                </p>
                {dossiers.length === 0 ? (
                  <p className="px-3 py-6 text-center text-sm text-muted-foreground">
                    {q ? `Aucun dossier ne correspond à « ${q} ».` : "Aucun dossier."}
                  </p>
                ) : (
                  <ul className="max-h-[60vh] divide-y overflow-y-auto">
                    {dossiers.map((d) => {
                      const actif = choisi?.id === d.id;
                      return (
                        <li key={d.id}>
                          <Link
                            href={lienDossier(d.id)}
                            aria-current={actif ? "page" : undefined}
                            style={{ borderLeftColor: actif ? "#F26A21" : "transparent" }}
                            className={cn(
                              "block border-l-2 px-3 py-2 transition-colors [@media(pointer:coarse)]:py-3",
                              actif ? "bg-foreground/[0.07]" : "hover:bg-foreground/5"
                            )}
                          >
                            <span className="flex items-center gap-2">
                              <span className="min-w-0 flex-1 truncate text-sm font-medium">{d.nom}</span>
                              <span className="tabular-nums text-xs text-muted-foreground">
                                {d.nbFichiers}
                              </span>
                            </span>
                            <span className="mt-1 flex items-center gap-2">
                              <span className="min-w-0 flex-1 truncate text-xs text-muted-foreground">
                                {d.client || "—"}
                              </span>
                              <span className={cn("shrink-0 rounded px-1.5 py-0.5 text-[11px] font-medium", statutClasses(d.statut))}>
                                {normalizeStatut(d.statut)}
                              </span>
                            </span>
                          </Link>
                        </li>
                      );
                    })}
                  </ul>
                )}
              </div>
            </>
          )}
        </aside>

        {/* Commandes, ou dossier choisi */}
        <section className={cn("min-w-0", ouvert && "order-1 lg:order-2")}>
          {pointages ? (
            <FicheNavetteVue fiche={fiche} />
          ) : cmds ? (
            <>
              <h2 className="brand-display mb-4 text-lg">
                Commandes fournisseur{" "}
                <span className="text-sm font-normal text-muted-foreground">
                  ({cmds.commandes.length}
                  {cmds.tronque ? "+" : ""})
                </span>
              </h2>
              <TableauCommandes commandes={cmds.commandes} tronque={cmds.tronque} />
            </>
          ) : choisi ? (
            <>
              <div className="mb-4 flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
                <div className="min-w-0">
                  <h2 className="brand-display truncate text-lg">{choisi.nom}</h2>
                  <p className="mt-1 flex flex-wrap items-center gap-2 text-sm text-muted-foreground">
                    {choisi.client && <span>{choisi.client}</span>}
                    <span className={cn("rounded px-1.5 py-0.5 text-xs font-medium", statutClasses(choisi.statut))}>
                      {normalizeStatut(choisi.statut)}
                    </span>
                  </p>
                </div>
                <Link
                  href={`/dossiers/${choisi.id}?back=${encodeURIComponent(lienDossier(choisi.id))}`}
                  className="inline-flex shrink-0 items-center gap-1.5 self-start rounded-md border border-input bg-background px-3 py-2 text-sm font-medium hover:bg-accent"
                >
                  Ouvrir la fiche dossier <ArrowRight size={14} aria-hidden />
                </Link>
              </div>
              <DocumentsDossier dossierId={choisi.id} />
            </>
          ) : (
            <div className="rounded-lg border border-dashed px-6 py-16 text-center">
              <FolderOpen size={28} aria-hidden className="mx-auto text-muted-foreground" />
              <p className="mt-3 text-sm font-medium">
                {aChoisi ? "Ce dossier n'existe plus." : "Choisissez un dossier client"}
              </p>
              <p className="mt-1 text-sm text-muted-foreground">
                Ses fichiers s&apos;affichent ici, classés par catégorie.
              </p>
            </div>
          )}
        </section>
      </div>
    </main>
  );
}
