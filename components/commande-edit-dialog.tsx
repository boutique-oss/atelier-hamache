"use client";

import { Field, Form, Formik } from "formik";
import { Pencil, X } from "lucide-react";
import { useEffect, useState, useTransition } from "react";

import {
  deleteCommande,
  updateCommande,
  type ArticleRecent,
} from "@/app/commandes/actions";
import {
  ChampDate,
  ChampDossierClient,
  ChampsArticle,
  type CommandeValues,
  type DossierOption,
  inputCls,
  validerCommande,
} from "@/components/commande-fields";
import { Button } from "@/components/ui/button";

// Données d'une ligne de commande telles que lues en base.
export type CommandeLigne = {
  id: number;
  fournisseur: string | null;
  designation: string | null;
  reference: string | null;
  coloris: string | null;
  qte: number | null;
  unite: string | null;
  montant: number | null;
  dateCde: string | null;
  dateLivraison: string | null;
  dossierId: number | null;
  client: string | null;
  commentaires: string | null;
  estCommande: boolean | null;
  estRecu: boolean | null;
};

const enTexte = (n: number | null) =>
  n == null ? "" : String(n).replace(".", ",");

function versValeurs(c: CommandeLigne): CommandeValues {
  return {
    fournisseur: c.fournisseur ?? "",
    designation: c.designation ?? "",
    reference: c.reference ?? "",
    coloris: c.coloris ?? "",
    qte: enTexte(c.qte),
    unite: c.unite || "ml",
    montant: enTexte(c.montant),
    dateCde: c.dateCde ?? "",
    dateLivraison: c.dateLivraison ?? "",
    dossierId: c.dossierId,
    client: c.client ?? "",
    commentaires: c.commentaires ?? "",
    estCommande: !!c.estCommande,
    estRecu: !!c.estRecu,
  };
}

// Bouton crayon + fenêtre de modification d'une commande (corriger une
// erreur de saisie depuis « À commander », « À recevoir », l'archive ou la
// fiche dossier). Formik garde la saisie tant que rien n'est enregistré, et
// prévient avant de fermer une fenêtre modifiée.
export function CommandeEditDialog({
  commande,
  fournisseurs,
  dossiers,
  articles = [],
}: {
  commande: CommandeLigne;
  fournisseurs: string[];
  dossiers: DossierOption[];
  // Articles déjà saisis : suggestions Désignation / Référence / Coloris.
  articles?: ArticleRecent[];
}) {
  const [ouvert, setOuvert] = useState(false);
  const [erreur, setErreur] = useState("");
  const [suppression, startSuppr] = useTransition();

  // Échap ferme la fenêtre.
  useEffect(() => {
    if (!ouvert) return;
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && setOuvert(false);
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [ouvert]);

  const sfx = `edit-${commande.id}`;

  return (
    <>
      <button
        type="button"
        onClick={() => {
          setErreur("");
          setOuvert(true);
        }}
        title="Modifier la commande"
        className="inline-flex h-7 w-7 items-center justify-center rounded-md text-muted-foreground hover:bg-accent hover:text-foreground"
      >
        <Pencil size={14} />
      </button>

      {ouvert && (
        <div
          className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto bg-black/40 p-4 sm:items-center"
          role="dialog"
          aria-modal="true"
        >
          <div className="w-full max-w-3xl rounded-xl border bg-background shadow-xl">
            <Formik
              initialValues={versValeurs(commande)}
              validate={validerCommande}
              onSubmit={async (values) => {
                setErreur("");
                const res = await updateCommande(commande.id, values);
                if (res.ok) setOuvert(false);
                else setErreur(res.error ?? "Enregistrement impossible.");
              }}
            >
              {({ isSubmitting, dirty, values, setFieldValue }) => {
                const fermer = () => {
                  if (
                    dirty &&
                    !window.confirm("Fermer sans enregistrer les modifications ?")
                  )
                    return;
                  setOuvert(false);
                };
                return (
                  <Form>
                    <div className="flex items-center justify-between border-b px-4 py-3">
                      <h2 className="text-sm font-semibold">
                        Modifier la commande #{commande.id}
                        {dirty && (
                          <span className="ml-2 font-normal text-amber-600">
                            · modifiée, non enregistrée
                          </span>
                        )}
                      </h2>
                      <button
                        type="button"
                        onClick={fermer}
                        className="rounded-md p-1 text-muted-foreground hover:bg-accent"
                        aria-label="Fermer"
                        title="Fermer"
                      >
                        <X size={16} />
                      </button>
                    </div>

                    <div className="flex flex-wrap items-start gap-2 px-4 py-4">
                      <ChampsArticle
                        fournisseurs={fournisseurs}
                        listId={`f-${sfx}`}
                        articles={articles}
                      />
                      <ChampDossierClient dossiers={dossiers} listId={`d-${sfx}`} />
                      <ChampDate label="Date cde" name="dateCde" />
                      <ChampDate label="Livraison" name="dateLivraison" />
                      <label className="flex w-full flex-col gap-1 text-xs">
                        <span className="text-muted-foreground">Commentaires</span>
                        <Field
                          as="textarea"
                          name="commentaires"
                          rows={2}
                          className={`${inputCls} w-full`}
                        />
                      </label>
                      <div className="flex gap-4 text-sm">
                        <label className="flex items-center gap-1.5">
                          <input
                            type="checkbox"
                            checked={values.estCommande || values.estRecu}
                            disabled={values.estRecu}
                            onChange={(e) =>
                              setFieldValue("estCommande", e.target.checked)
                            }
                            className="h-4 w-4"
                          />
                          Commandé
                        </label>
                        <label className="flex items-center gap-1.5">
                          <Field type="checkbox" name="estRecu" className="h-4 w-4" />
                          Reçu
                        </label>
                      </div>
                    </div>

                    <div className="flex flex-wrap items-center gap-2 border-t px-4 py-3">
                      <button
                        type="button"
                        disabled={suppression}
                        onClick={() => {
                          if (!window.confirm("Supprimer définitivement cette commande ?"))
                            return;
                          startSuppr(async () => {
                            await deleteCommande(commande.id, commande.dossierId ?? 0);
                            setOuvert(false);
                          });
                        }}
                        className="text-xs text-muted-foreground hover:text-destructive disabled:opacity-50"
                      >
                        Supprimer la commande
                      </button>
                      {erreur && (
                        <span role="alert" className="text-xs font-medium text-destructive">
                          {erreur}
                        </span>
                      )}
                      <div className="ml-auto flex gap-2">
                        <Button type="button" variant="outline" size="sm" onClick={fermer}>
                          Annuler
                        </Button>
                        <Button type="submit" size="sm" disabled={isSubmitting || !dirty}>
                          {isSubmitting ? "Enregistrement…" : "Enregistrer"}
                        </Button>
                      </div>
                    </div>
                  </Form>
                );
              }}
            </Formik>
          </div>
        </div>
      )}
    </>
  );
}
