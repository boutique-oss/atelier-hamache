"use client";

import { Field, Form, Formik } from "formik";
import { Pencil } from "lucide-react";
import { useState } from "react";

import {
  patchDossier,
  type DossierPatch,
} from "@/app/(main)/dossiers/dossier-patch-actions";
import { FlagsEditor, StatutSelect } from "@/components/dossier-inline-edit";
import { Button } from "@/components/ui/button";
import { TYPES_INTERVENTION } from "@/lib/dossiers";

// Édition directe sur la fiche dossier : un clic sur un bloc le passe en
// champs (Formik), Enregistrer / Annuler (ou Échap). Pas de page séparée.

type Cle = keyof DossierPatch;
type Valeurs = Partial<Record<Cle, string>>;

export type ChampEditable = {
  name: Cle;
  label: string;
  type?: "text" | "email" | "tel" | "url" | "number" | "select" | "textarea";
  options?: string[]; // select
  suggestions?: string[]; // datalist (saisie libre)
  pleineLargeur?: boolean;
};

const inputCls =
  "w-full rounded-md border border-input bg-background px-2 py-1.5 text-sm focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring";

function ChampFormik({ c, prefixe }: { c: ChampEditable; prefixe: string }) {
  if (c.type === "select") {
    return (
      <Field as="select" name={c.name} className={inputCls}>
        {(c.options ?? []).map((o) => (
          <option key={o} value={o}>
            {o}
          </option>
        ))}
      </Field>
    );
  }
  if (c.type === "textarea") {
    return <Field as="textarea" name={c.name} rows={3} className={inputCls} />;
  }
  const listId = c.suggestions ? `${prefixe}-${c.name}` : undefined;
  return (
    <>
      <Field
        name={c.name}
        type={c.type === "number" ? "text" : c.type ?? "text"}
        inputMode={c.type === "number" ? "numeric" : undefined}
        list={listId}
        className={inputCls}
      />
      {listId && (
        <datalist id={listId}>
          {c.suggestions!.map((s) => (
            <option key={s} value={s} />
          ))}
        </datalist>
      )}
    </>
  );
}

// Formulaire Formik commun aux blocs : n'envoie que les champs modifiés.
function FormulaireBloc({
  dossierId,
  champs,
  valeurs,
  onFin,
  compact = false,
}: {
  dossierId: number;
  champs: ChampEditable[];
  valeurs: Valeurs;
  onFin: () => void;
  compact?: boolean;
}) {
  const [erreur, setErreur] = useState("");
  const initial = Object.fromEntries(
    champs.map((c) => [c.name, valeurs[c.name] ?? ""])
  ) as Record<Cle, string>;

  return (
    <Formik
      initialValues={initial}
      validate={(v) =>
        "nomDossier" in v && !v.nomDossier?.trim()
          ? { nomDossier: "Obligatoire" }
          : {}
      }
      onSubmit={async (v) => {
        const patch: DossierPatch = {};
        for (const c of champs) {
          if (v[c.name] !== initial[c.name]) patch[c.name] = v[c.name];
        }
        if (Object.keys(patch).length === 0) return onFin();
        const res = await patchDossier(dossierId, patch);
        if (res.ok) onFin();
        else setErreur(res.error ?? "Enregistrement impossible.");
      }}
    >
      {({ isSubmitting, dirty, errors }) => (
        <Form
          onKeyDown={(e) => {
            if (e.key === "Escape") onFin();
          }}
          className={
            compact
              ? "flex flex-wrap items-end gap-2"
              : "grid grid-cols-1 gap-3 sm:grid-cols-2"
          }
        >
          {champs.map((c) => (
            <label
              key={c.name}
              className={`flex flex-col gap-1 text-xs ${
                c.pleineLargeur && !compact ? "sm:col-span-2" : ""
              } ${compact ? "min-w-40 flex-1" : ""}`}
            >
              <span className="text-muted-foreground">{c.label}</span>
              <ChampFormik c={c} prefixe={`dos-${dossierId}`} />
              {errors[c.name] && (
                <span className="text-destructive">{errors[c.name]}</span>
              )}
            </label>
          ))}
          <div
            className={`flex items-center gap-2 ${compact ? "" : "sm:col-span-2"}`}
          >
            <Button type="submit" size="sm" disabled={isSubmitting || !dirty}>
              {isSubmitting ? "…" : "Enregistrer"}
            </Button>
            <Button type="button" variant="ghost" size="sm" onClick={onFin}>
              Annuler
            </Button>
            {erreur && <span className="text-xs text-destructive">{erreur}</span>}
          </div>
        </Form>
      )}
    </Formik>
  );
}

