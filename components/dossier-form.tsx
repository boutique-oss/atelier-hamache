"use client";

import Link from "next/link";
import { useState, useTransition } from "react";
import { useFormStatus } from "react-dom";

import { ajouterSousType } from "@/app/(main)/dossiers/actions";
import { Button } from "@/components/ui/button";
import {
  FLAGS_PREDEF,
  normalizeStatut,
  parseFlags,
  STATUTS_DOSSIER as STATUTS,
  TYPES_INTERVENTION as TYPES,
} from "@/lib/dossiers";
import { mondayIsoOf, weekSelectOptions } from "@/lib/weeks";

export type DossierFormValues = {
  id?: number;
  nomDossier?: string;
  clientNom?: string | null;
  telephone?: string | null;
  email?: string | null;
  adresse?: string | null;
  typeIntervention?: string | null;
  sousType?: string | null;
  placesAssises?: number | null;
  statut?: string;
  flags?: string | null;
  dateOuverture?: string | null;
  dateDevis?: string | null;
  dateDebutChantier?: string | null;
  dateFinChantier?: string | null;
  commentaireChantier?: string | null;
  dateEnlevementDepot?: string | null;
  dateLivraison?: string | null;
  datePriseDeCote?: string | null;
  commentaireEnlevement?: string | null;
  commentaireLivraison?: string | null;
  commentairePriseCote?: string | null;
  operateurId?: number | null;
  heuresARealiser?: number | null;
  commentaires?: string | null;
};

function Field({
  label,
  children,
  className,
}: {
  label: string;
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <label className={`flex flex-col gap-1 text-sm ${className ?? ""}`}>
      <span className="font-medium">{label}</span>
      {children}
    </label>
  );
}

// Section : regroupe des champs sous un intitulé, dans une grille à 2 colonnes.
function Section({
  title,
  children,
}: {
  title: string;
  children: React.ReactNode;
}) {
  return (
    <fieldset className="rounded-lg border p-4">
      <legend className="px-1 text-sm font-semibold">{title}</legend>
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">{children}</div>
    </fieldset>
  );
}

const inputCls =
  "rounded-md border border-input bg-background px-3 py-2 text-sm focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring";

function Submit({ edit }: { edit: boolean }) {
  const { pending } = useFormStatus();
  return (
    <Button type="submit" disabled={pending}>
      {pending ? "Enregistrement…" : edit ? "Enregistrer" : "Créer le dossier"}
    </Button>
  );
}

const AJOUT = "__ajout__";

// Liste des sous-types (type de réalisation) + ajout en direct : le choix
// « + Ajouter… » ouvre un champ ; le libellé est enregistré dans la liste
// partagée (base) puis sélectionné, sans quitter le formulaire.
function SousTypeField({
  initial,
  options,
}: {
  initial: string;
  options: string[];
}) {
  const [liste, setListe] = useState(() =>
    initial && !options.includes(initial) ? [...options, initial] : options
  );
  const [valeur, setValeur] = useState(initial);
  const [ajout, setAjout] = useState(false);
  const [saisie, setSaisie] = useState("");
  const [erreur, setErreur] = useState("");
  const [pending, start] = useTransition();

  const valider = () => {
    const v = saisie.trim();
    if (!v) return;
    setErreur("");
    start(async () => {
      try {
        const lib = await ajouterSousType(v);
        if (!lib) return setErreur("Libellé invalide");
        setListe((l) => (l.includes(lib) ? l : [...l, lib]));
        setValeur(lib);
        setSaisie("");
        setAjout(false);
      } catch {
        setErreur("Ajout impossible, réessaie");
      }
    });
  };

  return (
    <>
      <select
        name="sousType"
        value={ajout ? AJOUT : valeur}
        onChange={(e) => {
          if (e.target.value === AJOUT) {
            setAjout(true);
          } else {
            setAjout(false);
            setValeur(e.target.value);
          }
        }}
        className={inputCls}
      >
        <option value="">— Aucun —</option>
        {liste.map((t) => (
          <option key={t} value={t}>
            {t}
          </option>
        ))}
        <option value={AJOUT}>＋ Ajouter un type…</option>
      </select>
      {ajout && (
        <div className="mt-1 flex gap-2">
          <input
            autoFocus
            value={saisie}
            onChange={(e) => setSaisie(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter") {
                e.preventDefault();
                valider();
              } else if (e.key === "Escape") {
                setAjout(false);
              }
            }}
            placeholder="Nouveau type (ex. Méridienne)"
            className={`${inputCls} min-w-0 flex-1`}
          />
          <Button
            type="button"
            size="sm"
            disabled={pending || !saisie.trim()}
            onClick={valider}
          >
            {pending ? "…" : "Ajouter"}
          </Button>
        </div>
      )}
      {erreur && <span className="text-xs text-destructive">{erreur}</span>}
    </>
  );
}

