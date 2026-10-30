"use client";

import { Field, FieldArray, Form, Formik } from "formik";
import { Upload, Wand2, X } from "lucide-react";
import { useState, useTransition } from "react";

import {
  appliquerDevis,
  lireDevisFichier,
  lireDevisSigne,
} from "@/app/devis-signes/actions";
import { Button } from "@/components/ui/button";
import type { DevisLu } from "@/lib/devis-pdf";
import { SCHEMAS } from "@/lib/fiches-schemas";
import { typesRealisationPour } from "@/lib/types-realisation";

// « Remplir depuis ce devis » : lit le PDF EBP du devis signé, puis propose un
// formulaire ajustable — infos client du dossier, une ligne Travaux par
// ouvrage, une fiche atelier pré-remplie (mesures, tête, doublure…). Rien
// n'est écrit avant « Appliquer au dossier ».

export type ClientActuel = {
  clientNom: string;
  adresse: string;
  telephone: string;
  email: string;
  dateDevis: string;
};

type ChampClient = keyof ClientActuel;
const CHAMPS_CLIENT: { k: ChampClient; label: string; type?: string }[] = [
  { k: "clientNom", label: "Nom du client" },
  { k: "adresse", label: "Adresse" },
  { k: "telephone", label: "Téléphone", type: "tel" },
  { k: "email", label: "Email", type: "email" },
  { k: "dateDevis", label: "Date du devis", type: "date" },
];

const METIERS = ["Tapisserie", "Rideaux", "Atelier", "Autre"];
const TYPES_FICHE = Object.keys(SCHEMAS);

type Ouvrage = {
  garder: boolean;
  texte: string;
  metier: string;
  realisation: string;
  quantite: string;
  heuresPrevues: string;
  creerFiche: boolean;
  ficheType: string;
  contenu: Record<string, string>;
  tissus: { ref: string; coloris: string; metrage: string; placement: string }[];
  etapes: string; // une étape par ligne
  piece: string;
  tissuClient: boolean;
  composants: string[];
  probable: boolean;
};

type Valeurs = {
  numero: string;
  client: Record<ChampClient, { appliquer: boolean; valeur: string }>;
  ouvrages: Ouvrage[];
};

const cell =
  "w-full rounded border border-input bg-background px-1.5 py-1 text-xs focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring";

function versValeurs(d: DevisLu, actuel: ClientActuel): Valeurs {
  const lu: ClientActuel = {
    clientNom: d.client.nom,
    adresse: d.client.adresse,
    telephone: d.client.telephone,
    email: d.client.email,
    dateDevis: d.date,
  };
  const client = Object.fromEntries(
    CHAMPS_CLIENT.map(({ k }) => [
      k,
      {
        // Proposé coché seulement si le dossier n'a rien et que le devis donne
        // une valeur : on n'écrase jamais sans le vouloir.
        appliquer: !!lu[k] && !actuel[k],
        valeur: lu[k] || actuel[k],
      },
    ])
  ) as Valeurs["client"];
  return {
    numero: d.numero,
    client,
    ouvrages: d.ouvrages.map((o) => ({
      garder: o.probable,
      texte: o.texte,
      metier: o.metier,
      realisation: o.realisation,
      quantite: o.quantite,
      heuresPrevues: o.heures,
      creerFiche: o.probable,
      ficheType: o.ficheType,
      // Tous les champs de la fiche présents (vides) : champs contrôlés.
      contenu: {
        ...Object.fromEntries(
          Object.values(SCHEMAS).flat().map((f) => [f.key, ""])
        ),
        ...o.contenu,
      },
      tissus: o.tissus,
      etapes: o.etapes.join("\n"),
      piece: o.piece,
      tissuClient: o.tissuClient,
      composants: o.composants,
      probable: o.probable,
    })),
  };
}

// Champs de la fiche atelier selon son type (même schéma que l'éditeur).
function ChampsFiche({ i, type }: { i: number; type: string }) {
  const schema = SCHEMAS[type] ?? SCHEMAS["Autre"];
  return (
    <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
      {schema.map((f) => {
        const name = `ouvrages.${i}.contenu.${f.key}`;
        return (
          <label
            key={f.key}
            className={`flex flex-col gap-0.5 text-[11px] ${
              f.type === "textarea" ? "col-span-2 sm:col-span-4" : ""
            }`}
          >
            <span className="text-muted-foreground">
              {f.label}
              {f.unit ? ` (${f.unit})` : ""}
            </span>
            {f.type === "select" ? (
              <Field as="select" name={name} className={cell}>
                <option value="">—</option>
                {(f.options ?? []).map((o) => (
                  <option key={o}>{o}</option>
                ))}
              </Field>
            ) : f.type === "textarea" ? (
              <Field as="textarea" name={name} rows={2} className={cell} />
            ) : (
              <Field
                name={name}
                inputMode={f.type === "number" ? "decimal" : undefined}
                className={cell}
              />
            )}
          </label>
        );
      })}
    </div>
  );
}

