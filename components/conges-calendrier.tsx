"use client";

import { useMemo, useState, useTransition } from "react";
import { CalendarDays, Lock, Trash2 } from "lucide-react";

import { createConge, deleteConge, setCongeStatut } from "@/app/(main)/conges/actions";
import { estFermeture } from "@/lib/conges-const";
import type { Conge } from "@/lib/pointage";

// Palette stable : une teinte par opérateur (indexée sur l'ordre de la liste).
const PALETTE = [
  { dot: "bg-violet-500", soft: "bg-violet-100 text-violet-800 border-violet-300", text: "text-violet-700" },
  { dot: "bg-sky-500", soft: "bg-sky-100 text-sky-800 border-sky-300", text: "text-sky-700" },
  { dot: "bg-emerald-500", soft: "bg-emerald-100 text-emerald-800 border-emerald-300", text: "text-emerald-700" },
  { dot: "bg-amber-500", soft: "bg-amber-100 text-amber-800 border-amber-300", text: "text-amber-700" },
  { dot: "bg-rose-500", soft: "bg-rose-100 text-rose-800 border-rose-300", text: "text-rose-700" },
  { dot: "bg-teal-500", soft: "bg-teal-100 text-teal-800 border-teal-300", text: "text-teal-700" },
  { dot: "bg-fuchsia-500", soft: "bg-fuchsia-100 text-fuchsia-800 border-fuchsia-300", text: "text-fuchsia-700" },
];

const MOIS_FR = [
  "janvier", "février", "mars", "avril", "mai", "juin",
  "juillet", "août", "septembre", "octobre", "novembre", "décembre",
];
const JOURS_FR = ["Lun", "Mar", "Mer", "Jeu", "Ven", "Sam", "Dim"];
const TYPES = ["Congé payé", "Récupération", "Sans solde", "Autre"];

const isoKey = (d: Date) => d.toISOString().slice(0, 10);
const initiales = (nom: string) =>
  nom.split(/[\s-]+/).filter(Boolean).slice(0, 2).map((m) => m[0]?.toUpperCase()).join("") || "?";
const jourMois = (iso: string) => `${iso.slice(8)}/${iso.slice(5, 7)}`;

// Nombre de jours ouvrés (lun→ven) entre deux dates incluses.
function joursOuvres(debut: string, fin: string): number {
  let n = 0;
  const [y, m, j] = debut.split("-").map(Number);
  const cur = new Date(Date.UTC(y, m - 1, j));
  const finD = new Date(fin + "T00:00:00Z");
  while (cur <= finD) {
    const dow = cur.getUTCDay();
    if (dow >= 1 && dow <= 5) n++;
    cur.setUTCDate(cur.getUTCDate() + 1);
  }
  return n;
}