export function DossierForm({
  action,
  dossier,
  operateurs = [],
  sousTypes = [],
}: {
  action: (fd: FormData) => void | Promise<void>;
  dossier?: DossierFormValues;
  operateurs?: { id: number; nom: string }[];
  sousTypes?: string[];
}) {
  const edit = !!dossier?.id;
  const d = dossier ?? {};
  // Étiquettes actuelles : pré-cochage + report des "autres" dans le champ libre.
  const currentFlags = parseFlags(d.flags);
  const extraFlags = currentFlags.filter((f) => !FLAGS_PREDEF.includes(f));
  return (
    <form action={action} className="space-y-4">
      {/* 1 — Client & dossier */}
      <Section title="Client & dossier">
        <Field label="Nom du dossier *" className="sm:col-span-2">
          <input
            name="nomDossier"
            required
            defaultValue={d.nomDossier ?? ""}
            className={inputCls}
          />
        </Field>
        <Field label="Client">
          <input
            name="clientNom"
            defaultValue={d.clientNom ?? ""}
            className={inputCls}
          />
        </Field>
        <Field label="Type">
          <select
            name="typeIntervention"
            defaultValue={d.typeIntervention ?? "Autre"}
            className={inputCls}
          >
            {TYPES.map((t) => (
              <option key={t} value={t}>
                {t}
              </option>
            ))}
          </select>
        </Field>
        <Field label="Type de réalisation">
          <SousTypeField initial={d.sousType ?? ""} options={sousTypes} />
        </Field>
        <Field label="Nombre de places assises">
          <input
            name="placesAssises"
            type="number"
            min="0"
            step="1"
            inputMode="numeric"
            defaultValue={d.placesAssises ?? ""}
            placeholder="ex. 3"
            className={inputCls}
          />
        </Field>
        <Field label="Téléphone">
          <input
            name="telephone"
            defaultValue={d.telephone ?? ""}
            className={inputCls}
          />
        </Field>
        <Field label="Email">
          <input
            name="email"
            type="email"
            defaultValue={d.email ?? ""}
            className={inputCls}
          />
        </Field>
        <Field label="Adresse" className="sm:col-span-2">
          <input
            name="adresse"
            defaultValue={d.adresse ?? ""}
            className={inputCls}
          />
        </Field>
      </Section>

      {/* 2 — Suivi commercial */}
      <Section title="Suivi commercial">
        <Field label="Statut">
          <select
            name="statut"
            defaultValue={d.statut ? normalizeStatut(d.statut) : "Nouveau"}
            className={inputCls}
          >
            {STATUTS.map((s) => (
              <option key={s} value={s}>
                {s}
              </option>
            ))}
          </select>
        </Field>
        <Field label="Date d'ouverture">
          <input
            name="dateOuverture"
            type="date"
            defaultValue={d.dateOuverture ?? ""}
            className={inputCls}
          />
        </Field>
        <Field label="Date de devis">
          <input
            name="dateDevis"
            type="date"
            defaultValue={d.dateDevis ?? ""}
            className={inputCls}
          />
        </Field>
      </Section>

      {/* 3 — Planning & dates clés (→ Google Agenda / planning) */}
      <Section title="Planning & dates clés">
        <Field label="Semaine de chantier (→ Google Agenda)">
          <select
            name="chantierSemaine"
            defaultValue={mondayIsoOf(d.dateDebutChantier)}
            className={inputCls}
          >
            <option value="">— Aucune —</option>
            {weekSelectOptions({
              include: mondayIsoOf(d.dateDebutChantier) || undefined,
            }).map((o) => (
              <option key={o.value} value={o.value}>
                {o.label}
              </option>
            ))}
          </select>
          <input
            name="commentaireChantier"
            defaultValue={d.commentaireChantier ?? ""}
            placeholder="Commentaire chantier"
            className={`${inputCls} mt-1`}
          />
        </Field>
        <Field label="Enlèvement / dépôt (→ planning · point rouge)">
          <input
            name="dateEnlevementDepot"
            type="date"
            defaultValue={d.dateEnlevementDepot ?? ""}
            className={inputCls}
          />
          <input
            name="commentaireEnlevement"
            defaultValue={d.commentaireEnlevement ?? ""}
            placeholder="Commentaire enlèvement / dépôt"
            className={`${inputCls} mt-1`}
          />
        </Field>
        <Field label="Livraison (→ planning · point vert)">
          <input
            name="dateLivraison"
            type="date"
            defaultValue={d.dateLivraison ?? ""}
            className={inputCls}
          />
          <input
            name="commentaireLivraison"
            defaultValue={d.commentaireLivraison ?? ""}
            placeholder="Commentaire livraison"
            className={`${inputCls} mt-1`}
          />
        </Field>
        <Field label="Prise de cote (→ planning · carré jaune)">
          <input
            name="datePriseDeCote"
            type="date"
            defaultValue={d.datePriseDeCote ?? ""}
            className={inputCls}
          />
          <input
            name="commentairePriseCote"
            defaultValue={d.commentairePriseCote ?? ""}
            placeholder="Commentaire prise de cote"
            className={`${inputCls} mt-1`}
          />
        </Field>
      </Section>

      {/* 4 — Atelier */}
      {/* L'affectation se fait sur les fiches atelier ; le dossier n'en est que
          le total. Valeurs actuelles renvoyées telles quelles (lecture seule). */}
      <Section title="Atelier">
        <input type="hidden" name="operateurId" value={d.operateurId ? String(d.operateurId) : ""} />
        <input type="hidden" name="heuresARealiser" value={String(d.heuresARealiser ?? 0)} />
        <div className="text-sm sm:col-span-2">
          <span className="font-medium">Affectation : </span>
          {String(d.heuresARealiser ?? 0).replace(".", ",")} h
          {d.operateurId
            ? ` · ${operateurs.find((o) => o.id === d.operateurId)?.nom ?? "opérateur"}`
            : ""}
          <p className="mt-1 text-xs text-muted-foreground">
            Calculée depuis les fiches atelier : l&apos;opérateur et les heures se règlent sur
            chaque fiche de travail.
          </p>
        </div>
      </Section>

      {/* 5 — Étiquettes */}
      <fieldset className="rounded-lg border p-4">
        <legend className="px-1 text-sm font-semibold">Étiquettes</legend>
        <div className="flex flex-wrap gap-x-4 gap-y-2">
          {FLAGS_PREDEF.map((f) => (
            <label key={f} className="flex items-center gap-1.5 text-sm">
              <input
                type="checkbox"
                name="flagsList"
                value={f}
                defaultChecked={currentFlags.includes(f)}
                className="h-4 w-4 rounded border-input"
              />
              {f}
            </label>
          ))}
        </div>
        <input
          name="flagsExtra"
          defaultValue={extraFlags.join(", ")}
          placeholder="Autres étiquettes, séparées par des virgules"
          className={`${inputCls} mt-2 w-full`}
        />
      </fieldset>

      {/* 6 — Commentaires */}
      <fieldset className="rounded-lg border p-4">
        <legend className="px-1 text-sm font-semibold">Commentaires</legend>
        <textarea
          name="commentaires"
          rows={4}
          defaultValue={d.commentaires ?? ""}
          className={`${inputCls} w-full`}
        />
      </fieldset>

      <div className="flex items-center gap-3">
        <Submit edit={edit} />
        <Link
          href={edit ? `/dossiers/${d.id}` : "/dossiers"}
          className="text-sm text-muted-foreground hover:underline"
        >
          Annuler
        </Link>
      </div>
    </form>
  );
}
