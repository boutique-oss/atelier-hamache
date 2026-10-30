"use client";

import { Field, FieldArray, Form, Formik } from "formik";
import { Puzzle, Upload, X } from "lucide-react";
import { useState, useTransition } from "react";

import { creerFichesRecoupees, preparerFicheRecoupee } from "@/app/devis-signes/actions";
import { Button } from "@/components/ui/button";
import { PIECE_VIDE } from "@/lib/prise-cotes";
import type { FicheProposee, Recoupement } from "@/lib/recoupement";

// « Fiches recoupées » : on dépose en même temps les PDF du dossier (devis
// EBP…), l'ERP y ajoute les devis signés lisibles et la prise de cotes saisie
// sur tablette, recoupe le tout et propose UNE fiche de travail PAR MÉTIER
// (rideaux, tapisserie…), chacune avec son opérateur et ses heures.

type FicheForm = Omit<FicheProposee, "etapes"> & { etapes: string };

const cell =
  "w-full rounded border border-input bg-background px-1.5 py-1 text-xs focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring";

function Champ({ name, label, className }: { name: string; label: string; className?: string }) {
  return (
    <label className={`flex flex-col gap-0.5 text-[11px] ${className ?? ""}`}>
      <span className="text-muted-foreground">{label}</span>
      <Field name={name} className={cell} />
    </label>
  );
}

