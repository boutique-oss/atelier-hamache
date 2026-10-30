import { asc, eq, sql } from "drizzle-orm";
import Link from "next/link";
import { ChevronDown, FileText, Package, TrendingUp } from "lucide-react";

import { db } from "@/db";
import { commandes, dossiers, fournisseurs } from "@/db/schema";
import { DateInline, ToggleCheck } from "@/components/commande-checks";
import { CommandeForm } from "@/components/commande-form";
import {
  CommandeEditDialog,
  type CommandeLigne,
} from "@/components/commande-edit-dialog";
import type { DossierOption } from "@/components/commande-fields";
import { CommandesImport } from "@/components/commandes-import";
import { CommandesImportPdf } from "@/components/commandes-import-pdf";
import { importsParCommande, listerImports } from "@/lib/commande-imports-db";
import { FournisseursChart } from "@/components/charts-lazy";
import type { FournisseurRow } from "@/components/fournisseurs-chart";
import { PageHeader } from "@/components/page-header";
import {
  articlesRecents,
  type ArticleRecent,
  setCommandeDateLivraison,
  toggleCommandeFlag,
} from "@/app/commandes/actions";

// Données live : pas de cache.
export const dynamic = "force-dynamic";

type Ligne = CommandeLigne & { dossierNom: string | null };