export function DevisRemplir({
  devisId,
  dossierId,
  actuel,
}: {
  devisId: number;
  dossierId: number;
  actuel: ClientActuel;
}) {
  const [ouvert, setOuvert] = useState(false);
  const [devis, setDevis] = useState<DevisLu | null>(null);
  const [erreur, setErreur] = useState("");
  const [succes, setSucces] = useState("");
  const [lecture, startLecture] = useTransition();

  function ouvrir() {
    setOuvert(true);
    setErreur("");
    setSucces("");
    setDevis(null);
    startLecture(async () => {
      const res = await lireDevisSigne(devisId);
      if (res.ok) setDevis(res.devis);
      else setErreur(res.error);
    });
  }

  // Devis signé scanné : on lit à la place le PDF EBP d'origine choisi.
  function lireOrigine(f: File) {
    setErreur("");
    setDevis(null);
    const fd = new FormData();
    fd.set("fichier", f);
    startLecture(async () => {
      const res = await lireDevisFichier(fd);
      if (res.ok) setDevis(res.devis);
      else setErreur(res.error);
    });
  }

  return (
    <>
      <button
        type="button"
        onClick={ouvrir}
        className="inline-flex items-center gap-1 text-xs text-primary hover:underline"
        title="Lire ce devis et pré-remplir client, travaux et fiches atelier"
      >
        <Wand2 className="h-3.5 w-3.5" />
        Remplir depuis ce devis
      </button>

      {ouvert && (
        <div
          role="dialog"
          aria-modal="true"
          className="fixed inset-0 z-50 flex justify-center overflow-y-auto bg-black/40 p-2 sm:p-6"
        >
          <div className="h-fit w-full max-w-5xl rounded-xl border bg-background shadow-2xl">
            <div className="flex items-center justify-between border-b px-4 py-3">
              <h2 className="text-sm font-semibold">
                Remplir le dossier depuis le devis
                {devis?.numero ? ` ${devis.numero}` : ""}
              </h2>
              <button
                type="button"
                onClick={() => setOuvert(false)}
                className="rounded-md p-1 text-muted-foreground hover:bg-accent"
                title="Fermer"
              >
                <X size={16} />
              </button>
            </div>

            {lecture && (
              <p className="px-4 py-6 text-sm text-muted-foreground">Lecture du devis…</p>
            )}
            {erreur && !devis && (
              <p role="alert" className="px-4 pt-6 text-sm text-destructive">
                {erreur}
              </p>
            )}
            {/* Toujours possible : lire le PDF EBP d'origine (non scanné). */}
            {!devis && !succes && !lecture && (
              <div className="flex flex-wrap items-center gap-3 px-4 py-6 text-sm">
                <label className="inline-flex cursor-pointer items-center gap-1.5 rounded-md bg-primary px-3 py-1.5 font-medium text-primary-foreground hover:bg-primary/90">
                  <Upload size={15} />
                  Choisir le PDF EBP d&apos;origine
                  <input
                    type="file"
                    accept="application/pdf,.pdf"
                    className="hidden"
                    onChange={(e) => {
                      const f = e.target.files?.[0];
                      if (f) lireOrigine(f);
                      e.target.value = "";
                    }}
                  />
                </label>
                <span className="text-xs text-muted-foreground">
                  Le devis exporté depuis EBP avant signature (PDF « texte »). Il est seulement
                  lu, pas enregistré.
                </span>
              </div>
            )}
            {succes && (
              <div className="space-y-3 px-4 py-6 text-sm">
                <p className="font-medium text-emerald-700">{succes}</p>
                <Button size="sm" onClick={() => setOuvert(false)}>
                  Fermer
                </Button>
              </div>
            )}

            {devis && !succes && (
              <Formik
                initialValues={versValeurs(devis, actuel)}
                onSubmit={async (v) => {
                  setErreur("");
                  const client: Record<string, string> = {};
                  for (const { k } of CHAMPS_CLIENT) {
                    if (v.client[k].appliquer) client[k] = v.client[k].valeur;
                  }
                  const res = await appliquerDevis(dossierId, {
                    numero: v.numero,
                    client,
                    ouvrages: v.ouvrages
                      .filter((o) => o.garder)
                      .map((o) => ({
                        metier: o.metier,
                        realisation: o.realisation,
                        quantite: o.quantite,
                        heuresPrevues: o.heuresPrevues,
                        creerFiche: o.creerFiche,
                        ficheType: o.ficheType,
                        contenu: o.contenu,
                        tissus: o.tissus,
                        etapes: o.etapes
                          .split("\n")
                          .map((e) => e.trim())
                          .filter(Boolean),
                        texte: o.texte,
                      })),
                  });
                  if (res.ok) {
                    setSucces(
                      `✓ Dossier mis à jour : ${res.fiches} fiche${
                        res.fiches > 1 ? "s" : ""
                      } de travail créée${res.fiches > 1 ? "s" : ""}. Affecte-les (opérateur, heures) dans « Fiches atelier ».`
                    );
                  } else setErreur("Enregistrement impossible.");
                }}
              >
                {({ values, isSubmitting, setFieldValue }) => {
                  const nb = values.ouvrages.filter((o) => o.garder).length;
                  return (
                    <Form className="space-y-4 px-4 py-4">
                      {/* Infos client */}
                      <fieldset className="rounded-lg border p-3">
                        <legend className="px-1 text-xs font-semibold">
                          Infos client — coche ce qui doit remplacer le dossier
                        </legend>
                        <div className="grid gap-2 sm:grid-cols-2">
                          {CHAMPS_CLIENT.map(({ k, label, type }) => (
                            <div key={k} className="flex items-start gap-2 text-xs">
                              <Field
                                type="checkbox"
                                name={`client.${k}.appliquer`}
                                className="mt-5 h-4 w-4"
                              />
                              <label className="flex flex-1 flex-col gap-0.5">
                                <span className="text-muted-foreground">{label}</span>
                                <Field
                                  name={`client.${k}.valeur`}
                                  type={type ?? "text"}
                                  list={
                                    k === "telephone"
                                      ? `tel-${devisId}`
                                      : k === "email"
                                        ? `mail-${devisId}`
                                        : undefined
                                  }
                                  onInput={() =>
                                    setFieldValue(`client.${k}.appliquer`, true)
                                  }
                                  className={cell}
                                />
                                <span className="text-[10px] text-muted-foreground">
                                  Dans le dossier : {actuel[k] || "—"}
                                </span>
                              </label>
                            </div>
                          ))}
                          <datalist id={`tel-${devisId}`}>
                            {devis.telephones.map((t) => (
                              <option key={t} value={t} />
                            ))}
                          </datalist>
                          <datalist id={`mail-${devisId}`}>
                            {devis.emails.map((t) => (
                              <option key={t} value={t} />
                            ))}
                          </datalist>
                        </div>
                      </fieldset>

                      {/* Ouvrages → travaux + fiches */}
                      <FieldArray name="ouvrages">
                        {() => (
                          <div className="space-y-2">
                            <p className="text-xs font-semibold">
                              Lignes du devis ({values.ouvrages.length}) — chaque ligne
                              cochée devient une fiche de travail
                            </p>
                            {values.ouvrages.length === 0 && (
                              <p className="text-xs text-muted-foreground">
                                Aucune ligne de devis reconnue.
                              </p>
                            )}
                            {values.ouvrages.map((o, i) => (
                              <div
                                key={i}
                                className={`rounded-lg border p-3 ${
                                  o.garder ? "" : "bg-muted/30 opacity-60"
                                }`}
                              >
                                <div className="flex flex-wrap items-end gap-2">
                                  <label className="flex items-center gap-1.5 pb-1 text-xs font-medium">
                                    <Field
                                      type="checkbox"
                                      name={`ouvrages.${i}.garder`}
                                      className="h-4 w-4"
                                    />
                                    Garder
                                  </label>
                                  <label className="flex w-28 flex-col gap-0.5 text-[11px]">
                                    <span className="text-muted-foreground">Métier</span>
                                    <Field as="select" name={`ouvrages.${i}.metier`} className={cell}>
                                      {METIERS.map((m) => (
                                        <option key={m}>{m}</option>
                                      ))}
                                    </Field>
                                  </label>
                                  <label className="flex min-w-36 flex-1 flex-col gap-0.5 text-[11px]">
                                    <span className="text-muted-foreground">Réalisation</span>
                                    <Field
                                      name={`ouvrages.${i}.realisation`}
                                      list={`real-${devisId}-${i}`}
                                      className={cell}
                                    />
                                    <datalist id={`real-${devisId}-${i}`}>
                                      {typesRealisationPour(o.metier).map((r) => (
                                        <option key={r} value={r} />
                                      ))}
                                    </datalist>
                                  </label>
                                  <label className="flex w-14 flex-col gap-0.5 text-[11px]">
                                    <span className="text-muted-foreground">Qté</span>
                                    <Field name={`ouvrages.${i}.quantite`} className={cell} />
                                  </label>
                                  <label className="flex w-24 flex-col gap-0.5 text-[11px]">
                                    <span className="text-muted-foreground">Heures prévues</span>
                                    <Field
                                      name={`ouvrages.${i}.heuresPrevues`}
                                      inputMode="decimal"
                                      placeholder="—"
                                      className={cell}
                                    />
                                  </label>
                                  {(
                                    <label className="flex w-36 flex-col gap-0.5 text-[11px]">
                                      <span className="text-muted-foreground">Type de fiche</span>
                                      <Field
                                        as="select"
                                        name={`ouvrages.${i}.ficheType`}
                                        className={cell}
                                      >
                                        {TYPES_FICHE.map((t) => (
                                          <option key={t}>{t}</option>
                                        ))}
                                      </Field>
                                    </label>
                                  )}
                                </div>
                                <div className="mt-1.5 flex flex-wrap items-center gap-1.5 text-[11px]">
                                  {o.piece && (
                                    <span className="rounded bg-sky-100 px-1.5 py-0.5 font-medium text-sky-800">
                                      {o.piece}
                                    </span>
                                  )}
                                  {o.tissuClient && (
                                    <span className="rounded bg-orange-100 px-1.5 py-0.5 font-medium text-orange-800">
                                      Tissu fourni par le client
                                    </span>
                                  )}
                                  <span className="text-muted-foreground">Devis : {o.texte}</span>
                                </div>
                                {o.composants.length > 0 && (
                                  <ul className="mt-1 list-inside list-disc text-[11px] text-muted-foreground">
                                    {o.composants.map((c, j) => (
                                      <li key={j}>{c}</li>
                                    ))}
                                  </ul>
                                )}
                                {o.garder && (
                                  <div className="mt-2 space-y-2 rounded-md bg-muted/30 p-2">
                                    <ChampsFiche i={i} type={o.ficheType} />
                                    <label className="flex flex-col gap-0.5 text-[11px]">
                                      <span className="text-muted-foreground">
                                        Étapes de travail (une par ligne)
                                      </span>
                                      <Field
                                        as="textarea"
                                        name={`ouvrages.${i}.etapes`}
                                        rows={Math.min(8, Math.max(3, o.etapes.split("\n").length))}
                                        placeholder="Laisse vide pour les étapes par défaut"
                                        className={cell}
                                      />
                                    </label>
                                    {o.tissus.map((_, j) => (
                                      <div key={j} className="grid grid-cols-4 gap-2">
                                        <label className="flex flex-col gap-0.5 text-[11px]">
                                          <span className="text-muted-foreground">Tissu / fourniture</span>
                                          <Field name={`ouvrages.${i}.tissus.${j}.ref`} className={cell} />
                                        </label>
                                        <label className="flex flex-col gap-0.5 text-[11px]">
                                          <span className="text-muted-foreground">Coloris</span>
                                          <Field name={`ouvrages.${i}.tissus.${j}.coloris`} className={cell} />
                                        </label>
                                        <label className="flex flex-col gap-0.5 text-[11px]">
                                          <span className="text-muted-foreground">Métrage</span>
                                          <Field name={`ouvrages.${i}.tissus.${j}.metrage`} className={cell} />
                                        </label>
                                        <label className="flex flex-col gap-0.5 text-[11px]">
                                          <span className="text-muted-foreground">Placement</span>
                                          <Field name={`ouvrages.${i}.tissus.${j}.placement`} className={cell} />
                                        </label>
                                      </div>
                                    ))}
                                  </div>
                                )}
                              </div>
                            ))}
                          </div>
                        )}
                      </FieldArray>

                      <div className="flex flex-wrap items-center gap-2 border-t pt-3">
                        <Button type="submit" size="sm" disabled={isSubmitting}>
                          {isSubmitting ? "Enregistrement…" : "Appliquer au dossier"}
                        </Button>
                        <Button
                          type="button"
                          variant="ghost"
                          size="sm"
                          onClick={() => setOuvert(false)}
                        >
                          Annuler
                        </Button>
                        <span className="text-xs text-muted-foreground">
                          {nb} ligne{nb > 1 ? "s" : ""} retenue{nb > 1 ? "s" : ""}
                        </span>
                        {erreur && (
                          <span role="alert" className="text-xs text-destructive">
                            {erreur}
                          </span>
                        )}
                      </div>
                    </Form>
                  );
                }}
              </Formik>
            )}
          </div>
        </div>
      )}
    </>
  );
}
