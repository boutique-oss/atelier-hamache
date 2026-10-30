"use client";

import { useState, useTransition } from "react";

import {
  effacerPointage,
  remplirSemaine,
  setAbsence,
  setPointage,
  viderSemaine,
} from "@/app/pointage/actions";
import type { JourMois, LigneMois } from "@/lib/pointage";

// Saisie MENSUELLE jour par jour : une ligne par jour (du 1er au dernier), une
// colonne par salarié — comme la feuille papier. Week-ends et fériés sont
// saisissables. À chaque fin de semaine, une ligne de sous-total montre le
// calcul des heures sup. (heures faites + fériés/congés − 1 h de pause).

// Teinte de chaque type de journée. « Travail » n'a pas de jeton : c'est une saisie.
const TYPES: Record<string, string> = {
  Congé: "bg-amber-100 text-amber-800",
  Férié: "bg-sky-100 text-sky-800",
  Récup: "bg-emerald-100 text-emerald-700",
  Repos: "bg-zinc-100 text-zinc-600",
};
const ABSENCE = "bg-violet-100 text-violet-800";
const MOTIFS = ["Rendez-vous", "Enfant malade", "Événement familial", "Sans solde", "Retard", "Autre"];
const NOMS = ["Dim", "Lun", "Mar", "Mer", "Jeu", "Ven", "Sam"];

const nf = (n: number) =>
  n.toLocaleString("fr-FR", { minimumFractionDigits: 0, maximumFractionDigits: 2 });
const nomJour = (date: string) => NOMS[new Date(date + "T00:00:00Z").getUTCDay()];
const jm = (iso: string) => `${iso.slice(8)}/${iso.slice(5, 7)}`;
const lundiDe = (iso: string) => {
  const d = new Date(iso + "T00:00:00Z");
  d.setUTCDate(d.getUTCDate() - ((d.getUTCDay() + 6) % 7));
  return d.toISOString().slice(0, 10);
};
const num = (v: string) => Number(v.trim().replace(",", "."));

type Menu = { x: number; y: number; nom: string; date?: string };
type Dialogue = {
  nom: string;
  date: string;
  hJour: number;
  motif: string;
  partielle: boolean;
  hAbs: string;
  hFaites: string;
  jusquau: string;
};