export default async function RapportCommandesPage() {
  const rows: Ligne[] = await db
    .select({
      id: commandes.id,
      fournisseur: commandes.fournisseur,
      designation: commandes.designation,
      reference: commandes.reference,
      coloris: commandes.coloris,
      client: commandes.client,
      qte: commandes.qte,
      unite: commandes.unite,
      montant: commandes.montant,
      commentaires: commandes.commentaires,
      dateCde: commandes.dateCde,
      dateLivraison: commandes.dateLivraison,
      estCommande: commandes.estCommande,
      estRecu: commandes.estRecu,
      dossierId: commandes.dossierId,
      dossierNom: dossiers.nomDossier,
    })
    .from(commandes)
    .leftJoin(dossiers, eq(commandes.dossierId, dossiers.id));

  // Fournisseurs connus (annuaire catalogue) pour la liste déroulante de saisie.
  const noms = await db
    .select({ nom: fournisseurs.nom })
    .from(fournisseurs)
    .orderBy(asc(fournisseurs.nom));
  const listeFournisseurs = noms.map((f) => f.nom);

  // Listes déroulantes du modèle Excel d'import : unités déjà employées
  // (+ « ml » par défaut) et noms des dossiers pour le rattachement.
  const unitesRows = await db
    .selectDistinct({ u: sql<string>`trim(${commandes.unite})` })
    .from(commandes);
  const listeUnites = [
    ...new Set(["ml", ...unitesRows.map((r) => r.u).filter(Boolean)]),
  ].sort();
  const dossiersNoms = await db
    .select({ id: dossiers.id, nom: dossiers.nomDossier, client: dossiers.clientNom })
    .from(dossiers)
    .orderBy(asc(dossiers.nomDossier));
  const listeDossiers = [...new Set(dossiersNoms.map((d) => d.nom.trim()))];
  // Dossiers proposés pour lier une commande à un client (saisie + modif).
  const dossiersOptions: DossierOption[] = dossiersNoms.map((d) => ({
    id: d.id,
    nom: d.nom.trim(),
    client: d.client?.trim() || null,
  }));
  const recents = await articlesRecents();

  // PDF fournisseurs importés : liste par fournisseur + lien commande → PDF.
  const [importsPdf, pdfParCommande] = await Promise.all([
    listerImports().catch(() => []),
    importsParCommande().catch(() => new Map<number, number>()),
  ]);
  const importsParFournisseur = new Map<string, typeof importsPdf>();
  for (const imp of importsPdf) {
    const k = imp.fournisseur.trim();
    importsParFournisseur.set(k, [...(importsParFournisseur.get(k) ?? []), imp]);
  }

  // Par fournisseur : où en sont les lignes (à commander / à recevoir /
  // reçu), regroupées sur le nom (espaces normalisés, casse ignorée). Les
  // fournisseurs qui demandent une action passent devant : d'abord le plus de
  // lignes en cours, puis le plus de lignes au total. Top 15.
  const aujourdhui = new Date().toISOString().slice(0, 10);
  const parFournisseurMap = new Map<string, FournisseurRow>();
  for (const r of rows) {
    const nom = (r.fournisseur || "").trim().replace(/\s+/g, " ");
    if (!nom) continue;
    const cle = nom.toLowerCase();
    const f =
      parFournisseurMap.get(cle) ??
      { label: nom, aCommander: 0, aRecevoir: 0, enRetard: 0, recu: 0, total: 0 };
    if (!r.estCommande) f.aCommander++;
    else if (!r.estRecu) {
      f.aRecevoir++;
      if (r.dateLivraison && r.dateLivraison < aujourdhui) f.enRetard++;
    } else f.recu++;
    f.total += Number(r.montant) || 0;
    parFournisseurMap.set(cle, f);
  }
  const nbFournisseurs = parFournisseurMap.size;
  const parFournisseur = [...parFournisseurMap.values()]
    .sort(
      (a, b) =>
        b.aCommander + b.aRecevoir - (a.aCommander + a.aRecevoir) ||
        b.aCommander + b.aRecevoir + b.recu - (a.aCommander + a.aRecevoir + a.recu) ||
        a.label.localeCompare(b.label, "fr")
    )
    .slice(0, 15);
  const nbLignes = rows.length;

  // À commander : pas encore marquées « commandé ».
  const aCommander = rows.filter((r) => !r.estCommande);
  // À recevoir : commandées mais pas encore reçues.
  const aRecevoir = rows.filter((r) => r.estCommande && !r.estRecu);
  // Archive : commandées ET reçues (traitées). Décocher « Reçu » les ressort.
  const archive = rows.filter((r) => r.estCommande && r.estRecu);

  return (
    <main className="mx-auto max-w-5xl px-6 py-10">
      <PageHeader
        className="mb-6"
        icon={Package}
        tint="var(--brand-orange)"
        title="Rapport des commandes"
        subtitle="À commander et à recevoir"
      />

      {/* Saisie d'une fourniture atelier (sans dossier) */}
      <section className="mb-6 rounded-xl border">
        <h2 className="border-b bg-muted/40 px-4 py-2.5 text-sm font-semibold">
          Ajouter une commande
          <span className="ml-2 font-normal text-muted-foreground">
            Liée à un dossier client, ou fourniture d&apos;atelier (champ client vide)
          </span>
        </h2>
        <CommandeForm
          fournisseurs={listeFournisseurs}
          recents={recents}
          dossiers={dossiersOptions}
        />
      </section>

      {/* Import en masse depuis un fichier CSV / Excel */}
      <section className="mb-6 rounded-xl border">
        <h2 className="border-b bg-muted/40 px-4 py-2.5 text-sm font-semibold">
          Importer des commandes
          <span className="ml-2 font-normal text-muted-foreground">
            Fichier CSV ou Excel (.xlsx, .xls) — une ligne par commande
          </span>
        </h2>
        <CommandesImport
          listes={{
            fournisseur: listeFournisseurs,
            unite: listeUnites,
            dossier: listeDossiers,
          }}
        />
      </section>

      {/* Import d'un PDF fournisseur (accusé de réception / bon de commande) */}
      <section className="mb-6 rounded-xl border">
        <h2 className="border-b bg-muted/40 px-4 py-2.5 text-sm font-semibold">
          Importer un PDF fournisseur
          <span className="ml-2 font-normal text-muted-foreground">
            Réf, désignation, coloris et métrage lus dans le PDF, à vérifier avant création
          </span>
        </h2>
        <CommandesImportPdf
          fournisseurs={listeFournisseurs}
          dossiers={dossiersOptions}
        />
      </section>

      {/* PDF déjà importés, regroupés par fournisseur */}
      {importsPdf.length > 0 && (
        <details className="mb-6 rounded-xl border" open>
          <summary className="cursor-pointer select-none bg-muted/40 px-4 py-2.5 text-sm font-semibold">
            PDF importés{" "}
            <span className="text-muted-foreground">({importsPdf.length})</span>
            <span className="ml-2 font-normal text-muted-foreground">
              par fournisseur — cliquer pour relire le PDF
            </span>
          </summary>
          <div className="divide-y">
            {[...importsParFournisseur].map(([fourn, liste]) => (
              <div key={fourn} className="px-4 py-2.5 text-sm">
                <div className="mb-1 font-medium">{fourn || "Fournisseur ?"}</div>
                <ul className="space-y-2">
                  {liste.map((imp) => {
                    // Lignes de commande issues de ce PDF (état + modification).
                    const lignesPdf = rows.filter(
                      (r) => pdfParCommande.get(r.id) === imp.id
                    );
                    const nbRecues = lignesPdf.filter((r) => r.estRecu).length;
                    return (
                      <li key={imp.id}>
                        <details open={lignesPdf.some((r) => !r.estRecu)}>
                          <summary className="flex cursor-pointer flex-wrap items-center gap-x-3 gap-y-0.5">
                            <a
                              href={`/api/commandes-import/${imp.id}`}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="inline-flex items-center gap-1 text-primary hover:underline"
                            >
                              <FileText size={14} /> {imp.nomFichier}
                            </a>
                            <span className="text-xs text-muted-foreground">
                              {imp.createdAt
                                ? new Date(imp.createdAt).toLocaleDateString("fr-FR")
                                : ""}{" "}
                              · {lignesPdf.length} ligne{lignesPdf.length > 1 ? "s" : ""} ·{" "}
                              {nbRecues}/{lignesPdf.length} reçue{nbRecues > 1 ? "s" : ""}
                            </span>
                            <a
                              href={`/api/commandes-import/${imp.id}?download=1`}
                              className="text-xs text-muted-foreground hover:underline"
                            >
                              Télécharger
                            </a>
                          </summary>
                          {lignesPdf.length === 0 ? (
                            <p className="mt-1 text-xs text-muted-foreground">
                              Aucune commande rattachée (supprimées ?).
                            </p>
                          ) : (
                            <div className="mt-1.5 overflow-x-auto rounded-md border">
                              <table className="w-full text-xs">
                                <thead className="bg-muted/40 text-left text-[10px] uppercase tracking-wider text-muted-foreground">
                                  <tr>
                                    <th className="px-2 py-1.5 font-medium">Désignation</th>
                                    <th className="px-2 py-1.5 font-medium">Réf. / coloris</th>
                                    <th className="px-2 py-1.5 text-right font-medium">Métrage</th>
                                    <th className="px-2 py-1.5 text-right font-medium">Montant</th>
                                    <th className="px-2 py-1.5 font-medium">Dossier / client</th>
                                    <th className="px-2 py-1.5 text-right font-medium">
                                      Commandé / Reçu
                                    </th>
                                    <th className="w-9" />
                                  </tr>
                                </thead>
                                <tbody>
                                  {lignesPdf.map((r) => (
                                    <tr key={r.id} className="border-t">
                                      <td className="px-2 py-1.5 font-medium">
                                        {r.designation || "—"}
                                      </td>
                                      <td className="px-2 py-1.5 text-muted-foreground">
                                        {[r.reference, r.coloris].filter(Boolean).join(" · ") || "—"}
                                      </td>
                                      <td className="px-2 py-1.5 text-right tabular-nums">
                                        {r.qte ? `${r.qte} ${r.unite ?? ""}`.trim() : "—"}
                                      </td>
                                      <td className="px-2 py-1.5 text-right tabular-nums">
                                        {r.montant ? `${r.montant} €` : "—"}
                                      </td>
                                      <td className="px-2 py-1.5">
                                        {r.dossierId ? (
                                          <Link
                                            href={`/dossiers/${r.dossierId}`}
                                            className="text-primary hover:underline"
                                          >
                                            {r.dossierNom || `Dossier #${r.dossierId}`}
                                          </Link>
                                        ) : (
                                          <span className="text-muted-foreground">
                                            {r.client || "— libre —"}
                                          </span>
                                        )}
                                      </td>
                                      <td className="px-2 py-1.5">
                                        <div className="flex items-center justify-end gap-3">
                                          <ToggleCheck
                                            key={`pdf-cmd-${r.id}-${r.estCommande}`}
                                            checked={!!r.estCommande}
                                            label="Commandé"
                                            onToggle={toggleCommandeFlag.bind(
                                              null,
                                              r.id,
                                              r.dossierId ?? 0,
                                              "estCommande"
                                            )}
                                          />
                                          <ToggleCheck
                                            key={`pdf-recu-${r.id}-${r.estRecu}`}
                                            checked={!!r.estRecu}
                                            label="Reçu"
                                            onToggle={toggleCommandeFlag.bind(
                                              null,
                                              r.id,
                                              r.dossierId ?? 0,
                                              "estRecu"
                                            )}
                                          />
                                        </div>
                                      </td>
                                      <td className="px-1 py-1 text-right">
                                        <CommandeEditDialog
                                          commande={r}
                                          fournisseurs={listeFournisseurs}
                                          dossiers={dossiersOptions}
                                          articles={recents}
                                        />
                                      </td>
                                    </tr>
                                  ))}
                                </tbody>
                              </table>
                            </div>
                          )}
                        </details>
                      </li>
                    );
                  })}
                </ul>
              </div>
            ))}
          </div>
        </details>
      )}

      <Section
        titre="À commander"
        sousTitre="Produits pas encore commandés"
        vide="Rien à commander — tout est passé. 🎉"
        lignes={aCommander}
        fournisseurs={listeFournisseurs}
        dossiers={dossiersOptions}
        articles={recents}
        pdf={pdfParCommande}
        colonne="estCommande"
      />

      <div className="h-6" />

      <Section
        titre="À recevoir"
        sousTitre="Produits commandés, en attente de livraison"
        vide="Rien en attente — toutes les commandes sont reçues. 🎉"
        lignes={aRecevoir}
        fournisseurs={listeFournisseurs}
        dossiers={dossiersOptions}
        articles={recents}
        pdf={pdfParCommande}
        colonne="estRecu"
      />

      <div className="h-6" />

      <Section
        titre="Archive"
        sousTitre="Commandé et reçu — cliquer pour déplier"
        replie
        vide="Aucune commande archivée pour l'instant."
        lignes={archive}
        fournisseurs={listeFournisseurs}
        dossiers={dossiersOptions}
        articles={recents}
        pdf={pdfParCommande}
        colonne="estRecu"
      />

      {/* Vue d'ensemble par fournisseur, en fin de page */}
      <section className="mt-6 rounded-xl border">
        <h2 className="flex items-center gap-2 border-b bg-muted/40 px-4 py-2.5 text-sm font-semibold">
          <TrendingUp size={16} className="text-[hsl(var(--brand-orange))]" aria-hidden />
          Par fournisseur
          <span className="ml-auto font-normal text-muted-foreground">
            {nbFournisseurs} fournisseur{nbFournisseurs > 1 ? "s" : ""} ·{" "}
            {nbLignes} commande{nbLignes > 1 ? "s" : ""}
          </span>
        </h2>
        <p className="px-4 pt-3 text-xs text-muted-foreground">
          Top 15 : en tête, les fournisseurs chez qui il reste des lignes à
          commander ou à recevoir. Les retards de livraison sont signalés en
          rouge ; survolez une barre pour le détail et le montant cumulé.
        </p>
        <FournisseursChart data={parFournisseur} />
      </section>
    </main>
  );
}

