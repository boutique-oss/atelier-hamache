import Link from "next/link";
import { FileText } from "lucide-react";

import { CommandeJoindre } from "@/components/commande-joindre";
import {
  STATUTS_COMMANDE,
  type CommandeDocs,
  type FiltresCommandes,
} from "@/lib/documents-commandes";
import { cn } from "@/lib/utils";

// Rubrique Commandes de la page Documents : filtres (colonne gauche) et
// tableau des commandes fournisseur avec leurs pièces jointes.

const champ =
  "h-9 w-full rounded-md border border-input bg-background px-2 text-sm [@media(pointer:coarse)]:h-11";

export function FiltresCommandesForm({
  filtres,
  fournisseurs,
  dossiers,
}: {
  filtres: FiltresCommandes;
  fournisseurs: string[];
  dossiers: { id: number; nom: string }[];
}) {
  const actifs = Boolean(filtres.statut || filtres.fournisseur || filtres.dossierId);
  return (
    <form className="space-y-3 rounded-lg border bg-card p-3" aria-label="Filtrer les commandes">
      <input type="hidden" name="rubrique" value="commandes" />
      <label className="block space-y-1">
        <span className="text-xs font-medium text-muted-foreground">Statut</span>
        <select name="statut" defaultValue={filtres.statut} className={champ}>
          <option value="">Tous</option>
          {STATUTS_COMMANDE.map((s) => (
            <option key={s.cle} value={s.cle}>
              {s.libelle}
            </option>
          ))}
        </select>
      </label>
      <label className="block space-y-1">
        <span className="text-xs font-medium text-muted-foreground">Fournisseur</span>
        <select name="fournisseur" defaultValue={filtres.fournisseur} className={champ}>
          <option value="">Tous</option>
          {fournisseurs.map((f) => (
            <option key={f} value={f}>
              {f}
            </option>
          ))}
        </select>
      </label>
      <label className="block space-y-1">
        <span className="text-xs font-medium text-muted-foreground">Dossier</span>
        <select name="dossier" defaultValue={filtres.dossierId ?? ""} className={champ}>
          <option value="">Tous</option>
          {dossiers.map((d) => (
            <option key={d.id} value={d.id}>
              {d.nom}
            </option>
          ))}
        </select>
      </label>
      <div className="flex items-center gap-2">
        <button
          type="submit"
          className="h-9 flex-1 rounded-md bg-primary px-3 text-sm font-medium text-primary-foreground shadow hover:bg-primary/90 [@media(pointer:coarse)]:h-11"
        >
          Filtrer
        </button>
        {actifs && (
          <Link
            href="/documents?rubrique=commandes"
            className="inline-flex h-9 items-center rounded-md px-3 text-sm text-muted-foreground hover:bg-foreground/5 hover:text-foreground [@media(pointer:coarse)]:h-11"
          >
            Effacer
          </Link>
        )}
      </div>
    </form>
  );
}

const STATUT = Object.fromEntries(STATUTS_COMMANDE.map((s) => [s.cle, s]));

// « 2026-10-12 » → « 12/10/2026 » (les dates de commande sont du texte ISO).
const dateFr = (iso: string | null) => (iso ? iso.slice(0, 10).split("-").reverse().join("/") : "");

export function TableauCommandes({
  commandes,
  tronque,
}: {
  commandes: CommandeDocs[];
  tronque: boolean;
}) {
  if (commandes.length === 0) {
    return (
      <p className="rounded-lg border border-dashed px-4 py-12 text-center text-sm text-muted-foreground">
        Aucune commande ne correspond à ces filtres.
      </p>
    );
  }
  return (
    <div className="space-y-2">
      <div className="overflow-hidden rounded-lg border bg-card">
        <table className="w-full text-sm">
          <thead className="bg-muted/40 text-left text-xs text-muted-foreground">
            <tr>
              <th className="hidden px-3 py-2 font-medium sm:table-cell">N°</th>
              <th className="px-3 py-2 font-medium">Article</th>
              <th className="hidden px-3 py-2 font-medium md:table-cell">Fournisseur</th>
              <th className="hidden px-3 py-2 font-medium lg:table-cell">Dossier</th>
              <th className="hidden px-3 py-2 font-medium sm:table-cell">Statut</th>
              <th className="px-3 py-2 font-medium">Pièce jointe</th>
            </tr>
          </thead>
          <tbody className="divide-y">
            {commandes.map((c) => {
              const st = STATUT[c.statut];
              const lienDossier =
                c.dossierId != null ? (
                  <Link href={`/documents?dossier=${c.dossierId}`} className="hover:underline">
                    {c.dossierNom || `Dossier ${c.dossierId}`}
                  </Link>
                ) : (
                  <span className="text-muted-foreground">Sans dossier</span>
                );
              return (
                <tr key={c.id} className="align-top hover:bg-foreground/[0.03]">
                  <td className="hidden whitespace-nowrap px-3 py-2 tabular-nums text-muted-foreground sm:table-cell">
                    {c.id}
                    {c.dateCde && <span className="block text-xs">{dateFr(c.dateCde)}</span>}
                  </td>
                  <td className="px-3 py-2">
                    <span className="break-words font-medium">{c.article || "—"}</span>
                    {/* Sur téléphone, les colonnes masquées passent sous l'article. */}
                    <span className="mt-1 flex flex-wrap items-center gap-x-2 gap-y-1 text-xs text-muted-foreground lg:hidden">
                      <span className="md:hidden">{c.fournisseur || "—"}</span>
                      <span>{lienDossier}</span>
                      <span className={cn("rounded px-1.5 py-0.5 font-medium sm:hidden", st.cls)}>{st.libelle}</span>
                    </span>
                  </td>
                  <td className="hidden px-3 py-2 md:table-cell">{c.fournisseur || "—"}</td>
                  <td className="hidden px-3 py-2 lg:table-cell">{lienDossier}</td>
                  <td className="hidden px-3 py-2 sm:table-cell">
                    <span className={cn("whitespace-nowrap rounded px-1.5 py-0.5 text-xs font-medium", st.cls)}>
                      {st.libelle}
                    </span>
                  </td>
                  <td className="px-3 py-2">
                    {c.pieces.length > 0 && (
                      <ul className="mb-1 space-y-1">
                        {c.pieces.map((p) => (
                          <li key={p.cle}>
                            <a
                              href={p.href}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="inline-flex max-w-[14rem] items-start gap-1.5 text-xs hover:underline"
                            >
                              <FileText size={13} aria-hidden className="mt-0.5 shrink-0 text-muted-foreground" />
                              <span className="break-words">{p.nom}</span>
                            </a>
                          </li>
                        ))}
                      </ul>
                    )}
                    <CommandeJoindre commandeId={c.id} dossierId={c.dossierId} />
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
      {tronque && (
        <p className="text-xs text-muted-foreground">
          Seules les 300 commandes les plus récentes sont affichées : affinez avec les filtres.
        </p>
      )}
    </div>
  );
}