export function CongesCalendrier({
  conges,
  operateurs,
}: {
  conges: Conge[];
  operateurs: string[];
}) {
  const now = new Date();
  const [annee, setAnnee] = useState(now.getUTCFullYear());
  const [mois, setMois] = useState(now.getUTCMonth()); // 0-11
  const [general, setGeneral] = useState(false); // fermeture atelier (tout le monde)
  const [pending, start] = useTransition();

  // Couleur par opérateur (les congés d'un nom inconnu retombent sur la 1re teinte).
  const couleur = useMemo(() => {
    const map = new Map<string, (typeof PALETTE)[number]>();
    operateurs.forEach((nom, i) => map.set(nom, PALETTE[i % PALETTE.length]));
    return (nom: string) => map.get(nom) ?? PALETTE[0];
  }, [operateurs]);

  // Grille du mois : semaines de 7 jours (lundi en tête), débordant sur les mois
  // voisins pour compléter les semaines.
  const semaines = useMemo(() => {
    const first = new Date(Date.UTC(annee, mois, 1));
    const startDow = (first.getUTCDay() + 6) % 7; // lundi = 0
    const nbJours = new Date(Date.UTC(annee, mois + 1, 0)).getUTCDate();
    const nbSem = Math.ceil((startDow + nbJours) / 7);
    const debut = new Date(first);
    debut.setUTCDate(1 - startDow);
    const out: Date[][] = [];
    const cur = new Date(debut);
    for (let w = 0; w < nbSem; w++) {
      const jours: Date[] = [];
      for (let d = 0; d < 7; d++) {
        jours.push(new Date(cur));
        cur.setUTCDate(cur.getUTCDate() + 1);
      }
      out.push(jours);
    }
    return out;
  }, [annee, mois]);

  const changerMois = (delta: number) => {
    const d = new Date(Date.UTC(annee, mois + delta, 1));
    setAnnee(d.getUTCFullYear());
    setMois(d.getUTCMonth());
  };

  const todayKey = isoKey(new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate())));

  // Congés visibles sur le calendrier : Validé (plein) + Demandé (contour).
  const visibles = conges.filter((c) => c.statut !== "Refusé");
  const congesDuJour = (key: string) =>
    visibles.filter((c) => c.dateDebut <= key && c.dateFin >= key);

  // Liste des demandes à venir ou en cours (fin >= aujourd'hui), + demandes en
  // attente quelle que soit la date.
  const liste = [...conges]
    .filter((c) => c.dateFin >= todayKey || c.statut === "Demandé")
    .sort((a, b) => (a.dateDebut < b.dateDebut ? -1 : 1));
  const enAttente = conges.filter((c) => c.statut === "Demandé").length;

  return (
    <section className="rounded-xl border">
      <h2 className="flex flex-wrap items-center justify-between gap-2 border-b bg-muted/40 px-4 py-2.5 text-sm font-semibold">
        <span className="flex items-center gap-2">
          <CalendarDays className="h-4 w-4 text-primary" />
          Planning des congés
        </span>
        <a href="/planning" className="font-normal text-primary hover:underline">
          Voir dans le Planning atelier →
        </a>
      </h2>

      {/* Nouvelle demande / fermeture atelier */}
      <form
        action={(fd) => start(async () => { await createConge(fd); setGeneral(false); })}
        className="border-b bg-muted/20 px-4 py-3"
      >
        <label className="mb-2 flex w-fit cursor-pointer items-center gap-2 text-sm">
          <input
            type="checkbox"
            name="general"
            checked={general}
            onChange={(e) => setGeneral(e.target.checked)}
            className="h-4 w-4"
          />
          <Lock className="h-3.5 w-3.5 text-rose-600" />
          <span className="font-medium">Fermeture de l&apos;atelier</span>
          <span className="text-muted-foreground">— s&apos;applique à tout le monde</span>
        </label>

        <div className="flex flex-wrap items-end gap-2">
          <label className="flex flex-col gap-1 text-xs">
            <span className="text-muted-foreground">Salarié</span>
            <select
              name="operateur"
              required={!general}
              disabled={general}
              className={`${inputCls} disabled:opacity-40`}
              defaultValue=""
            >
              <option value="" disabled>
                {general ? "Tout le monde" : "Choisir…"}
              </option>
              {operateurs.map((nom) => (
                <option key={nom} value={nom}>
                  {nom}
                </option>
              ))}
            </select>
          </label>
          <label className="flex flex-col gap-1 text-xs">
            <span className="text-muted-foreground">Du</span>
            <input name="dateDebut" type="date" required className={inputCls} />
          </label>
          <label className="flex flex-col gap-1 text-xs">
            <span className="text-muted-foreground">Au</span>
            <input name="dateFin" type="date" className={inputCls} />
          </label>
          <label className="flex flex-col gap-1 text-xs">
            <span className="text-muted-foreground">Type</span>
            <select
              name="type"
              disabled={general}
              className={`${inputCls} disabled:opacity-40`}
              defaultValue="Congé payé"
            >
              {TYPES.map((t) => (
                <option key={t} value={t}>
                  {t}
                </option>
              ))}
            </select>
          </label>
          <label
            className={`flex flex-col gap-1 text-xs ${general ? "opacity-40" : ""}`}
            title="Durée d'absence à retirer du stock d'heures, une fois la demande validée"
          >
            <span className="text-muted-foreground">Retirer du stock (h)</span>
            <input
              name="heuresStock"
              inputMode="decimal"
              disabled={general}
              placeholder="ex. 7 = 1 jour"
              className={`${inputCls} w-28`}
            />
          </label>
          <label className="flex flex-1 flex-col gap-1 text-xs">
            <span className="text-muted-foreground">Commentaire</span>
            <input name="commentaire" type="text" placeholder="facultatif" className={inputCls} />
          </label>
          <button
            type="submit"
            disabled={pending}
            className="rounded-md bg-primary px-3 py-1.5 text-sm font-medium text-primary-foreground hover:bg-primary/90 disabled:opacity-50"
          >
            {general ? "Enregistrer la fermeture" : "Enregistrer la demande"}
          </button>
        </div>
      </form>

      {/* Navigation du mois */}
      <div className="flex items-center justify-between px-4 py-2.5">
        <button
          type="button"
          onClick={() => changerMois(-1)}
          className="rounded-md border px-2.5 py-1 text-sm hover:bg-accent"
        >
          ← {MOIS_FR[(mois + 11) % 12]}
        </button>
        <span className="text-sm font-semibold capitalize tabular-nums">
          {MOIS_FR[mois]} {annee}
        </span>
        <button
          type="button"
          onClick={() => changerMois(1)}
          className="rounded-md border px-2.5 py-1 text-sm hover:bg-accent"
        >
          {MOIS_FR[(mois + 1) % 12]} →
        </button>
      </div>

      {/* Grille calendrier */}
      <div className="overflow-x-auto px-4 pb-4">
        <div className="grid min-w-[520px] grid-cols-7 gap-px overflow-hidden rounded-lg border bg-border text-center">
          {JOURS_FR.map((j) => (
            <div
              key={j}
              className="bg-muted/60 py-1.5 text-[11px] font-medium uppercase tracking-wider text-muted-foreground"
            >
              {j}
            </div>
          ))}
          {semaines.flat().map((d) => {
            const key = isoKey(d);
            const dansMois = d.getUTCMonth() === mois;
            const weekend = d.getUTCDay() === 0 || d.getUTCDay() === 6;
            const items = congesDuJour(key);
            const ferme = items.some(estFermeture);
            const individus = items.filter((c) => !estFermeture(c));
            return (
              <div
                key={key}
                className={`min-h-[64px] p-1 text-left align-top ${
                  ferme
                    ? "bg-rose-50"
                    : dansMois
                      ? "bg-background"
                      : "bg-muted/30"
                } ${weekend && !ferme ? "bg-muted/40" : ""}`}
              >
                <div
                  className={`mb-0.5 text-right text-[11px] tabular-nums ${
                    key === todayKey
                      ? "font-bold text-primary"
                      : dansMois
                        ? "text-muted-foreground"
                        : "text-muted-foreground/40"
                  }`}
                >
                  {d.getUTCDate()}
                </div>
                <div className="flex flex-wrap gap-0.5">
                  {ferme && (
                    <span
                      title="Atelier fermé — tout le monde"
                      className="inline-flex h-5 items-center gap-0.5 rounded bg-rose-600 px-1 text-[9px] font-bold uppercase text-white"
                    >
                      <Lock className="h-2.5 w-2.5" />
                      Fermé
                    </span>
                  )}
                  {individus.map((c) => {
                    const col = couleur(c.operateur);
                    const valide = c.statut === "Validé";
                    return (
                      <span
                        key={c.id}
                        title={`${c.operateur} · ${c.type} · ${jourMois(c.dateDebut)} → ${jourMois(c.dateFin)}${
                          valide ? "" : " (à valider)"
                        }`}
                        className={`inline-flex h-5 min-w-5 items-center justify-center rounded px-1 text-[10px] font-bold ${
                          valide
                            ? `${col.dot} text-white`
                            : `border border-dashed ${col.soft}`
                        }`}
                      >
                        {initiales(c.operateur)}
                      </span>
                    );
                  })}
                </div>
              </div>
            );
          })}
        </div>

        {/* Légende opérateurs */}
        {operateurs.length > 0 && (
          <div className="mt-2 flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-muted-foreground">
            {operateurs.map((nom) => (
              <span key={nom} className="flex items-center gap-1.5">
                <span className={`h-3 w-3 rounded ${couleur(nom).dot}`} />
                {nom}
              </span>
            ))}
            <span className="flex items-center gap-1.5">
              <span className="h-3 w-3 rounded border border-dashed border-muted-foreground/60" />
              contour = à valider
            </span>
            <span className="flex items-center gap-1.5">
              <span className="h-3 w-3 rounded bg-rose-600" />
              atelier fermé (tous)
            </span>
          </div>
        )}
      </div>

      {/* Liste des demandes */}
      <div className="border-t">
        <div className="flex items-center justify-between px-4 py-2 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
          <span>Demandes</span>
          {enAttente > 0 && (
            <span className="rounded-md bg-amber-100 px-2 py-0.5 font-medium normal-case text-amber-800">
              {enAttente} à valider
            </span>
          )}
        </div>
        {liste.length === 0 ? (
          <p className="px-4 pb-4 text-sm text-muted-foreground">
            Aucune demande en cours. Utilise le formulaire ci-dessus pour en saisir une.
          </p>
        ) : (
          <ul className="divide-y">
            {liste.map((c) => {
              const ferme = estFermeture(c);
              const col = couleur(c.operateur);
              return (
                <li key={c.id} className="flex flex-wrap items-center gap-x-3 gap-y-1 px-4 py-2.5 text-sm">
                  {ferme ? (
                    <>
                      <Lock className="h-3.5 w-3.5 shrink-0 text-rose-600" />
                      <span className="font-medium text-rose-700">Atelier fermé (tous)</span>
                    </>
                  ) : (
                    <>
                      <span className={`h-3 w-3 shrink-0 rounded ${col.dot}`} />
                      <span className="font-medium">{c.operateur}</span>
                    </>
                  )}
                  <span className="tabular-nums text-muted-foreground">
                    {jourMois(c.dateDebut)} → {jourMois(c.dateFin)}
                    <span className="ml-1 text-muted-foreground/70">
                      ({joursOuvres(c.dateDebut, c.dateFin)} j)
                    </span>
                  </span>
                  {!ferme && <span className="text-muted-foreground/80">{c.type}</span>}
                  {!ferme && c.heuresStock > 0 && (
                    <span
                      title={
                        c.statut === "Validé"
                          ? "Heures retirées du stock d'heures"
                          : "Seront retirées du stock à la validation"
                      }
                      className={`rounded-full px-2 py-0.5 text-[11px] font-semibold tabular-nums ${
                        c.statut === "Validé"
                          ? "bg-emerald-100 text-emerald-700"
                          : "bg-amber-100 text-amber-800"
                      }`}
                    >
                      −{c.heuresStock.toLocaleString("fr-FR")} h stock
                      {c.statut === "Validé" ? "" : " à la validation"}
                    </span>
                  )}
                  {c.commentaire && (
                    <span className="truncate text-muted-foreground">— {c.commentaire}</span>
                  )}
                  <StatutBadge statut={ferme ? "Fermeture" : c.statut} />
                  <div className="ml-auto flex items-center gap-1">
                    {!ferme && c.statut !== "Validé" && (
                      <button
                        type="button"
                        disabled={pending}
                        onClick={() => start(() => setCongeStatut(c.id, "Validé"))}
                        className="rounded-md border border-emerald-300 px-2 py-1 text-xs font-medium text-emerald-700 hover:bg-emerald-50 disabled:opacity-50"
                      >
                        Valider
                      </button>
                    )}
                    {!ferme && c.statut !== "Refusé" && (
                      <button
                        type="button"
                        disabled={pending}
                        onClick={() => start(() => setCongeStatut(c.id, "Refusé"))}
                        className="rounded-md border px-2 py-1 text-xs text-muted-foreground hover:bg-accent disabled:opacity-50"
                      >
                        Refuser
                      </button>
                    )}
                    <button
                      type="button"
                      disabled={pending}
                      onClick={() => start(() => deleteConge(c.id))}
                      aria-label="Supprimer la demande"
                      className="rounded-md border px-2 py-1 text-destructive hover:bg-accent disabled:opacity-50"
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                    </button>
                  </div>
                </li>
              );
            })}
          </ul>
        )}
      </div>
    </section>
  );
}

const inputCls =
  "rounded-md border border-input bg-background px-2.5 py-1.5 text-sm focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring";

function StatutBadge({ statut }: { statut: string }) {
  const cls =
    statut === "Validé"
      ? "bg-emerald-100 text-emerald-700"
      : statut === "Refusé"
        ? "bg-rose-100 text-rose-700"
        : statut === "Fermeture"
          ? "bg-rose-600 text-white"
          : "bg-amber-100 text-amber-800";
  return (
    <span className={`rounded-full px-2 py-0.5 text-[11px] font-semibold ${cls}`}>
      {statut}
    </span>
  );
}
