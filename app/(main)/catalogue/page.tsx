import { sql } from "drizzle-orm";
import Link from "next/link";
import { Library, ChevronRight, ExternalLink } from "lucide-react";

import { db } from "@/db";
import { fournisseurs, collections, catalogueRefs } from "@/db/schema";
import { PageHeader } from "@/components/page-header";
import {
  FournisseurAddForm,
  CatalogueDeleteButton,
  ExportEbpButton,
} from "@/components/catalogue-forms";
import { createFournisseur, deleteFournisseur } from "./actions";

// Données live : pas de cache.
export const dynamic = "force-dynamic";

export default async function CataloguePage() {
  const fs = await db
    .select()
    .from(fournisseurs)
    .orderBy(fournisseurs.nom);

  // Compteurs par fournisseur : nb de collections et nb de références.
  const compteurs = await db
    .select({
      fournisseurId: collections.fournisseurId,
      nbCollections: sql<number>`count(distinct ${collections.id})`,
      nbRefs: sql<number>`count(${catalogueRefs.id})`,
    })
    .from(collections)
    .leftJoin(catalogueRefs, sql`${catalogueRefs.collectionId} = ${collections.id}`)
    .groupBy(collections.fournisseurId);

  const parFournisseur = new Map(
    compteurs.map((c) => [c.fournisseurId, c])
  );

  return (
    <main className="mx-auto max-w-5xl px-6 py-10">
      <PageHeader
        className="mb-6"
        icon={Library}
        tint="var(--brand-blue)"
        title="Catalogue fournisseurs"
        subtitle="Fournisseurs → collections → références en magasin"
        actions={
          fs.length > 0 ? (
            <ExportEbpButton label="Export EBP (tous)" />
          ) : undefined
        }
      />

      <section className="mb-6 rounded-xl border">
        <h2 className="border-b bg-muted/40 px-4 py-2.5 text-sm font-semibold">
          Ajouter un fournisseur
        </h2>
        <FournisseurAddForm action={createFournisseur} />
      </section>

      <section className="rounded-xl border">
        <h2 className="flex items-center justify-between border-b bg-muted/40 px-4 py-2.5 text-sm font-semibold">
          <span>
            Fournisseurs{" "}
            <span className="text-muted-foreground">({fs.length})</span>
          </span>
        </h2>

        {fs.length === 0 ? (
          <p className="px-4 py-4 text-sm text-muted-foreground">
            Aucun fournisseur pour l&apos;instant — ajoutez-en un ci-dessus.
          </p>
        ) : (
          <ul className="divide-y">
            {fs.map((f) => {
              const c = parFournisseur.get(f.id);
              return (
                <li
                  key={f.id}
                  className="flex items-center gap-3 px-4 py-3 hover:bg-muted/20"
                >
                  <Link
                    href={`/catalogue/${f.id}`}
                    className="flex min-w-0 flex-1 items-center gap-3"
                  >
                    <div className="min-w-0 flex-1">
                      <p className="truncate font-medium">
                        {f.nom}
                        {f.codeEbp ? (
                          <span className="ml-2 text-xs font-normal text-muted-foreground">
                            EBP&nbsp;{f.codeEbp}
                          </span>
                        ) : null}
                      </p>
                      <p className="truncate text-xs text-muted-foreground">
                        {[
                          f.contact || null,
                          c
                            ? `${c.nbCollections} collection${c.nbCollections > 1 ? "s" : ""} · ${c.nbRefs} réf.`
                            : "0 collection",
                        ]
                          .filter(Boolean)
                          .join(" — ")}
                      </p>
                    </div>
                    <ChevronRight
                      size={18}
                      className="shrink-0 text-muted-foreground"
                    />
                  </Link>
                  {f.urlSite ? (
                    <a
                      href={f.urlSite}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="shrink-0 text-muted-foreground hover:text-primary"
                      title="Ouvrir le site"
                    >
                      <ExternalLink size={15} />
                    </a>
                  ) : null}
                  <CatalogueDeleteButton
                    action={deleteFournisseur.bind(null, f.id)}
                    message={`Supprimer « ${f.nom} » et toutes ses collections et références ? Action irréversible.`}
                    title="Supprimer le fournisseur"
                  />
                </li>
              );
            })}
          </ul>
        )}
      </section>
    </main>
  );
}
