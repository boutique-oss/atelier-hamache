"use client";

import { ChevronRight } from "lucide-react";

import {
  createOperateur,
  deleteOperateur,
  renameOperateur,
  toggleDirigeant,
  toggleOperateur,
} from "@/app/(main)/operateurs/actions";
import { ConfirmDeleteButton } from "@/components/confirm-delete-button";
import { Button } from "@/components/ui/button";

const inputCls =
  "rounded-md border border-input bg-background px-2 py-1.5 text-sm focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring";

type Op = {
  id: number;
  nom: string;
  actif: boolean;
  heuresSemaine: number;
  // true = exclu du pointage (reste dans la liste, saisit des heures sur dossiers)
  estDirigeant?: boolean | null;
};

// Gestion des opérateurs en WIDGET (repliable) au lieu d'une page dédiée.
// Réutilise les server actions ; ajout / renommage+capacité / activer / supprimer.
export function OperateursWidget({ ops }: { ops: Op[] }) {
  const actifs = ops.filter((o) => o.actif).length;
  return (
    <section className="rounded-lg border">
      <details className="group">
        <summary className="flex cursor-pointer list-none items-center justify-between border-b bg-muted/40 px-4 py-2 text-sm font-semibold [&::-webkit-details-marker]:hidden">
          <span className="flex items-center gap-2">
            <ChevronRight className="h-4 w-4 transition-transform group-open:rotate-90" />
            Opérateurs{" "}
            <span className="font-normal text-muted-foreground">
              · {actifs} actif{actifs > 1 ? "s" : ""} / {ops.length}
            </span>
          </span>
        </summary>

        <div className="space-y-3 px-4 py-3">
          {/* Ajout */}
          <form action={createOperateur} className="flex items-end gap-2">
            <label className="flex flex-1 flex-col gap-1 text-xs">
              <span className="text-muted-foreground">Nouvel opérateur</span>
              <input name="nom" required placeholder="Nom" className={inputCls} />
            </label>
            <Button type="submit" size="sm">
              Ajouter
            </Button>
          </form>

          {/* Liste */}
          {ops.length === 0 ? (
            <p className="text-sm text-muted-foreground">Aucun opérateur.</p>
          ) : (
            <div className="divide-y rounded-md border">
              {ops.map((o) => (
                <div key={o.id} className="flex items-center gap-2 px-3 py-2 text-sm">
                  <form
                    action={renameOperateur.bind(null, o.id)}
                    className="flex flex-1 items-center gap-2"
                  >
                    <input
                      name="nom"
                      defaultValue={o.nom}
                      className={`${inputCls} flex-1 ${o.actif ? "" : "text-muted-foreground line-through"}`}
                    />
                    <input
                      name="heuresSemaine"
                      type="number"
                      step="0.5"
                      min="0"
                      defaultValue={o.heuresSemaine}
                      title="Heures par semaine"
                      className={`${inputCls} w-16`}
                    />
                    <span className="text-xs text-muted-foreground">h/sem</span>
                    <button
                      type="submit"
                      className="text-xs text-muted-foreground hover:text-primary"
                      title="Enregistrer"
                    >
                      OK
                    </button>
                  </form>

                  <form action={toggleDirigeant.bind(null, o.id, !o.estDirigeant)}>
                    <button
                      type="submit"
                      title={
                        o.estDirigeant
                          ? "Exclu du pointage — cliquer pour le remettre"
                          : "Présent dans le pointage — cliquer pour l'exclure"
                      }
                      className={`rounded border px-2 py-1 text-xs hover:bg-accent ${
                        o.estDirigeant
                          ? "border-amber-300 font-medium text-amber-700"
                          : "text-muted-foreground"
                      }`}
                    >
                      {o.estDirigeant ? "Hors pointage ✓" : "Hors pointage"}
                    </button>
                  </form>

                  <form action={toggleOperateur.bind(null, o.id, !o.actif)}>
                    <button
                      type="submit"
                      className="rounded border px-2 py-1 text-xs hover:bg-accent"
                    >
                      {o.actif ? "Désactiver" : "Activer"}
                    </button>
                  </form>

                  <form action={deleteOperateur.bind(null, o.id)}>
                    <ConfirmDeleteButton
                      label={`Supprimer l'opérateur ${o.nom}`}
                      confirmation={`Supprimer l'opérateur « ${o.nom} » ? Pour garder son historique, préférez « Désactiver ».`}
                    />
                  </form>
                </div>
              ))}
            </div>
          )}
        </div>
      </details>
    </section>
  );
}
