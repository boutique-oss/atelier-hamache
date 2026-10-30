"use client";

import { Field, FieldArray, Form, Formik } from "formik";
import { FileText, Upload } from "lucide-react";
import { useEffect, useMemo, useState, useTransition } from "react";

import {
  importerPdfFournisseur,
  lirePdfFournisseur,
} from "@/app/commandes/actions";
import type { DossierOption } from "@/components/commande-fields";
import { Button } from "@/components/ui/button";
import type { LigneLue } from "@/lib/pdf-commande";

// Import d'un PDF fournisseur (accusé de réception, bon de commande) :
//  1. on choisit le PDF → lecture du texte (sans IA) côté serveur ;
//  2. tableau des lignes repérées, à vérifier / corriger / cocher, avec le PDF
//     affiché à côté pour comparer ;
//  3. « Créer les commandes » : le PDF est gardé et relié à chaque commande.

type Ligne = {
  garder: boolean;
  reference: string;
  designation: string;
  coloris: string;
  qte: string;
  unite: string;
  montant: string;
  dossierId: string; // "" = sans dossier
  brut: string;
  probable: boolean;
};

type Valeurs = { fournisseur: string; dateCde: string; lignes: Ligne[] };

const cell =
  "w-full rounded border border-input bg-background px-1.5 py-1 text-xs focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring";

