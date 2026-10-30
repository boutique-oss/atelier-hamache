"use client";

import { Field, FieldArray, Form, Formik, useFormikContext } from "formik";
import { Plus, Trash2 } from "lucide-react";
import { useState } from "react";

import { enregistrerPriseCotes } from "@/app/(main)/dossiers/prise-cotes-actions";
import { Button } from "@/components/ui/button";
import { PIECE_VIDE, type PieceCotes } from "@/lib/prise-cotes";

// Prise de cotes RIDEAUX sur tablette : même grille que la feuille papier
// (pièce, tringle, crochets, hauteur, tête, bas, unique/paire, retours,
// doublure, note). Grandes cases pour le doigt ; enregistrement explicite.

type Valeurs = { datePrise: string; pieces: PieceCotes[] };

const champ =
  "w-full rounded-lg border border-input bg-background px-3 py-2.5 text-base focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring";

function Cote({
  name,
  label,
  unite,
  decimal = true,
  className,
}: {
  name: string;
  label: string;
  unite?: string;
  decimal?: boolean;
  className?: string;
}) {
  return (
    <label className={`flex flex-col gap-1 text-sm ${className ?? ""}`}>
      <span className="font-medium">
        {label}
        {unite ? <span className="font-normal text-muted-foreground"> ({unite})</span> : null}
      </span>
      <Field name={name} inputMode={decimal ? "decimal" : undefined} className={champ} />
    </label>
  );
}

// Boutons à choix unique (Unique / Paire, Satinette / Occultant), re-cliquer
// désélectionne.
function Choix({ name, options }: { name: string; options: string[] }) {
  const { getFieldProps, setFieldValue } = useFormikContext<Valeurs>();
  const valeur = getFieldProps(name).value as string;
  return (
    <div className="flex gap-2">
      {options.map((o) => (
        <button
          key={o}
          type="button"
          onClick={() => setFieldValue(name, valeur === o ? "" : o)}
          className={`min-w-24 rounded-lg border px-4 py-2.5 text-base font-medium ${
            valeur === o ? "border-primary bg-primary text-primary-foreground" : "bg-background"
          }`}
        >
          {valeur === o ? "☒ " : "☐ "}
          {o}
        </button>
      ))}
    </div>
  );
}

export function PriseCotesForm({
  dossierId,
  pieces,
  datePrise,
}: {
  dossierId: number;
  pieces: PieceCotes[];
  datePrise: string | null;
}) {
  const [message, setMessage] = useState("");
  const aujourdhui = new Date().toISOString().slice(0, 10);

  return (
    <Formik<Valeurs>
      initialValues={{
        datePrise: datePrise ?? aujourdhui,
        pieces: pieces.length ? pieces : [{ ...PIECE_VIDE }],
      }}
      onSubmit={async (v, { resetForm }) => {
        const res = await enregistrerPriseCotes(dossierId, v.pieces, v.datePrise);
        setMessage(`✓ Prise de cotes enregistrée (${res.nb} pièce${res.nb > 1 ? "s" : ""}).`);
        resetForm({ values: v });
      }}
    >
      {({ values, isSubmitting, dirty }) => (
        <Form className="space-y-4">
          <label className="flex max-w-xs flex-col gap-1 text-sm">
            <span className="font-medium">Date de la prise de cotes</span>
            <Field name="datePrise" type="date" className={champ} />
          </label>

          <FieldArray name="pieces">
            {({ push, remove }) => (
              <div className="space-y-4">
                {values.pieces.map((p, i) => (
                  <fieldset key={i} className="rounded-xl border-2 p-4">
                    <legend className="px-2 text-base font-bold">Pièce {i + 1}</legend>
                    <div className="grid gap-3 sm:grid-cols-2">
                      <Cote name={`pieces.${i}.piece`} label="Pièce" decimal={false} className="sm:col-span-2" />
                      <Cote name={`pieces.${i}.longueurTringle`} label="Longueur de tringle" unite="m" />
                      <Cote name={`pieces.${i}.nbCrochets`} label="Nombre de crochets" />
                      <Cote name={`pieces.${i}.hauteurTringleSol`} label="Hauteur dessous de tringle / sol" unite="m" />
                      <Cote name={`pieces.${i}.typeTete`} label="Type de tête" decimal={false} />
                      <Cote name={`pieces.${i}.typeBas`} label="Type de bas" decimal={false} />
                      <div className="flex flex-col gap-1 text-sm">
                        <span className="font-medium">Unique / paire</span>
                        <Choix name={`pieces.${i}.uniquePaire`} options={["Unique", "Paire"]} />
                      </div>
                      {p.uniquePaire === "Unique" && (
                        <div className="grid grid-cols-2 gap-3 sm:col-span-2">
                          <Cote name={`pieces.${i}.uniqueG`} label="Si unique — G" />
                          <Cote name={`pieces.${i}.uniqueD`} label="Si unique — D" />
                        </div>
                      )}
                      <div className="grid grid-cols-2 gap-3 sm:col-span-2">
                        <Cote name={`pieces.${i}.retourG`} label="Retour G" />
                        <Cote name={`pieces.${i}.retourD`} label="Retour D" />
                      </div>
                      <div className="flex flex-col gap-1 text-sm sm:col-span-2">
                        <span className="font-medium">Doublure</span>
                        <Choix name={`pieces.${i}.doublure`} options={["Satinette", "Occultant"]} />
                      </div>
                      <label className="flex flex-col gap-1 text-sm sm:col-span-2">
                        <span className="font-medium">Note</span>
                        <Field as="textarea" name={`pieces.${i}.note`} rows={2} className={champ} />
                      </label>
                    </div>
                    <div className="mt-3 flex flex-wrap gap-3">
                      <button
                        type="button"
                        onClick={() => push({ ...p, piece: "", note: "" })}
                        className="text-sm text-primary hover:underline"
                        title="Nouvelle pièce avec les mêmes cotes"
                      >
                        Dupliquer cette pièce
                      </button>
                      {values.pieces.length > 1 && (
                        <button
                          type="button"
                          onClick={() => remove(i)}
                          className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-destructive"
                        >
                          <Trash2 size={14} /> Retirer
                        </button>
                      )}
                    </div>
                  </fieldset>
                ))}
                <Button type="button" variant="outline" onClick={() => push({ ...PIECE_VIDE })}>
                  <Plus size={16} /> Ajouter une pièce
                </Button>
              </div>
            )}
          </FieldArray>

          <div className="sticky bottom-0 flex flex-wrap items-center gap-3 border-t bg-background/95 py-3 backdrop-blur">
            <Button type="submit" size="lg" disabled={isSubmitting || !dirty}>
              {isSubmitting ? "Enregistrement…" : "Enregistrer la prise de cotes"}
            </Button>
            {dirty && <span className="text-sm text-amber-600">Modifications non enregistrées</span>}
            {!dirty && message && <span className="text-sm font-medium text-emerald-700">{message}</span>}
          </div>
        </Form>
      )}
    </Formik>
  );
}
