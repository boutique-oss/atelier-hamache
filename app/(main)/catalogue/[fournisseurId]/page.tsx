import { eq, sql, asc } from "drizzle-orm";
import Link from "next/link";
import { notFound } from "next/navigation";
import { Library, ChevronRight, ArrowLeft } from "lucide-react";

import { db } from "@/db";
import { fournisseurs, collections, catalogueRefs } from "@/db/schema";
import { PageHeader } from "@/components/page-header";
import {
  CollectionAddForm,
  CatalogueDeleteButton,
  ExportEbpButton,
} from "@/components/catalogue-forms";
import {
  createCollection,
  deleteCollection,
  updateFournisseur,
} from "../actions";

export const dynamic = "force-dynamic";

const inputCls =
  "rounded-md border border-input bg-background px-2 py-1.5 text-sm focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring";

export default async function FournisseurPage({
  params,
}: {
  params: Promise<{ fournisseurId: string }>;
}) {
  const { fournisseurId } = await params;
  const fid = Number(fournisseurId);
  if (!Number.isFinite(fid)) notFound();

  const [f] = await db
    .select()
    .from(fournisseurs)
    .where(eq(fournisseurs.id, fid));
  if (!f) notFound();

  // Sous-titre : contact · code EBP · lien site (les champs vides sont omis).
  const sousTitreParts: React.ReactNode[] = [];
  if (f.contact) sousTitreParts.push(f.contact);
  if (f.codeEbp) sousTitreParts.push(`Code EBP ${f.codeEbp}`);
  if (f.urlSite)
    sousTitreParts.push(
      <a
        key="site"
        href={f.urlSite}
        target="_blank"
        rel="noopener noreferrer"
        className="text-primary hover:underline"
      >
        site web
      </a>
    );
  const sousTitre =
    sousTitreParts.length === 0 ? undefined : (
      <>
        {sousTitreParts.map((el, i) => (
          <span key={i}>
            {i > 0 ? " · " : ""}
            {el}
          </span>
        ))}
      </>
    );

  const cols = await db
    .select({
      id: collections.id,
      nom: collections.nom,
      editeur: collections.editeur,
      annee: collections.annee,
      nbRefs: sql<number>`count(${catalogueRefs.id})`,
    })
    .from(collections)
    .leftJoin(
      catalogueRefs,
      eq(catalogueRefs.collectionId, collections.id)
    )
    .where(eq(collections.fournisseurId, fid))
    .groupBy(collections.id, collections.nom, collections.editeur, collections.annee)
    .orderBy(asc(collections.nom));

  return (
    <main className="mx-auto max-w-5xl px-6 py-10">
      <Link
        href="/catalogue"
        className="mb-4 inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground"
      >
        <ArrowLeft size={15} /> Tous les fournisseurs
      </Link>

      <PageHeader
        className="mb-6"
        icon={Library}
        tint="var(--brand-blue)"
        eyebrow="Fournisseur"
        title={f.nom}
        subtitle={sousTitre}
        actions={<ExportEbpButton fournisseurId={f.id} label="Export EBP" />}
      />

      {/* Modifier la fiche fournisseur (repliée par défaut). */}
      <details className="mb-6 rounded-xl border">
        <summary className="cursor-pointer px-4 py-2.5 text-sm font-semibold">
          Modifier ce fournisseur
        </summary>
        <form
          action={updateFournisseur.bind(null, f.id)}
          className="flex flex-wrap items-end gap-2 border-t px-4 py-3"
        >
          <label className="flex flex-col gap-1 text-xs">
            <span className="text-muted-foreground">Nom</span>
            <input name="nom" defaultValue={f.nom} className={`${inputCls} w-48`} required />
          </label>
          <label className="flex flex-col gap-1 text-xs">
            <span className="text-muted-foreground">Code EBP</span>
            <input name="codeEbp" defaultValue={f.codeEbp ?? ""} className={`${inputCls} w-28`} />
          </label>
          <label className="flex flex-col gap-1 text-xs">
            <span className="text-muted-foreground">Contact</span>
            <input name="contact" defaultValue={f.contact ?? ""} className={`${inputCls} w-40`} />
          </label>
          <label className="flex flex-col gap-1 text-xs">
            <span className="text-muted-foreground">Site web</span>
            <input name="urlSite" type="url" defaultValue={f.urlSite ?? ""} className={`${inputCls} w-52`} />
          </label>
          <label className="flex flex-col gap-1 text-xs">
            <span className="text-muted-foreground">Commentaire</span>
            <input name="commentaires" defaultValue={f.commentaires ?? ""} className={`${inputCls} w-52`} />
          </label>
          <button
            type="submit"
            className="rounded-md bg-primary px-3 py-1.5 text-sm font-medium text-primary-foreground hover:opacity-90"
          >
            Enregistrer
          </button>
        </form>
      </details>

      <section className="mb-6 rounded-xl border">
        <h2 className="border-b bg-muted/40 px-4 py-2.5 text-sm font-semibold">
          Ajouter une collection
        </h2>
        <CollectionAddForm action={createCollection.bind(null, f.id)} />
      </section>

      <section className="rounded-xl border">
        <h2 className="border-b bg-muted/40 px-4 py-2.5 text-sm font-semibold">
          Collections{" "}
          <span className="text-muted-foreground">({cols.length})</span>
        </h2>

        {cols.length === 0 ? (
          <p className="px-4 py-4 text-sm text-muted-foreground">
            Aucune collection — ajoutez-en une ci-dessus.
          </p>
        ) : (
          <ul className="divide-y">
            {cols.map((c) => (
              <li
                key={c.id}
                className="flex items-center gap-3 px-4 py-3 hover:bg-muted/20"
              >
                <Link
                  href={`/catalogue/${f.id}/${c.id}`}
                  className="flex min-w-0 flex-1 items-center gap-3"
                >
                  <div className="min-w-0 flex-1">
                    <p className="truncate font-medium">
                      {c.nom}
                      {c.annee ? (
                        <span className="ml-2 text-xs font-normal text-muted-foreground">
                          {c.annee}
                        </span>
                      ) : null}
                    </p>
                    <p className="truncate text-xs text-muted-foreground">
                      {[c.editeur || null, `${c.nbRefs} réf.`]
                        .filter(Boolean)
                        .join(" — ")}
                    </p>
                  </div>
                  <ChevronRight
                    size={18}
                    className="shrink-0 text-muted-foreground"
                  />
                </Link>
                <CatalogueDeleteButton
                  action={deleteCollection.bind(null, c.id, f.id)}
                  message={`Supprimer la collection « ${c.nom} » et ses ${c.nbRefs} référence(s) ? Action irréversible.`}
                  title="Supprimer la collection"
                />
              </li>
            ))}
          </ul>
        )}
      </section>
    </main>
  );
}