export function CommandesImportPdf({
  fournisseurs,
  dossiers,
}: {
  fournisseurs: string[];
  dossiers: DossierOption[];
}) {
  const [fichier, setFichier] = useState<File | null>(null);
  const [lu, setLu] = useState<{
    lignes: LigneLue[];
    date: string;
    fournisseur: string;
    pages: number;
  } | null>(null);
  const [erreur, setErreur] = useState("");
  const [succes, setSucces] = useState("");
  const [lecture, startLecture] = useTransition();
  const [toutes, setToutes] = useState(false);

  // Aperçu local du PDF (pas d'envoi tant qu'on n'a pas validé).
  const apercu = useMemo(
    () => (fichier ? URL.createObjectURL(fichier) : ""),
    [fichier]
  );
  useEffect(() => () => {
    if (apercu) URL.revokeObjectURL(apercu);
  }, [apercu]);

  function lire(f: File) {
    setErreur("");
    setSucces("");
    setLu(null);
    setFichier(f);
    const fd = new FormData();
    fd.set("fichier", f);
    startLecture(async () => {
      const res = await lirePdfFournisseur(fd);
      if (res.ok) setLu(res);
      else setErreur(res.error);
    });
  }

  function recommencer() {
    setFichier(null);
    setLu(null);
    setToutes(false);
  }

  const initial: Valeurs | null = lu
    ? {
        fournisseur: lu.fournisseur,
        dateCde: lu.date,
        lignes: lu.lignes
          .filter((l) => l.brut.trim())
          .map((l) => ({
            garder: l.probable,
            reference: l.reference,
            designation: l.designation,
            coloris: l.coloris,
            qte: l.qte,
            unite: l.unite || "ml",
            montant: l.montant,
            dossierId: "",
            brut: l.brut,
            probable: l.probable,
          })),
      }
    : null;

  return (
    <div className="px-4 py-3">
      {!lu && (
        <div className="flex flex-wrap items-center gap-3">
          <label className="inline-flex cursor-pointer items-center gap-1.5 rounded-md bg-primary px-3 py-1.5 text-sm font-medium text-primary-foreground hover:bg-primary/90">
            <Upload size={15} />
            {lecture ? "Lecture du PDF…" : "Choisir un PDF fournisseur"}
            <input
              type="file"
              accept="application/pdf,.pdf"
              className="hidden"
              disabled={lecture}
              onChange={(e) => {
                const f = e.target.files?.[0];
                if (f) lire(f);
                e.target.value = "";
              }}
            />
          </label>
          <span className="text-xs text-muted-foreground">
            Accusé de réception ou bon de commande · PDF « texte » (pas un scan) · 14 Mo max
          </span>
        </div>
      )}
      {erreur && !lu && (
        <p role="alert" className="mt-2 text-sm text-destructive">
          {erreur}
        </p>
      )}
      {succes && (
        <p role="status" className="mt-2 text-sm font-medium text-emerald-700">
          {succes}
        </p>
      )}

      {lu && initial && fichier && (
        <Formik
          initialValues={initial}
          validate={(v) =>
            v.fournisseur.trim() ? {} : { fournisseur: "Obligatoire" }
          }
          onSubmit={async (v) => {
            setErreur("");
            const lignes = v.lignes
              .filter((l) => l.garder && (l.designation.trim() || l.reference.trim()))
              .map((l) => ({
                reference: l.reference,
                designation: l.designation,
                coloris: l.coloris,
                qte: l.qte,
                unite: l.unite,
                montant: l.montant,
                dossierId: Number(l.dossierId) || null,
              }));
            if (lignes.length === 0) {
              setErreur("Coche au moins une ligne (avec une désignation ou une référence).");
              return;
            }
            const fd = new FormData();
            fd.set("fichier", fichier);
            fd.set(
              "donnees",
              JSON.stringify({ fournisseur: v.fournisseur, dateCde: v.dateCde, lignes })
            );
            const res = await importerPdfFournisseur(fd);
            if (res.ok) {
              setSucces(
                `✓ ${res.creees} commande${res.creees > 1 ? "s" : ""} créée${
                  res.creees > 1 ? "s" : ""
                } (cochées « Commandé »), PDF enregistré.`
              );
              recommencer();
            } else setErreur(res.error);
          }}
        >
          {({ values, isSubmitting, errors, setFieldValue }) => {
            const nbGardees = values.lignes.filter((l) => l.garder).length;
            const visibles = values.lignes
              .map((l, i) => ({ l, i }))
              .filter(({ l }) => toutes || l.probable || l.garder);
            return (
              <Form className="space-y-3">
                <div className="flex flex-wrap items-end gap-3">
                  <span className="inline-flex items-center gap-1.5 text-sm font-medium">
                    <FileText size={15} /> {fichier.name}
                    <span className="font-normal text-muted-foreground">
                      · {lu.pages} page{lu.pages > 1 ? "s" : ""}
                    </span>
                  </span>
                  <label className="flex flex-col gap-1 text-xs">
                    <span className="text-muted-foreground">Fournisseur</span>
                    <Field
                      name="fournisseur"
                      list="import-pdf-fournisseurs"
                      className={`${cell} w-44 text-sm`}
                    />
                    <datalist id="import-pdf-fournisseurs">
                      {fournisseurs.map((f) => (
                        <option key={f} value={f} />
                      ))}
                    </datalist>
                    {errors.fournisseur && (
                      <span className="text-destructive">{errors.fournisseur}</span>
                    )}
                  </label>
                  <label className="flex flex-col gap-1 text-xs">
                    <span className="text-muted-foreground">Date cde</span>
                    <Field name="dateCde" type="date" className={`${cell} text-sm`} />
                  </label>
                  <label className="flex flex-col gap-1 text-xs">
                    <span className="text-muted-foreground">Dossier pour toutes les lignes</span>
                    <select
                      defaultValue=""
                      onChange={(e) =>
                        values.lignes.forEach((_, i) =>
                          setFieldValue(`lignes.${i}.dossierId`, e.target.value)
                        )
                      }
                      className={`${cell} w-56 text-sm`}
                    >
                      <option value="">— sans dossier —</option>
                      {dossiers.map((d) => (
                        <option key={d.id} value={d.id}>
                          {d.nom}
                          {d.client && d.client !== d.nom ? ` — ${d.client}` : ""}
                        </option>
                      ))}
                    </select>
                  </label>
                  <label className="flex items-center gap-1.5 pb-1 text-xs">
                    <input
                      type="checkbox"
                      checked={toutes}
                      onChange={(e) => setToutes(e.target.checked)}
                    />
                    Afficher toutes les lignes du PDF
                  </label>
                </div>

                <div className="grid gap-3 xl:grid-cols-[minmax(0,1fr)_380px]">
                  <div className="overflow-x-auto rounded-md border">
                    <table className="w-full text-xs">
                      <thead className="bg-muted/40 text-left text-[10px] uppercase tracking-wider text-muted-foreground">
                        <tr>
                          <th className="px-1.5 py-1.5" />
                          <th className="px-1.5 py-1.5">Référence</th>
                          <th className="px-1.5 py-1.5">Désignation</th>
                          <th className="px-1.5 py-1.5">Coloris</th>
                          <th className="px-1.5 py-1.5">Métrage</th>
                          <th className="px-1.5 py-1.5">Unité</th>
                          <th className="px-1.5 py-1.5">Montant €</th>
                          <th className="px-1.5 py-1.5">Dossier</th>
                        </tr>
                      </thead>
                      <FieldArray name="lignes">
                        {() => (
                          <tbody>
                            {visibles.length === 0 && (
                              <tr>
                                <td colSpan={8} className="px-2 py-3 text-muted-foreground">
                                  Aucune ligne d&apos;article reconnue. Coche « Afficher
                                  toutes les lignes du PDF » pour les choisir à la main.
                                </td>
                              </tr>
                            )}
                            {visibles.map(({ l, i }) => (
                              <tr
                                key={i}
                                className={`border-t align-top ${l.garder ? "" : "opacity-50"}`}
                                title={l.brut}
                              >
                                <td className="px-1.5 py-1">
                                  <Field
                                    type="checkbox"
                                    name={`lignes.${i}.garder`}
                                    className="mt-1 h-4 w-4"
                                  />
                                </td>
                                <td className="w-28 px-1 py-1">
                                  <Field name={`lignes.${i}.reference`} className={cell} />
                                </td>
                                <td className="min-w-40 px-1 py-1">
                                  <Field name={`lignes.${i}.designation`} className={cell} />
                                  {!l.probable && (
                                    <span className="mt-0.5 block truncate text-[10px] text-muted-foreground">
                                      {l.brut}
                                    </span>
                                  )}
                                </td>
                                <td className="w-24 px-1 py-1">
                                  <Field name={`lignes.${i}.coloris`} className={cell} />
                                </td>
                                <td className="w-16 px-1 py-1">
                                  <Field
                                    name={`lignes.${i}.qte`}
                                    inputMode="decimal"
                                    className={cell}
                                  />
                                </td>
                                <td className="w-14 px-1 py-1">
                                  <Field name={`lignes.${i}.unite`} className={cell} />
                                </td>
                                <td className="w-20 px-1 py-1">
                                  <Field
                                    name={`lignes.${i}.montant`}
                                    inputMode="decimal"
                                    className={cell}
                                  />
                                </td>
                                <td className="w-40 px-1 py-1">
                                  <Field as="select" name={`lignes.${i}.dossierId`} className={cell}>
                                    <option value="">—</option>
                                    {dossiers.map((d) => (
                                      <option key={d.id} value={d.id}>
                                        {d.nom}
                                      </option>
                                    ))}
                                  </Field>
                                </td>
                              </tr>
                            ))}
                          </tbody>
                        )}
                      </FieldArray>
                    </table>
                  </div>

                  {/* Le PDF à côté, pour comparer ligne à ligne */}
                  <iframe
                    src={apercu}
                    title="Aperçu du PDF"
                    className="h-[520px] w-full rounded-md border bg-muted/20"
                  />
                </div>

                <div className="flex flex-wrap items-center gap-2">
                  <Button type="submit" size="sm" disabled={isSubmitting || nbGardees === 0}>
                    {isSubmitting
                      ? "Création…"
                      : `Créer ${nbGardees} commande${nbGardees > 1 ? "s" : ""}`}
                  </Button>
                  <Button type="button" variant="ghost" size="sm" onClick={recommencer}>
                    Annuler
                  </Button>
                  {erreur && (
                    <span role="alert" className="text-xs font-medium text-destructive">
                      {erreur}
                    </span>
                  )}
                  <span className="text-xs text-muted-foreground">
                    Survole une ligne pour voir le texte brut lu dans le PDF.
                  </span>
                </div>
              </Form>
            );
          }}
        </Formik>
      )}
    </div>
  );
}
