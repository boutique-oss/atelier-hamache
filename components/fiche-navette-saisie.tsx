"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { AlertTriangle, CheckCircle2, Loader2 } from "lucide-react";

import { integrerFicheNavette, marquerFiche, type JourSaisi } from "@/app/pointages/actions";
import { SEUIL_JOUR, TYPES_JOUR, TYPES_NEUTRES } from "@/lib/fiches-navettes-const";
import type { JourFiche } from "@/lib/fiches-navettes";
import { cn, parseNum } from "@/lib/utils";

const jjmm = (iso: string) => `${iso.slice(8)}/${iso.slice(5, 7)}`;
const champ = "h-9 w-full rounded-md border border-input bg-background px-2 text-sm [@media(pointer:coarse)]:h-11";

type Ligne = { date: string; type: string; heures: string };

// Grille de saisie d'une fiche navette (lundi → samedi), pré-remplie avec ce
// qui est déjà au pointage, et les fériés. « Valider et intégrer » écrit dans
// le pointage ; les avertissements demandent une confirmation.
export function FicheNavetteSaisie({
  ficheId,
  statut,
  hJour,
  jours,
}: {
  ficheId: number;
  statut: string;
  hJour: number;
  jours: JourFiche[];
}) {
  const router = useRouter();
  const [enCours, demarrer] = useTransition();
  const [lignes, setLignes] = useState<Ligne[]>(() =>
    jours.map((j) => ({
      date: j.date,
      type: j.existant?.type ?? (j.ferie ? "Férié" : ""),
      heures: j.existant && j.existant.type === "Travail" ? String(j.existant.heures).replace(".", ",") : "",
    }))
  );
  const [avertissements, setAvertissements] = useState<string[] | null>(null);
  const [erreur, setErreur] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);

  const maj = (i: number, p: Partial<Ligne>) => {
    setLignes((ls) => ls.map((l, k) => (k === i ? { ...l, ...p } : l)));
    setAvertissements(null);
    setMessage(null);
  };

  const valeur = (l: Ligne, j: JourFiche) =>
    l.type === "Travail"
      ? parseNum(l.heures) ?? 0
      : TYPES_NEUTRES.includes(l.type)
        ? hJour
        : l.type === j.existant?.type
          ? j.existant.heures
          : 0;
  const total = lignes.reduce((s, l, i) => s + (l.type ? valeur(l, jours[i]) : 0), 0);

  function envoyer(forcer: boolean) {
    setErreur(null);
    setMessage(null);
    const saisis: JourSaisi[] = lignes.map((l) => ({
      date: l.date,
      type: l.type,
      heures: l.type === "Travail" ? parseNum(l.heures) ?? 0 : null,
    }));
    demarrer(async () => {
      const res = await integrerFicheNavette(ficheId, saisis, forcer);
      if (res.ok) {
        setAvertissements(null);
        setMessage(
          res.ecrits === 0
            ? "Fiche intégrée : le pointage était déjà à jour."
            : `Fiche intégrée : ${res.ecrits} jour${res.ecrits > 1 ? "s" : ""} écrit${res.ecrits > 1 ? "s" : ""} au pointage.`
        );
        router.refresh();
      } else if ("avertissements" in res) {
        setAvertissements(res.avertissements);
      } else {
        setErreur(res.error);
      }
    });
  }

  return (
    <div className="space-y-4">
      <div className="overflow-hidden rounded-lg border bg-card">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b bg-muted/40 text-left text-xs text-muted-foreground">
              <th className="px-3 py-2 font-medium">Jour</th>
              <th className="px-2 py-2 font-medium">Type</th>
              <th className="w-28 px-2 py-2 font-medium">Heures</th>
            </tr>
          </thead>
          <tbody className="divide-y">
            {jours.map((j, i) => {
              const l = lignes[i];
              const h = parseNum(l.heures) ?? 0;
              const autreType = j.existant && !(TYPES_JOUR as readonly string[]).includes(j.existant.type);
              return (
                <tr key={j.date}>
                  <td className="px-3 py-2">
                    <span className="font-medium">{j.libelle}</span>{" "}
                    <span className="text-muted-foreground">{jjmm(j.date)}</span>
                    {j.ferie && <span className="block text-xs text-muted-foreground">Férié · {j.ferie}</span>}
                    {j.existant && (
                      <span className="block text-xs text-muted-foreground">
                        Déjà pointé : {j.existant.type} {String(j.existant.heures).replace(".", ",")} h
                      </span>
                    )}
                  </td>
                  <td className="px-2 py-2">
                    <select
                      aria-label={`Type du ${j.libelle.toLowerCase()}`}
                      value={l.type}
                      onChange={(e) => maj(i, { type: e.target.value })}
                      className={champ}
                    >
                      <option value="">— vide —</option>
                      {TYPES_JOUR.map((t) => (
                        <option key={t} value={t}>
                          {t}
                        </option>
                      ))}
                      {autreType && <option value={j.existant!.type}>{j.existant!.type}</option>}
                    </select>
                  </td>
                  <td className="px-2 py-2">
                    {l.type === "Travail" ? (
                      <input
                        inputMode="decimal"
                        aria-label={`Heures du ${j.libelle.toLowerCase()}`}
                        value={l.heures}
                        onChange={(e) => maj(i, { heures: e.target.value })}
                        placeholder="0"
                        className={cn(champ, "tabular-nums", h > SEUIL_JOUR && "border-destructive")}
                      />
                    ) : (
                      <span className="block px-2 tabular-nums text-muted-foreground">
                        {l.type ? `${String(valeur(l, j)).replace(".", ",")} h` : ""}
                      </span>
                    )}
                  </td>
                </tr>
              );
            })}
          </tbody>
          <tfoot>
            <tr className="border-t bg-muted/40">
              <td colSpan={2} className="px-3 py-2 text-right text-xs font-medium text-muted-foreground">
                Total de la semaine
              </td>
              <td className="px-4 py-2 font-semibold tabular-nums">
                {(Math.round(total * 100) / 100).toString().replace(".", ",")} h
              </td>
            </tr>
          </tfoot>
        </table>
      </div>

      {avertissements && (
        <div role="alert" className="space-y-2 rounded-md border border-[hsl(var(--brand-orange)/0.5)] bg-[hsl(var(--brand-orange)/0.08)] p-3 text-sm">
          <p className="flex items-center gap-2 font-medium">
            <AlertTriangle size={16} aria-hidden /> À vérifier avant d&apos;intégrer
          </p>
          <ul className="list-disc space-y-1 pl-6">
            {avertissements.map((a) => (
              <li key={a}>{a}</li>
            ))}
          </ul>
          <div className="flex flex-wrap gap-2 pt-1">
            <button
              type="button"
              disabled={enCours}
              onClick={() => envoyer(true)}
              className="h-9 rounded-md bg-primary px-3 text-sm font-medium text-primary-foreground shadow hover:bg-primary/90 disabled:opacity-60"
            >
              Intégrer quand même
            </button>
            <button
              type="button"
              onClick={() => setAvertissements(null)}
              className="h-9 rounded-md border border-input bg-background px-3 text-sm hover:bg-accent"
            >
              Corriger
            </button>
          </div>
        </div>
      )}
      {erreur && (
        <p role="alert" className="rounded-md border border-destructive/40 bg-destructive/5 px-3 py-2 text-sm text-destructive">
          {erreur}
        </p>
      )}
      {message && (
        <p role="status" className="flex items-center gap-2 rounded-md border bg-card px-3 py-2 text-sm">
          <CheckCircle2 size={16} aria-hidden className="text-[hsl(var(--brand-green))]" /> {message}
        </p>
      )}

      {!avertissements && (
        <div className="flex flex-wrap items-center gap-2">
          <button
            type="button"
            disabled={enCours}
            onClick={() => envoyer(false)}
            className="inline-flex h-10 items-center gap-2 rounded-md bg-primary px-4 text-sm font-medium text-primary-foreground shadow hover:bg-primary/90 disabled:opacity-60 [@media(pointer:coarse)]:h-11"
          >
            {enCours && <Loader2 size={15} aria-hidden className="animate-spin" />}
            {statut === "integree" ? "Réintégrer" : "Valider et intégrer"}
          </button>
          {statut !== "integree" && (
            <button
              type="button"
              disabled={enCours}
              onClick={() =>
                demarrer(async () => {
                  await marquerFiche(ficheId, statut === "verifiee" ? "a_saisir" : "verifiee");
                  router.refresh();
                })
              }
              className="h-10 rounded-md border border-input bg-background px-3 text-sm hover:bg-accent [@media(pointer:coarse)]:h-11"
            >
              {statut === "verifiee" ? "Remettre « à saisir »" : "Marquer vérifiée"}
            </button>
          )}
        </div>
      )}
    </div>
  );
}