function Section({
  titre,
  sousTitre,
  vide,
  lignes,
  colonne,
  fournisseurs,
  dossiers,
  articles,
  pdf,
  replie = false,
}: {
  titre: string;
  sousTitre: string;
  vide: string;
  lignes: Ligne[];
  colonne: "estCommande" | "estRecu";
  fournisseurs: string[];
  dossiers: DossierOption[];
  articles: ArticleRecent[];
  // commande id → PDF fournisseur importé dont elle provient.
  pdf: Map<number, number>;
  /** Section repliée par défaut (Archive) : un clic sur l'en-tête la déplie. */
  replie?: boolean;
}) {
  const entete = (
    <span>
      {titre} <span className="text-muted-foreground">({lignes.length})</span>
      <span className="ml-2 font-normal text-muted-foreground">{sousTitre}</span>
    </span>
  );
  const Conteneur = replie ? "details" : "section";
  return (
    <Conteneur className="group rounded-xl border">
      {replie ? (
        <summary className="flex cursor-pointer select-none items-center justify-between bg-muted/40 px-4 py-2.5 text-sm font-semibold group-open:border-b">
          <h2>{entete}</h2>
          <ChevronDown
            size={16}
            aria-hidden
            className="shrink-0 text-muted-foreground transition-transform group-open:rotate-180"
          />
        </summary>
      ) : (
        <h2 className="flex items-center justify-between border-b bg-muted/40 px-4 py-2.5 text-sm font-semibold">
          {entete}
        </h2>
      )}

      {lignes.length === 0 ? (
        <p className="px-4 py-4 text-sm text-muted-foreground">{vide}</p>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="border-b bg-muted/40 text-left text-[11px] uppercase tracking-wider text-muted-foreground">
              <tr>
                <th className="px-3 py-2 font-medium">Désignation</th>
                <th className="px-3 py-2 font-medium">Fournisseur</th>
                <th className="px-3 py-2 font-medium">Réf. / coloris</th>
                <th className="px-3 py-2 text-right font-medium">Qté</th>
                <th className="px-3 py-2 font-medium">Dossier / client</th>
                <th className="px-3 py-2 font-medium">
                  {colonne === "estRecu" ? "Jour de livraison" : "Date cde"}
                </th>
                <th className="px-3 py-2 text-right font-medium">
                  Commandé / Reçu
                </th>
                <th className="w-10 px-2 py-2" />
              </tr>
            </thead>
            <tbody>
              {lignes.map((r) => (
                <tr key={r.id} className="border-t hover:bg-muted/20">
                  <td className="px-3 py-2 font-medium">
                    {r.designation || r.reference || "—"}
                    {pdf.has(r.id) && (
                      <a
                        href={`/api/commandes-import/${pdf.get(r.id)}`}
                        target="_blank"
                        rel="noopener noreferrer"
                        title="Voir le PDF fournisseur importé"
                        className="ml-1.5 inline-flex align-middle text-muted-foreground hover:text-primary"
                      >
                        <FileText size={13} />
                      </a>
                    )}
                  </td>
                  <td className="px-3 py-2">{r.fournisseur || "—"}</td>
                  <td className="px-3 py-2 text-muted-foreground">
                    {[r.reference, r.coloris].filter(Boolean).join(" · ") || "—"}
                  </td>
                  <td className="px-3 py-2 text-right tabular-nums">
                    {r.qte ? `${r.qte} ${r.unite ?? ""}`.trim() : "—"}
                  </td>
                  <td className="px-3 py-2">
                    {r.dossierId ? (
                      <Link
                        href={`/dossiers/${r.dossierId}`}
                        className="text-primary hover:underline"
                      >
                        {r.dossierNom || `Dossier #${r.dossierId}`}
                      </Link>
                    ) : (
                      <span className="text-muted-foreground">
                        {r.client || "— libre —"}
                      </span>
                    )}
                  </td>
                  {/* Jour de livraison saisissable pour les lignes en attente
                      de réception ; date de commande (lecture seule) sinon. */}
                  <td className="px-3 py-2 text-muted-foreground">
                    {colonne === "estRecu" ? (
                      <DateInline
                        key={`liv-${r.id}-${r.dateLivraison ?? ""}`}
                        value={r.dateLivraison ?? ""}
                        onSave={setCommandeDateLivraison.bind(
                          null,
                          r.id,
                          r.dossierId ?? 0
                        )}
                      />
                    ) : (
                      r.dateCde || "—"
                    )}
                  </td>
                  {/* Les DEUX coches sur chaque ligne : on peut cocher ET
                      décocher « Commandé » comme « Reçu » depuis n'importe
                      quelle section (une ligne décochée remonte d'un cran). */}
                  <td className="px-3 py-2">
                    <div className="flex items-center justify-end gap-3">
                      <ToggleCheck
                        key={`cmd-${r.id}-${r.estCommande}`}
                        checked={!!r.estCommande}
                        label="Commandé"
                        onToggle={toggleCommandeFlag.bind(
                          null,
                          r.id,
                          r.dossierId ?? 0,
                          "estCommande"
                        )}
                      />
                      <ToggleCheck
                        key={`recu-${r.id}-${r.estRecu}`}
                        checked={!!r.estRecu}
                        label="Reçu"
                        onToggle={toggleCommandeFlag.bind(
                          null,
                          r.id,
                          r.dossierId ?? 0,
                          "estRecu"
                        )}
                      />
                    </div>
                  </td>
                  <td className="px-2 py-2 text-right">
                    <CommandeEditDialog
                      key={`edit-${r.id}`}
                      commande={r}
                      fournisseurs={fournisseurs}
                      dossiers={dossiers}
                      articles={articles}
                    />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </Conteneur>
  );
}
