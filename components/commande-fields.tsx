"use client";

import { Field, useFormikContext } from "formik";
import { useState } from "react";

import type { ArticleRecent } from "@/app/commandes/actions";
import { parseNum } from "@/lib/utils";

// Champs communs aux formulaires de commande (saisie + fenêtre de
// modification), pilotés par Formik : valeurs, erreurs par champ, champs
// touchés, état « modifié non enregistré ».

export type DossierOption = { id: number; nom: string; client: string | null };

export type CommandeValues = {
  fournisseur: string;
  designation: string;
  reference: string;
  coloris: string;
  qte: string;
  unite: string;
  montant: string;
  dateCde: string;
  dateLivraison: string;
  // Client lié : dossier existant (dossierId) ou nom de client libre.
  dossierId: number | null;
  client: string;
  commentaires: string;
  estCommande: boolean;
  estRecu: boolean;
};

export const COMMANDE_VIDE: CommandeValues = {
  fournisseur: "",
  designation: "",
  reference: "",
  coloris: "",
  qte: "",
  unite: "ml",
  montant: "",
  dateCde: "",
  dateLivraison: "",
  dossierId: null,
  client: "",
  commentaires: "",
  estCommande: false,
  estRecu: false,
};

// Validation (même règle que le serveur) + nombres lisibles.
export function validerCommande(v: CommandeValues) {
  const e: Partial<Record<keyof CommandeValues, string>> = {};
  if (!v.fournisseur.trim() && !v.designation.trim()) {
    e.designation = "Fournisseur ou désignation obligatoire";
  }
  if (v.qte.trim() && parseNum(v.qte) === null) e.qte = "Nombre illisible";
  if (v.montant.trim() && parseNum(v.montant) === null) {
    e.montant = "Nombre illisible";
  }
  return e;
}

// Formulaire → FormData pour les actions serveur de saisie existantes.
export function versFormData(v: CommandeValues): FormData {
  const fd = new FormData();
  for (const [k, val] of Object.entries(v)) {
    if (val === null || typeof val === "boolean") continue;
    fd.set(k, String(val));
  }
  if (v.dossierId) fd.set("dossierId", String(v.dossierId));
  return fd;
}

export const inputCls =
  "rounded-md border border-input bg-background px-2 py-1.5 text-sm focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring";

function Erreur({ name }: { name: keyof CommandeValues }) {
  const { errors, touched, submitCount } = useFormikContext<CommandeValues>();
  const msg = errors[name];
  if (!msg || (!touched[name] && submitCount === 0)) return null;
  return <span className="text-[11px] text-destructive">{msg as string}</span>;
}

function Champ({
  label,
  name,
  className,
  ...rest
}: {
  label: string;
  name: keyof CommandeValues;
  className?: string;
} & React.InputHTMLAttributes<HTMLInputElement>) {
  return (
    <label className={`flex flex-col gap-1 text-xs ${className ?? ""}`}>
      <span className="text-muted-foreground">{label}</span>
      <Field name={name} className={`${inputCls} w-full`} {...rest} />
      <Erreur name={name} />
    </label>
  );
}

// Article (fournisseur, désignation, réf, coloris, qté, unité, montant).
// Champ avec propositions : les articles déjà saisis qui correspondent à la
// frappe, 3 au maximum, sous le champ (les plus récents d'abord ; champ vide
// = les 3 derniers). Choisir une proposition en Désignation / Référence
// remplit l'article entier ; en Coloris, seulement le coloris.
function ChampSuggere({
  label,
  name,
  articles,
  className,
  placeholder,
}: {
  label: string;
  name: "designation" | "reference" | "coloris";
  articles: ArticleRecent[];
  className?: string;
  placeholder?: string;
}) {
  const { values, setValues, setFieldValue, handleBlur } =
    useFormikContext<CommandeValues>();
  const [ouvert, setOuvert] = useState(false);
  const [actif, setActif] = useState(0);

  const saisie = values[name].trim().toLowerCase();
  const vus = new Set<string>();
  const propositions: ArticleRecent[] = [];
  for (const a of articles) {
    const v = a[name];
    if (!v) continue;
    const lv = v.toLowerCase();
    if (saisie && (!lv.includes(saisie) || lv === saisie)) continue;
    // Coloris : un même coloris n'est proposé qu'une fois.
    const cle =
      name === "coloris"
        ? lv
        : [a.fournisseur, a.designation, a.reference].join("|").toLowerCase();
    if (vus.has(cle)) continue;
    vus.add(cle);
    propositions.push(a);
    if (propositions.length >= 3) break;
  }

  function choisir(a: ArticleRecent) {
    if (name === "coloris") setFieldValue("coloris", a.coloris);
    else
      setValues({
        ...values,
        fournisseur: a.fournisseur || values.fournisseur,
        designation: a.designation,
        reference: a.reference,
        coloris: a.coloris || values.coloris,
        unite: a.unite || values.unite,
      });
    setOuvert(false);
  }

  const libelle = (a: ArticleRecent) =>
    name === "coloris"
      ? [a.coloris, a.designation || a.reference].filter(Boolean).join(" — ")
      : [a.designation, a.reference, a.fournisseur].filter(Boolean).join(" · ");

  return (
    <label className={`relative flex flex-col gap-1 text-xs ${className ?? ""}`}>
      <span className="text-muted-foreground">{label}</span>
      <Field
        name={name}
        autoComplete="off"
        placeholder={placeholder}
        className={`${inputCls} w-full`}
        onFocus={() => {
          setOuvert(true);
          setActif(0);
        }}
        onBlur={(e: React.FocusEvent<HTMLInputElement>) => {
          handleBlur(e);
          setOuvert(false);
        }}
        onInput={() => {
          setOuvert(true);
          setActif(0);
        }}
        onKeyDown={(e: React.KeyboardEvent<HTMLInputElement>) => {
          if (!ouvert || propositions.length === 0) return;
          if (e.key === "ArrowDown") {
            e.preventDefault();
            setActif((i) => (i + 1) % propositions.length);
          } else if (e.key === "ArrowUp") {
            e.preventDefault();
            setActif((i) => (i - 1 + propositions.length) % propositions.length);
          } else if (e.key === "Enter") {
            e.preventDefault();
            choisir(propositions[actif] ?? propositions[0]);
          } else if (e.key === "Escape") {
            setOuvert(false);
          }
        }}
      />
      {ouvert && propositions.length > 0 && (
        <ul className="absolute left-0 top-full z-30 mt-1 w-max min-w-full max-w-80 overflow-hidden rounded-md border bg-background py-1 shadow-md">
          {propositions.map((a, i) => (
            <li key={i}>
              <button
                type="button"
                // mousedown : avant le blur du champ, qui fermerait la liste.
                onMouseDown={(e) => {
                  e.preventDefault();
                  choisir(a);
                }}
                className={`block w-full truncate px-2.5 py-1.5 text-left text-xs ${
                  i === actif ? "bg-accent" : "hover:bg-muted"
                }`}
              >
                {libelle(a)}
              </button>
            </li>
          ))}
        </ul>
      )}
      <Erreur name={name} />
    </label>
  );
}