// Bloc (Client, Dossier…) : lecture, puis champs au clic.
export function BlocEditable({
  titre,
  dossierId,
  champs,
  valeurs,
  extra,
}: {
  titre: string;
  dossierId: number;
  champs: ChampEditable[];
  valeurs: Valeurs;
  // Lignes en lecture seule ajoutées sous les champs (agenda, planning…).
  extra?: React.ReactNode;
}) {
  const [edition, setEdition] = useState(false);

  if (edition) {
    return (
      <div className="rounded-lg border border-primary/40 p-4 text-sm ring-1 ring-primary/20">
        <h2 className="mb-3 font-semibold">{titre}</h2>
        <FormulaireBloc
          dossierId={dossierId}
          champs={champs}
          valeurs={valeurs}
          onFin={() => setEdition(false)}
        />
      </div>
    );
  }

  return (
    <div className="group rounded-lg border p-4 text-sm">
      <button
        type="button"
        onClick={() => setEdition(true)}
        className="-m-1 block w-full rounded-md p-1 text-left hover:bg-muted/40"
        title="Cliquer pour modifier"
      >
        <h2 className="mb-2 flex items-center justify-between font-semibold">
          {titre}
          <Pencil
            size={13}
            className="text-muted-foreground opacity-0 transition group-hover:opacity-100"
          />
        </h2>
        <dl className="space-y-1">
          {champs.map((c) => (
            <div key={c.name} className="flex gap-2">
              <dt className="w-28 shrink-0 text-muted-foreground">{c.label}</dt>
              <dd className="whitespace-pre-wrap break-words">
                {valeurs[c.name] || "—"}
              </dd>
            </div>
          ))}
        </dl>
      </button>
      {extra ? <dl className="mt-1 space-y-1">{extra}</dl> : null}
    </div>
  );
}

// Récap du haut : nom du dossier, client, téléphone, type — modifiable au
// clic ; statut et flags s'enregistrent directement.
export function RecapDossier({
  id,
  nomDossier,
  clientNom,
  telephone,
  typeIntervention,
  statut,
  flags,
  statutOptions,
}: {
  id: number;
  nomDossier: string;
  clientNom: string | null;
  telephone: string | null;
  typeIntervention: string | null;
  statut: string;
  flags: string[];
  statutOptions: string[];
}) {
  const [edition, setEdition] = useState(false);
  const valeurs: Valeurs = {
    nomDossier,
    clientNom: clientNom ?? "",
    telephone: telephone ?? "",
    typeIntervention: typeIntervention ?? "Autre",
  };

  return (
    <div className="mt-3 rounded-xl border bg-muted/20 p-4">
      {edition ? (
        <FormulaireBloc
          compact
          dossierId={id}
          valeurs={valeurs}
          onFin={() => setEdition(false)}
          champs={[
            { name: "nomDossier", label: "Dossier" },
            { name: "clientNom", label: "Client" },
            { name: "telephone", label: "Téléphone", type: "tel" },
            {
              name: "typeIntervention",
              label: "Type",
              type: "select",
              options: TYPES_INTERVENTION,
            },
          ]}
        />
      ) : (
        <button
          type="button"
          onClick={() => setEdition(true)}
          title="Cliquer pour modifier"
          className="group -m-1 block w-full rounded-md p-1 text-left hover:bg-muted/40"
        >
          <h1 className="flex items-center gap-2 text-2xl font-bold">
            {nomDossier}
            <Pencil
              size={15}
              className="text-muted-foreground opacity-0 transition group-hover:opacity-100"
            />
          </h1>
          <p className="mt-0.5 text-sm text-muted-foreground">
            {[clientNom || "Client ?", telephone, typeIntervention]
              .filter(Boolean)
              .join(" · ")}
          </p>
        </button>
      )}
      <div className="mt-3 flex flex-wrap items-center gap-3 text-xs">
        <StatutSelect
          key={statut}
          id={id}
          statut={statut}
          statutOptions={statutOptions}
        />
        <FlagsEditor key={flags.join(",")} id={id} flags={flags} />
      </div>
    </div>
  );
}