// Carte d'une fiche proposée (champs nommés `fiches.<k>.…`).
function CarteFiche({
  k,
  f,
  operateurs,
}: {
  k: number;
  f: FicheForm;
  operateurs: { id: number; nom: string }[];
}) {
  const p = `fiches.${k}`;
  return (
    <fieldset className="space-y-3 rounded-xl border-2 p-3">
      <legend className="px-2 text-sm font-bold">
        Fiche {k + 1} — {f.metier}
      </legend>

      {/* En-tête + affectation */}
      <div className="grid grid-cols-2 gap-2 sm:grid-cols-6">
        <Champ name={`${p}.realisation`} label="Ouvrage" className="col-span-2" />
        <Champ name={`${p}.quantite`} label="Quantité" />
        <Champ name={`${p}.heures`} label="Heures prévues" />
        <label className="col-span-2 flex flex-col gap-0.5 text-[11px]">
          <span className="text-muted-foreground">Opérateur</span>
          <Field as="select" name={`${p}.operateurId`} className={cell}>
            <option value="">— à affecter —</option>
            {operateurs.map((o) => (
              <option key={o.id} value={o.id}>
                {o.nom}
              </option>
            ))}
          </Field>
        </label>
        {f.metier === "Rideaux" && (
          <>
            <Champ name={`${p}.typeTete`} label="Type de tête" className="col-span-3" />
            <Champ name={`${p}.doublure`} label="Doublure" className="col-span-3" />
          </>
        )}
      </div>

      {/* Cotes par pièce (rideaux) */}
      {f.metier === "Rideaux" && (
        <FieldArray name={`${p}.cotes`}>
          {({ push, remove }) => (
            <div>
              <p className="mb-1 text-xs font-semibold">Cotes par pièce (prise de cotes)</p>
              <div className="overflow-x-auto rounded-md border">
                <table className="w-full text-xs">
                  <thead className="bg-muted/40 text-left text-[10px] uppercase text-muted-foreground">
                    <tr>
                      {["Pièce", "Tringle (m)", "Crochets", "Haut. tringle/sol", "Tête", "Bas", "Unique/Paire", "Retour G", "Retour D", "Doublure", "Note", ""].map((h) => (
                        <th key={h} className="px-1.5 py-1">{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {f.cotes.map((_, i) => (
                      <tr key={i} className="border-t">
                        {(["piece", "longueurTringle", "nbCrochets", "hauteurTringleSol", "typeTete", "typeBas"] as const).map((c) => (
                          <td key={c} className="px-1 py-1"><Field name={`${p}.cotes.${i}.${c}`} className={cell} /></td>
                        ))}
                        <td className="px-1 py-1">
                          <Field as="select" name={`${p}.cotes.${i}.uniquePaire`} className={cell}>
                            <option value="">—</option><option>Unique</option><option>Paire</option>
                          </Field>
                        </td>
                        <td className="px-1 py-1"><Field name={`${p}.cotes.${i}.retourG`} className={cell} /></td>
                        <td className="px-1 py-1"><Field name={`${p}.cotes.${i}.retourD`} className={cell} /></td>
                        <td className="px-1 py-1">
                          <Field as="select" name={`${p}.cotes.${i}.doublure`} className={cell}>
                            <option value="">—</option><option>Satinette</option><option>Occultant</option>
                          </Field>
                        </td>
                        <td className="min-w-40 px-1 py-1"><Field name={`${p}.cotes.${i}.note`} className={cell} /></td>
                        <td className="px-1"><button type="button" onClick={() => remove(i)} className="text-muted-foreground hover:text-destructive"><X size={12} /></button></td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              <button type="button" onClick={() => push({ ...PIECE_VIDE })} className="mt-1 text-xs text-primary hover:underline">+ Ajouter une pièce</button>
            </div>
          )}
        </FieldArray>
      )}

      {/* À réaliser (devis) */}
      <FieldArray name={`${p}.aRealiser`}>
        {({ push, remove }) => (
          <div>
            <p className="mb-1 text-xs font-semibold">À réaliser (devis)</p>
            {f.aRealiser.map((_, i) => (
              <div key={i} className="mb-1 grid grid-cols-[1fr_70px_3fr_20px] gap-1">
                <Field name={`${p}.aRealiser.${i}.realisation`} className={cell} />
                <Field name={`${p}.aRealiser.${i}.quantite`} className={cell} />
                <Field name={`${p}.aRealiser.${i}.detail`} className={cell} />
                <button type="button" onClick={() => remove(i)} className="text-muted-foreground hover:text-destructive"><X size={12} /></button>
              </div>
            ))}
            <button type="button" onClick={() => push({ realisation: "", quantite: "", detail: "" })} className="text-xs text-primary hover:underline">+ Ajouter</button>
          </div>
        )}
      </FieldArray>

      {/* Tissus & fournitures */}
      <FieldArray name={`${p}.tissus`}>
        {({ push, remove }) => (
          <div>
            <p className="mb-1 text-xs font-semibold">Tissus & fournitures (devis)</p>
            {f.tissus.map((_, i) => (
              <div key={i} className="mb-1 grid grid-cols-[3fr_1fr_1fr_1fr_20px] gap-1">
                <Field name={`${p}.tissus.${i}.ref`} placeholder="Référence / nom" className={cell} />
                <Field name={`${p}.tissus.${i}.coloris`} placeholder="Coloris" className={cell} />
                <Field name={`${p}.tissus.${i}.metrage`} placeholder="Métrage" className={cell} />
                <Field name={`${p}.tissus.${i}.placement`} placeholder="Placement" className={cell} />
                <button type="button" onClick={() => remove(i)} className="text-muted-foreground hover:text-destructive"><X size={12} /></button>
              </div>
            ))}
            <button type="button" onClick={() => push({ ref: "", coloris: "", metrage: "", placement: "" })} className="text-xs text-primary hover:underline">+ Ajouter</button>
          </div>
        )}
      </FieldArray>

      <label className="flex flex-col gap-0.5 text-[11px]">
        <span className="text-xs font-semibold">Étapes (une par ligne)</span>
        <Field as="textarea" name={`${p}.etapes`} rows={Math.max(3, f.etapes.split("\n").length)} className={cell} />
      </label>
    </fieldset>
  );
}

export function FicheRecoupeeBouton({
  dossierId,
  operateurs,
}: {
  dossierId: number;
  operateurs: { id: number; nom: string }[];
}) {
  const [ouvert, setOuvert] = useState(false);
  const [fichiers, setFichiers] = useState<File[]>([]);
  const [prop, setProp] = useState<Recoupement | null>(null);
  const [creees, setCreees] = useState<number[] | null>(null);
  const [lecture, startLecture] = useTransition();

  function recouper() {
    const fd = new FormData();
    for (const f of fichiers) fd.append("fichiers", f);
    startLecture(async () => setProp(await preparerFicheRecoupee(dossierId, fd)));
  }
  function fermer() {
    setOuvert(false);
    setProp(null);
    setFichiers([]);
    setCreees(null);
  }

  return (
    <>
      <button
        type="button"
        onClick={() => setOuvert(true)}
        className="inline-flex items-center gap-1 text-xs font-medium text-primary hover:underline"
        title="Recouper devis + prise de cotes en fiches de travail (une par métier)"
      >
        <Puzzle size={13} /> Fiches recoupées
      </button>

      {ouvert && (
        <div role="dialog" aria-modal="true" aria-label="Fiches de travail" className="fixed inset-0 z-50 flex justify-center overflow-y-auto bg-black/40 p-2 sm:p-6">
          <div className="h-fit w-full max-w-5xl rounded-xl border bg-background shadow-2xl">
            <div className="flex items-center justify-between border-b px-4 py-3">
              <h2 className="text-sm font-semibold">Fiches de travail — recoupement des fichiers du dossier</h2>
              <button type="button" onClick={fermer} className="rounded-md p-1 text-muted-foreground hover:bg-accent" title="Fermer" aria-label="Fermer">
                <X size={16} />
              </button>
            </div>

            {creees ? (
              <div className="space-y-3 px-4 py-6 text-sm">
                <p className="font-medium text-emerald-700">
                  ✓ {creees.length} fiche{creees.length > 1 ? "s" : ""} de travail créée{creees.length > 1 ? "s" : ""}. Le dossier a été recalculé (heures, type, opérateur).
                </p>
                <div className="flex gap-2">
                  <a href={`/fiche-impression/dossier/${dossierId}`} target="_blank" rel="noopener noreferrer">
                    <Button size="sm">🖨 Imprimer les fiches</Button>
                  </a>
                  <Button size="sm" variant="ghost" onClick={fermer}>Fermer</Button>
                </div>
              </div>
            ) : !prop ? (
              // Étape 1 : déposer les fichiers, puis recouper.
              <div className="space-y-3 px-4 py-5 text-sm">
                <p>
                  Dépose ensemble les PDF du dossier (devis EBP d&apos;origine…). Les devis signés lisibles du
                  dossier et la <strong>prise de cotes saisie sur tablette</strong> sont ajoutés automatiquement.
                  Résultat : une fiche de travail par métier (rideaux, tapisserie…).
                </p>
                <label className="inline-flex cursor-pointer items-center gap-1.5 rounded-md border px-3 py-1.5 hover:bg-accent">
                  <Upload size={15} /> Choisir des PDF
                  <input
                    type="file"
                    multiple
                    accept="application/pdf,.pdf"
                    className="hidden"
                    onChange={(e) => {
                      const nouveaux = Array.from(e.target.files ?? []);
                      setFichiers((f) => [...f, ...nouveaux]);
                      e.target.value = "";
                    }}
                  />
                </label>
                {fichiers.length > 0 && (
                  <ul className="space-y-1 text-xs">
                    {fichiers.map((f, i) => (
                      <li key={i} className="flex items-center gap-2">
                        📄 {f.name}
                        <button type="button" onClick={() => setFichiers((l) => l.filter((_, j) => j !== i))} className="text-muted-foreground hover:text-destructive">
                          <X size={12} />
                        </button>
                      </li>
                    ))}
                  </ul>
                )}
                <div>
                  <Button size="sm" onClick={recouper} disabled={lecture}>
                    {lecture ? "Recoupement…" : "Recouper les informations"}
                  </Button>
                </div>
              </div>
            ) : (
              // Étape 2 : fiches proposées, ajustables.
              <Formik<{ fiches: FicheForm[] }>
                initialValues={{ fiches: prop.fiches.map((f) => ({ ...f, etapes: f.etapes.join("\n") })) }}
                onSubmit={async (v) => {
                  const res = await creerFichesRecoupees(
                    dossierId,
                    v.fiches.map((f) => ({
                      ...f,
                      etapes: f.etapes.split("\n").map((e) => e.trim()).filter(Boolean),
                    }))
                  );
                  if (res.ok) setCreees(res.ficheIds);
                }}
              >
                {({ values, isSubmitting }) => (
                  <Form className="space-y-4 px-4 py-4">
                    <div className="rounded-lg border bg-muted/30 p-3 text-xs">
                      <p className="mb-1 font-semibold">Fichiers recoupés</p>
                      <ul className="space-y-0.5">
                        {prop.sources.map((s, i) => (
                          <li key={i} className={s.ok ? "" : "text-muted-foreground"}>
                            {s.ok ? "✓" : "✗"} {s.nom} — {s.detail}
                          </li>
                        ))}
                      </ul>
                    </div>
                    {prop.aVerifier.length > 0 && (
                      <div className="rounded-lg border border-amber-300 bg-amber-50 p-3 text-xs text-amber-900">
                        <p className="mb-1 font-semibold">À vérifier</p>
                        <ul className="list-inside list-disc">
                          {prop.aVerifier.map((a, i) => (
                            <li key={i}>{a}</li>
                          ))}
                        </ul>
                      </div>
                    )}

                    <FieldArray name="fiches">
                      {({ remove }) => (
                        <div className="space-y-4">
                          {values.fiches.length === 0 && (
                            <p className="text-sm text-muted-foreground">
                              Rien à recouper : dépose un devis EBP lisible ou saisis la prise de cotes.
                            </p>
                          )}
                          {values.fiches.map((f, k) => (
                            <div key={k} className="relative">
                              <CarteFiche k={k} f={f} operateurs={operateurs} />
                              <button
                                type="button"
                                onClick={() => remove(k)}
                                className="absolute right-3 top-0 bg-background px-1 text-xs text-muted-foreground hover:text-destructive"
                              >
                                Ne pas créer cette fiche
                              </button>
                            </div>
                          ))}
                        </div>
                      )}
                    </FieldArray>

                    <div className="flex flex-wrap items-center gap-2 border-t pt-3">
                      <Button type="submit" size="sm" disabled={isSubmitting || values.fiches.length === 0}>
                        {isSubmitting
                          ? "Création…"
                          : `Créer ${values.fiches.length} fiche${values.fiches.length > 1 ? "s" : ""} de travail`}
                      </Button>
                      <Button type="button" variant="ghost" size="sm" onClick={() => setProp(null)}>
                        ← Changer de fichiers
                      </Button>
                    </div>
                  </Form>
                )}
              </Formik>
            )}
          </div>
        </div>
      )}
    </>
  );
}
