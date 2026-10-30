import { eq, asc, sql } from "drizzle-orm";
import Link from "next/link";
import { notFound } from "next/navigation";
import { Library, ArrowLeft } from "lucide-react";

import { db } from "@/db";
import {
  fournisseurs,
  collections,
  catalogueRefs,
  commandes,
} from "@/db/schema";
import { PageHeader } from "@/components/page-header";
import {
  RefAddForm,
  CatalogueDeleteButton,
  CatalogueDuplicateButton,
  ExportEbpButton,
} from "@/components/catalogue-forms";
import { createRef, updateRef, deleteRef, duplicateRef } from "../../actions";

export const dynamic = "force-dynamic";

const inputCls =
  "rounded-md border border-input bg-background px-2 py-1.5 text-sm focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring";

const prix = (n: number | null) =>
  n === null || n === undefined ? "—" : `${n.toFixed(2)} €`;

export default async function CollectionPage({
  params,
}: {
  params: Promise<{ fournisseurId: string; collectionId: string }>;
}) {
  const { fournisseurId, collectionId } = await params;
  const fid = Number(fournisseurId);
  const cid = Number(collectionId);
  if (!Number.isFinite(fid) || !Number.isFinite(cid)) notFound();

  const [row] = await db
    .select({
      collectionId: collections.id,
      collectionNom: collections.nom,
      editeur: collections.editeur,
      annee: collections.annee,
      fournisseurId: fournisseurs.id,
      fournisseurNom: fournisseurs.nom,
    })
    .from(collections)
    .innerJoin(fournisseurs, eq(collections.fournisseurId, fournisseurs.id))
    .where(eq(collections.id, cid));
  if (!row || row.fournisseurId !== fid) notFound();

  const refs = await db
    .select()
    .from(catalogueRefs)
    .where(eq(catalogueRefs.collectionId, cid))
    .orderBy(asc(catalogueRefs.reference), asc(catalogueRefs.coloris));

  // Compteur « nombre de fois commandé » par article, sur TOUTES les commandes
  // de ce fournisseur, regroupées par désignation + référence (coloris ignoré :
  // un tissu commandé en 3 coloris compte pour 3 commandes du même article).
  const cmdCounts = await db
    .select({
      reference: commandes.reference,
      designation: commandes.designation,
      n: sql<number>`count(*)`,
    })
    .from(commandes)
    .where(eq(commandes.fournisseur, row.fournisseurNom))
    .groupBy(commandes.reference, commandes.designation);
  const cmdCountMap = new Map<string, number>();
  for (const c of cmdCounts) {
    cmdCountMap.set(
      `${(c.reference ?? "").trim()}||${(c.designation ?? "").trim()}`,
      Number(c.n)
    );
  }
  // Le libellé de l'article reprend la désignation de la commande.
  const nbCommandes = (r: (typeof refs)[number]) =>
    cmdCountMap.get(`${(r.reference ?? "").trim()}||${(r.libelle ?? "").trim()}`) ??
    0;

  return (
    <main className="mx-auto max-w-5xl px-6 py-10">
      <Link
        href={`/catalogue/${fid}`}
        className="mb-4 inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground"
      >
        <ArrowLeft size={15} /> {row.fournisseurNom}
      </Link>

      <PageHeader
        className="mb-6"
        icon={Library}
        tint="var(--brand-blue)"
        eyebrow={`${row.fournisseurNom} · Collection`}
        title={row.collectionNom}
        subtitle={[row.editeur || null, row.annee || null]
          .filter(Boolean)
          .join(" · ") || undefined}
        actions={<ExportEbpButton fournisseurId={fid} label="Export EBP" />}
      />

      <section className="mb-6 rounded-xl border">
        <h2 className="border-b bg-muted/40 px-4 py-2.5 text-sm font-semibold">
          Ajouter une référence
        </h2>
        <RefAddForm action={createRef.bind(null, cid, fid)} />
      </section>

      <section className="rounded-xl border">
        <h2 className="border-b bg-muted/40 px-4 py-2.5 text-sm font-semibold">
          Références{" "}
          <span className="text-muted-foreground">({refs.length})</span>
          <span className="ml-2 font-normal text-muted-foreground">
            cliquez une ligne pour modifier
          </span>
        </h2>

        {refs.length === 0 ? (
          <p className="px-4 py-4 text-sm text-muted-foreground">
            Aucune référence — ajoutez-en une ci-dessus.
          </p>
        ) : (
          <ul className="divide-y">
            {refs.map((r) => (
              <li key={r.id}>
                <details className="group">
                  <summary className="flex cursor-pointer items-center gap-3 px-4 py-3 hover:bg-muted/20">
                    <span
                      className={`h-2 w-2 shrink-0 rounded-full ${
                        r.enMagasin ? "bg-green-500" : "bg-muted-foreground/30"
                      }`}
                      title={r.enMagasin ? "En magasin" : "Pas en magasin"}
                    />
                    <div className="min-w-0 flex-1">
                      <p className="truncate font-medium">
                        {r.reference}
                        {r.coloris ? (
                          <span className="text-muted-foreground">
                            {" "}
                            · {r.coloris}
                          </span>
                        ) : null}
                      </p>
                      <p className="truncate text-xs text-muted-foreground">
                        {[
                          r.laize || null,
                          r.numEchantillon ? `éch. ${r.numEchantillon}` : null,
                          r.codeEbp ? `EBP ${r.codeEbp}` : null,
                        ]
                          .filter(Boolean)
                          .join(" · ") || "—"}
                      </p>
                    </div>
                    {nbCommandes(r) > 0 ? (
                      <span
                        className="shrink-0 rounded-full bg-primary/10 px-2 py-0.5 text-xs font-medium text-primary"
                        title="Nombre de fois commandé (tous coloris confondus)"
                      >
                        Commandé {nbCommandes(r)}×
                      </span>
                    ) : null}
                    <div className="shrink-0 text-right text-sm tabular-nums">
                      <p>
                        Achat {prix(r.prixAchat)}
                      </p>
                      <p className="text-xs text-muted-foreground">
                        Vente {prix(r.prixVente)} / {r.unite}
                      </p>
                    </div>
                  </summary>

                  {/* Formulaire d'édition (prix, coloris, code EBP…). */}
                  <form
                    action={updateRef.bind(null, r.id, cid, fid)}
                    className="flex flex-wrap items-end gap-2 border-t bg-muted/10 px-4 py-3"
                  >
                    <label className="flex flex-col gap-1 text-xs">
                      <span className="text-muted-foreground">Référence</span>
                      <input name="reference" defaultValue={r.reference} className={`${inputCls} w-32`} required />
                    </label>
                    <label className="flex flex-col gap-1 text-xs">
                      <span className="text-muted-foreground">Coloris</span>
                      <input name="coloris" defaultValue={r.coloris ?? ""} className={`${inputCls} w-28`} />
                    </label>
                    <label className="flex flex-col gap-1 text-xs">
                      <span className="text-muted-foreground">Laize</span>
                      <input name="laize" defaultValue={r.laize ?? ""} className={`${inputCls} w-24`} />
                    </label>
                    <label className="flex flex-col gap-1 text-xs">
                      <span className="text-muted-foreground">Prix achat €</span>
                      <input name="prixAchat" type="number" step="0.01" min="0" defaultValue={r.prixAchat ?? ""} className={`${inputCls} w-24`} />
                    </label>
                    <label className="flex flex-col gap-1 text-xs">
                      <span className="text-muted-foreground">Prix vente €</span>
                      <input name="prixVente" type="number" step="0.01" min="0" defaultValue={r.prixVente ?? ""} className={`${inputCls} w-24`} />
                    </label>
                    <label className="flex flex-col gap-1 text-xs">
                      <span className="text-muted-foreground">Unité</span>
                      <input name="unite" defaultValue={r.unite ?? "ml"} className={`${inputCls} w-16`} />
                    </label>
                    <label className="flex flex-col gap-1 text-xs">
                      <span className="text-muted-foreground">Code EBP</span>
                      <input name="codeEbp" defaultValue={r.codeEbp ?? ""} className={`${inputCls} w-28`} />
                    </label>
                    <label className="flex flex-col gap-1 text-xs">
                      <span className="text-muted-foreground">N° échantillon</span>
                      <input name="numEchantillon" defaultValue={r.numEchantillon ?? ""} className={`${inputCls} w-24`} />
                    </label>
                    <label className="flex flex-col gap-1 text-xs">
                      <span className="text-muted-foreground">Libellé EBP</span>
                      <input name="libelle" defaultValue={r.libelle ?? ""} placeholder="auto" className={`${inputCls} w-40`} />
                    </label>
                    <label className="flex items-center gap-1.5 pb-1.5 text-xs">
                      <input name="enMagasin" type="checkbox" defaultChecked={!!r.enMagasin} className="h-4 w-4 rounded border-input" />
                      <span className="text-muted-foreground">En magasin</span>
                    </label>
                    <label className="flex flex-1 flex-col gap-1 text-xs">
                      <span className="text-muted-foreground">Commentaire</span>
                      <input name="commentaires" defaultValue={r.commentaires ?? ""} className={`${inputCls} w-full min-w-40`} />
                    </label>
                    <div className="flex items-center gap-3">
                      <button
                        type="submit"
                        className="rounded-md bg-primary px-3 py-1.5 text-sm font-medium text-primary-foreground hover:opacity-90"
                      >
                        Enregistrer
                      </button>
                      <CatalogueDuplicateButton
                        action={duplicateRef.bind(null, r.id, cid, fid)}
                      />
                      <CatalogueDeleteButton
                        action={deleteRef.bind(null, r.id, cid, fid)}
                        message={`Supprimer la référence « ${r.reference}${r.coloris ? " · " + r.coloris : ""} » ? Action irréversible.`}
                        label="Supprimer"
                        title="Supprimer la référence"
                      />
                    </div>
                  </form>
                </details>
              </li>
            ))}
          </ul>
        )}
      </section>
    </main>
  );
}
