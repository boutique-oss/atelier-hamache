"use client";

import { Form, Formik } from "formik";
import { useEffect, useState } from "react";

import {
  addCommande,
  addCommandeFourniture,
  type ArticleRecent,
} from "@/app/commandes/actions";
import {
  ChampDate,
  ChampDossierClient,
  ChampsArticle,
  COMMANDE_VIDE,
  type CommandeValues,
  type DossierOption,
  validerCommande,
  versFormData,
} from "@/components/commande-fields";
import { Button } from "@/components/ui/button";

// Saisie d'une commande fournisseur (Formik).
//  - avec `dossierId` : commande rattachée à ce dossier (fiche dossier) ;
//  - sans : depuis le Rapport des commandes, on choisit un dossier existant
//    (client lié) ou on laisse un client libre / vide (fourniture d'atelier).
// Désignation / Référence / Coloris proposent les articles déjà saisis (3 max).
export function CommandeForm({
  dossierId,
  defaultClient,
  fournisseurs = [],
  recents = [],
  dossiers = [],
}: {
  dossierId?: number;
  defaultClient?: string | null;
  // Fournisseurs connus (annuaire catalogue) : liste déroulante, saisie libre.
  fournisseurs?: string[];
  recents?: ArticleRecent[];
  // Dossiers proposés pour lier la commande (uniquement hors fiche dossier).
  dossiers?: DossierOption[];
}) {
  const [feedback, setFeedback] = useState<{ ok: boolean; msg: string } | null>(
    null
  );
  useEffect(() => {
    if (!feedback) return;
    const t = setTimeout(() => setFeedback(null), 3500);
    return () => clearTimeout(t);
  }, [feedback]);

  const initial: CommandeValues = {
    ...COMMANDE_VIDE,
    client: defaultClient ?? "",
  };
  const suffixe = dossierId ? `d${dossierId}` : "libre";

  return (
    <Formik
      initialValues={initial}
      validate={validerCommande}
      onSubmit={async (values, { resetForm }) => {
        const fd = versFormData(values);
        const res = dossierId
          ? await addCommande(dossierId, fd)
          : await addCommandeFourniture(fd);
        if (res?.ok) {
          resetForm();
          setFeedback({ ok: true, msg: "✓ Commande ajoutée" });
        } else {
          // Rien enregistré : la saisie est conservée.
          setFeedback({
            ok: false,
            msg: "Renseigne au moins un fournisseur ou une désignation.",
          });
        }
      }}
    >
      {({ isSubmitting }) => (
        <Form className="flex flex-wrap items-start gap-2 px-4 py-3">
          <ChampsArticle
            fournisseurs={fournisseurs}
            listId={`fourn-${suffixe}`}
            articles={recents}
          />
          {!dossierId && (
            <ChampDossierClient dossiers={dossiers} listId={`doss-${suffixe}`} />
          )}
          <ChampDate label="Date cde" name="dateCde" />
          <div className="flex items-center gap-2 self-end pb-px">
            <Button type="submit" size="sm" disabled={isSubmitting}>
              {isSubmitting ? "…" : "Ajouter"}
            </Button>
            {feedback && (
              <span
                role="status"
                className={`text-xs font-medium ${
                  feedback.ok ? "text-emerald-600" : "text-destructive"
                }`}
              >
                {feedback.msg}
              </span>
            )}
          </div>
        </Form>
      )}
    </Formik>
  );
}