export function ChampsArticle({
  fournisseurs,
  listId,
  articles = [],
}: {
  fournisseurs: string[];
  listId: string;
  // Articles déjà saisis (suggestions Désignation / Référence / Coloris).
  articles?: ArticleRecent[];
}) {
  return (
    <>
      <Champ label="Fournisseur" name="fournisseur" list={listId} className="w-40" />
      <datalist id={listId}>
        {fournisseurs.map((f) => (
          <option key={f} value={f} />
        ))}
      </datalist>
      <ChampSuggere
        label="Désignation"
        name="designation"
        articles={articles}
        className="min-w-48 flex-1"
        placeholder="Ex : velours, mousse HR 35…"
      />
      <ChampSuggere
        label="Référence"
        name="reference"
        articles={articles}
        className="w-32"
      />
      <ChampSuggere label="Coloris" name="coloris" articles={articles} className="w-28" />
      <Champ label="Qté" name="qte" inputMode="decimal" placeholder="0" className="w-20" />
      <Champ label="Unité" name="unite" className="w-16" />
      <Champ
        label="Montant €"
        name="montant"
        inputMode="decimal"
        placeholder="0"
        className="w-24"
      />
    </>
  );
}

export function ChampDate({
  label,
  name,
}: {
  label: string;
  name: "dateCde" | "dateLivraison";
}) {
  return <Champ label={label} name={name} type="date" className="w-36" />;
}

// Libellé affiché pour un dossier dans la liste de choix.
const libelleDossier = (d: DossierOption) =>
  `${d.nom}${d.client && d.client !== d.nom ? ` — ${d.client}` : ""} (#${d.id})`;

// « Dossier / client » : recherche dans les dossiers existants (liste
// déroulante filtrée en tapant). Un dossier reconnu lie la commande ; sinon le
// texte est gardé comme nom de client libre (commande sans dossier).
export function ChampDossierClient({
  dossiers,
  listId,
}: {
  dossiers: DossierOption[];
  listId: string;
}) {
  const { values, setFieldValue } = useFormikContext<CommandeValues>();
  const lie = values.dossierId
    ? dossiers.find((d) => d.id === values.dossierId)
    : null;
  const affichage = lie ? libelleDossier(lie) : values.client;

  function changer(texte: string) {
    const trouve = dossiers.find((d) => libelleDossier(d) === texte);
    if (trouve) {
      setFieldValue("dossierId", trouve.id);
      setFieldValue("client", trouve.client || trouve.nom);
    } else {
      setFieldValue("dossierId", null);
      setFieldValue("client", texte);
    }
  }

  return (
    <label className="flex min-w-56 flex-1 flex-col gap-1 text-xs">
      <span className="text-muted-foreground">
        Dossier / client{" "}
        {lie ? (
          <span className="font-medium text-emerald-700">· lié au dossier #{lie.id}</span>
        ) : values.client.trim() ? (
          <span className="text-muted-foreground">· client libre, sans dossier</span>
        ) : null}
      </span>
      <input
        value={affichage}
        onChange={(e) => changer(e.target.value)}
        list={listId}
        placeholder="Tape le nom du dossier ou du client…"
        className={`${inputCls} w-full`}
      />
      <datalist id={listId}>
        {dossiers.map((d) => (
          <option key={d.id} value={libelleDossier(d)} />
        ))}
      </datalist>
    </label>
  );
}