export function PointageMois({
  jours,
  lignes,
  extrasPrets,
}: {
  jours: JourMois[];
  lignes: LigneMois[];
  extrasPrets: boolean;
}) {
  const [menu, setMenu] = useState<Menu | null>(null);
  const [dlg, setDlg] = useState<Dialogue | null>(null);
  const [pending, start] = useTransition();
  const fermer = () => setMenu(null);

  // Entrée → passe au jour suivant dans la même colonne (saisie rapide).
  const suivant = (e: React.KeyboardEvent<HTMLInputElement>, col: number, row: number) => {
    if (e.key !== "Enter") return;
    e.preventDefault();
    const cible = document.querySelector<HTMLInputElement>(
      `input[data-col="${col}"][data-row="${row + 1}"]`
    );
    if (cible) cible.focus();
    else e.currentTarget.blur();
  };

  // Jours « au contrat » : lundi → vendredi hors fériés.
  const joursOuvres = jours.filter((j) => !j.weekend && !j.ferie).map((j) => j.date);
  const dernier = jours[jours.length - 1]?.date;
  const ligneMenu = menu ? lignes.find((l) => l.nom === menu.nom) : undefined;

  // Ligne de sous-total après chaque dimanche (et après le dernier jour du mois).
  const sousTotal = (j: JourMois) => {
    if (j.lettre !== "D" && j.date !== dernier) return null;
    const lundi = lundiDe(j.date);
    const premier = lignes[0]?.semaines.find((s) => s.lundi === lundi);
    if (!premier) {
      // Semaine commencée le mois précédent : déclarée sur la navette d'avant.
      return (
        <tr key={`s-${j.date}`} className="border-b bg-muted/40 text-xs text-muted-foreground">
          <th colSpan={lignes.length + 1} className="px-3 py-1.5 text-left font-normal">
            Semaine commencée le {jm(lundi)} : ses heures sup. sont déclarées le mois précédent.
          </th>
        </tr>
      );
    }
    const deborde = premier.dimanche > (dernier ?? "");
    return (
      <tr key={`s-${j.date}`} className="border-y-2 border-slate-300 bg-slate-100/80">
        <th className="px-3 py-2 text-left text-[11px] font-bold uppercase tracking-wider text-slate-700">
          Semaine n°{premier.num}
          <span className="block text-[10.5px] font-normal normal-case tracking-normal text-muted-foreground">
            {jm(premier.lundi)} → {jm(premier.dimanche)}
            {deborde ? " · jours du mois suivant inclus" : ""}
          </span>
          {premier.enCours && (
            <span className="mt-1 inline-block rounded-full bg-amber-100 px-2 py-0.5 text-[10px] font-semibold normal-case tracking-normal text-amber-800">
              en cours · provisoire
            </span>
          )}
        </th>
        {lignes.map((l) => {
          const s = l.semaines.find((x) => x.lundi === lundi)!;
          if (l.fixe)
            return (
              <td key={l.nom} className="px-2 py-2 text-center text-xs">
                <b>{nf(s.fait)} h</b>
                <span className="block text-muted-foreground">horaire fixe</span>
              </td>
            );
          return (
            <td key={l.nom} className="px-2 py-2 text-center text-xs">
              <b>{nf(s.retenu)} h</b> →{" "}
              {s.hs > 0 ? (
                <b className="text-orange-600">+{nf(s.hs)} h sup</b>
              ) : (
                <span className="text-muted-foreground">0 h sup</span>
              )}
              <span className="block text-[10.5px] text-muted-foreground">
                {nf(s.fait)}
                {s.assim ? ` + ${nf(s.assim)} férié/congé` : ""} − 1 pause
              </span>
            </td>
          );
        })}
      </tr>
    );
  };

  return (
    <>
      <div className="overflow-x-auto">
        <table className="w-full text-sm tabular-nums">
          <thead className="sticky top-0 z-10 bg-background">
            <tr className="border-b text-[11px] uppercase tracking-wider text-muted-foreground">
              <th className="px-3 py-2 text-left font-medium">Jour</th>
              {lignes.map((l) => (
                <th
                  key={l.nom}
                  onContextMenu={(e) => {
                    e.preventDefault();
                    setMenu({ x: e.clientX, y: e.clientY, nom: l.nom });
                  }}
                  className="cursor-context-menu px-2 py-2 text-center font-medium normal-case tracking-normal"
                >
                  <span className="block text-sm font-semibold text-foreground">{l.nom}</span>
                  {nf(l.contrat)} h / sem.{l.fixe ? " · fixe" : ""}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {jours.map((j, row) => {
              const fond = j.ferie ? "bg-orange-50" : j.weekend ? "bg-muted/60" : "";
              return [
                <tr key={j.date} className={`border-b ${fond}`}>
                  <th scope="row" className="whitespace-nowrap px-3 py-1 text-left font-normal">
                    <span className={j.weekend || j.ferie ? "text-muted-foreground" : ""}>
                      {nomJour(j.date)}
                    </span>{" "}
                    <b className="font-semibold">{j.num}</b>
                    {j.ferie && (
                      <span className="ml-2 rounded-full bg-orange-100 px-2 py-0.5 text-[10px] font-semibold text-orange-800">
                        {j.ferie}
                      </span>
                    )}
                  </th>
                  {lignes.map((l, col) => {
                    const c = l.cellules[row];
                    const majore = (j.weekend || j.ferie) && c?.type === "Travail" && c.heures > 0;
                    const ouvrirMenu = (e: React.MouseEvent) => {
                      e.preventDefault();
                      setMenu({ x: e.clientX, y: e.clientY, nom: l.nom, date: j.date });
                    };
                    if (c && c.type !== "Travail") {
                      const abs = c.type === "Absence";
                      return (
                        <td key={l.nom} onContextMenu={ouvrirMenu} className="cursor-context-menu px-2 py-1 text-center">
                          {abs && c.heures > 0 && <span className="mr-1 text-sm">{nf(c.heures)}</span>}
                          <span
                            title={abs ? `${c.motif} · ${nf(c.hAbs)} h d'absence` : undefined}
                            className={`inline-block rounded-full px-2 py-1 text-[11px] font-semibold ${
                              abs ? ABSENCE : TYPES[c.type] ?? "bg-zinc-100 text-zinc-600"
                            }`}
                          >
                            {abs ? `${c.motif || "Absence"} ${nf(c.hAbs)} h` : c.type}
                          </span>
                        </td>
                      );
                    }
                    if (!c && j.ferie && !j.weekend) {
                      return (
                        <td key={l.nom} onContextMenu={ouvrirMenu} className="cursor-context-menu px-2 py-1 text-center">
                          <input
                            type="text"
                            inputMode="decimal"
                            placeholder="Férié"
                            disabled={pending}
                            data-col={col}
                            data-row={row}
                            aria-label={`${l.nom} ${nomJour(j.date)} ${j.num}`}
                            onKeyDown={(e) => suivant(e, col, row)}
                            onBlur={(e) => {
                              const v = num(e.target.value);
                              if (e.target.value.trim() === "" || !Number.isFinite(v) || v < 0 || v > 16) {
                                e.target.value = "";
                                return;
                              }
                              start(async () => { await setPointage(l.nom, j.date, "Travail", v); });
                            }}
                            className="w-16 rounded-md border border-sky-200 bg-sky-50 px-2 py-1 text-center text-sm placeholder:text-[11px] placeholder:font-semibold placeholder:text-sky-700 focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
                          />
                        </td>
                      );
                    }
                    // Clé liée à la valeur : la case se remet à jour après
                    // « Remplir le mois » ou un changement fait ailleurs.
                    return (
                      <td key={`${l.nom}|${c?.heures ?? ""}`} onContextMenu={ouvrirMenu} className="cursor-context-menu px-2 py-1 text-center">
                        <input
                          type="text"
                          inputMode="decimal"
                          defaultValue={c ? String(c.heures).replace(".", ",") : ""}
                          disabled={pending}
                          data-col={col}
                          data-row={row}
                          aria-label={`${l.nom} ${nomJour(j.date)} ${j.num}`}
                          onKeyDown={(e) => suivant(e, col, row)}
                          onBlur={(e) => {
                            const brut = e.target.value.trim();
                            const avant = c ? c.heures : null;
                            if (brut === "" && avant === null) return;
                            const v = num(brut);
                            if (brut !== "" && (!Number.isFinite(v) || v < 0 || v > 16)) {
                              e.target.value = avant === null ? "" : String(avant).replace(".", ",");
                              return;
                            }
                            if (brut !== "" && v === avant) return;
                            start(async () => {
                              if (brut === "") await effacerPointage(l.nom, j.date);
                              else await setPointage(l.nom, j.date, "Travail", v);
                            });
                          }}
                          className={`w-16 rounded-md border bg-background px-2 py-1 text-center text-sm focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring disabled:opacity-50 ${
                            majore ? "border-orange-400 font-semibold text-orange-700" : "border-input"
                          }`}
                        />
                      </td>
                    );
                  })}
                </tr>,
                sousTotal(j),
              ];
            })}
          </tbody>
          <tfoot>
            <tr className="border-t-2 border-foreground/70">
              <th className="px-3 py-2 text-left text-xs font-semibold uppercase tracking-wider">
                Total réalisé du mois
              </th>
              {lignes.map((l) => (
                <td key={l.nom} className="px-2 py-2 text-center">
                  <span className="inline-block min-w-[76px] rounded-lg bg-primary px-3 py-1.5 text-base font-bold text-primary-foreground">
                    {nf(l.total)}
                  </span>
                </td>
              ))}
            </tr>
          </tfoot>
        </table>
      </div>

      {menu && (
        <>
          <div className="fixed inset-0 z-40" onMouseDown={fermer} onContextMenu={(e) => { e.preventDefault(); fermer(); }} />
          <div
            role="menu"
            style={{
              left: Math.min(menu.x, (typeof window !== "undefined" ? window.innerWidth : 900) - 240),
              top: Math.min(menu.y, (typeof window !== "undefined" ? window.innerHeight : 800) - 300),
            }}
            className="fixed z-50 w-56 rounded-lg border bg-background p-1.5 shadow-lg"
          >
            <div className="border-b px-2 pb-1.5 text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
              {menu.nom}
              {menu.date ? ` · ${nomJour(menu.date)} ${jm(menu.date)}` : ""}
            </div>
            {menu.date ? (
              <>
                {Object.keys(TYPES).map((t) => (
                  <button
                    key={t}
                    type="button"
                    onClick={() => {
                      fermer();
                      start(() => { void setPointage(menu.nom, menu.date!, t); });
                    }}
                    className="mt-0.5 flex w-full items-center gap-2 rounded-md px-2 py-1.5 text-left text-sm hover:bg-accent"
                  >
                    <span className={`h-2.5 w-2.5 rounded-sm ${TYPES[t].split(" ")[0]}`} />
                    {t}
                    {t === "Récup" && ligneMenu && extrasPrets && !ligneMenu.fixe && (
                      <span className="ml-auto text-[11px] text-muted-foreground">
                        stock {nf(ligneMenu.stockFin)} h
                      </span>
                    )}
                  </button>
                ))}
                {extrasPrets && ligneMenu && (
                  <button
                    type="button"
                    onClick={() => {
                      fermer();
                      setDlg({
                        nom: menu.nom,
                        date: menu.date!,
                        hJour: ligneMenu.hJour,
                        motif: MOTIFS[0],
                        partielle: false,
                        hAbs: String(ligneMenu.hJour).replace(".", ","),
                        hFaites: "",
                        jusquau: "",
                      });
                    }}
                    className="mt-0.5 flex w-full items-center gap-2 rounded-md px-2 py-1.5 text-left text-sm hover:bg-accent"
                  >
                    <span className="h-2.5 w-2.5 rounded-sm bg-violet-100" />
                    Absence (avec motif)…
                  </button>
                )}
                <div className="my-1 border-t" />
                <button
                  type="button"
                  onClick={() => {
                    fermer();
                    start(() => { void effacerPointage(menu.nom, menu.date!); });
                  }}
                  className="flex w-full rounded-md px-2 py-1.5 text-left text-sm text-destructive hover:bg-accent"
                >
                  Effacer la journée
                </button>
              </>
            ) : (
              <>
                <button
                  type="button"
                  onClick={() => {
                    fermer();
                    start(() => { void remplirSemaine(menu.nom, joursOuvres); });
                  }}
                  className="mt-0.5 flex w-full rounded-md px-2 py-1.5 text-left text-sm hover:bg-accent"
                >
                  Remplir le mois au contrat
                </button>
                <button
                  type="button"
                  onClick={() => {
                    fermer();
                    if (!window.confirm(`Vider tout le mois de ${menu.nom} ?`)) return;
                    start(() => { void viderSemaine(menu.nom, jours.map((j) => j.date)); });
                  }}
                  className="mt-0.5 flex w-full rounded-md px-2 py-1.5 text-left text-sm text-destructive hover:bg-accent"
                >
                  Vider le mois
                </button>
              </>
            )}
          </div>
        </>
      )}

      {dlg && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/30 p-4" onMouseDown={() => setDlg(null)}>
          <div
            onMouseDown={(e) => e.stopPropagation()}
            className="w-full max-w-md rounded-xl border bg-background p-5 shadow-xl"
          >
            <h3 className="font-semibold">
              Absence — {dlg.nom}, {nomJour(dlg.date)} {jm(dlg.date)}
            </h3>
            <div className="mt-3 text-xs uppercase tracking-wider text-muted-foreground">Motif</div>
            <div className="mt-1.5 flex flex-wrap gap-1.5">
              {MOTIFS.map((m) => (
                <button
                  key={m}
                  type="button"
                  onClick={() => setDlg({ ...dlg, motif: m })}
                  className={`rounded-full border px-3 py-1 text-xs ${
                    dlg.motif === m ? "border-primary bg-primary text-primary-foreground" : "hover:bg-accent"
                  }`}
                >
                  {m}
                </button>
              ))}
            </div>
            <div className="mt-3 text-xs uppercase tracking-wider text-muted-foreground">Durée</div>
            <div className="mt-1.5 flex gap-1.5">
              {[false, true].map((p) => (
                <button
                  key={String(p)}
                  type="button"
                  onClick={() => setDlg({ ...dlg, partielle: p })}
                  className={`rounded-full border px-3 py-1 text-xs ${
                    dlg.partielle === p ? "border-primary bg-primary text-primary-foreground" : "hover:bg-accent"
                  }`}
                >
                  {p ? "Quelques heures" : "Journée entière"}
                </button>
              ))}
            </div>
            {dlg.partielle ? (
              <div className="mt-3 grid grid-cols-2 gap-3 text-sm">
                <label className="flex flex-col gap-1">
                  <span className="text-xs text-muted-foreground">Heures d&apos;absence</span>
                  <input
                    inputMode="decimal"
                    value={dlg.hAbs}
                    onChange={(e) => setDlg({ ...dlg, hAbs: e.target.value })}
                    className="rounded-md border px-2 py-1.5"
                  />
                </label>
                <label className="flex flex-col gap-1">
                  <span className="text-xs text-muted-foreground">Heures faites ce jour</span>
                  <input
                    inputMode="decimal"
                    value={dlg.hFaites}
                    placeholder="0"
                    onChange={(e) => setDlg({ ...dlg, hFaites: e.target.value })}
                    className="rounded-md border px-2 py-1.5"
                  />
                </label>
              </div>
            ) : (
              <label className="mt-3 flex flex-col gap-1 text-sm">
                <span className="text-xs text-muted-foreground">
                  Jusqu&apos;au (plusieurs jours, lun→ven) — laisser vide pour ce jour seul
                </span>
                <input
                  type="date"
                  value={dlg.jusquau}
                  min={dlg.date}
                  onChange={(e) => setDlg({ ...dlg, jusquau: e.target.value })}
                  className="rounded-md border px-2 py-1.5"
                />
              </label>
            )}
            <div className="mt-5 flex justify-end gap-2">
              <button type="button" onClick={() => setDlg(null)} className="rounded-md border px-3 py-1.5 text-sm hover:bg-accent">
                Annuler
              </button>
              <button
                type="button"
                disabled={pending}
                onClick={() => {
                  const d = dlg;
                  setDlg(null);
                  start(async () => {
                    await setAbsence(
                      d.nom,
                      d.date,
                      d.motif,
                      d.partielle,
                      num(d.hAbs) || 0,
                      num(d.hFaites) || 0,
                      d.jusquau || undefined
                    );
                  });
                }}
                className="rounded-md bg-primary px-3 py-1.5 text-sm font-medium text-primary-foreground hover:bg-primary/90"
              >
                Enregistrer
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
