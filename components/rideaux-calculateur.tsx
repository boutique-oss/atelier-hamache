"use client";

import { useEffect, useMemo, useRef, useState, useTransition } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { ArrowLeft, Copy, Plus, Save, Scissors, Trash2 } from "lucide-react";

import { cn, parseNum } from "@/lib/utils";
import {
  AJUST,
  DOUBLURES,
  PARAMS_DEF,
  TOMBES,
  calc,
  clone,
  eur,
  f0,
  f1,
  f2,
  fh,
  m2,
  newLigne,
  num,
  sanitizeLigne,
  sanitizeParams,
  teteOf,
  totaux,
  type LigneRideau,
  type ParamsRideaux,
  type Resultat,
} from "@/lib/rideaux/calcul";
import { deleteCalcul, saveCalcul, saveParamsAtelier } from "@/app/(main)/rideaux/actions";

type Dossier = { id: number; nom: string; client: string };

type Initial = {
  id: number | null;
  nom: string;
  client: string;
  dossierId: number | null;
  lignes: unknown[] | null;
  params: unknown;
  updatedAt: string | null;
};

const inputCls =
  "w-full min-w-0 rounded-md border border-input bg-background px-2.5 py-1.5 text-sm focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring disabled:opacity-50";

// ------------------------------------------------------------------ champs
// Saisie numérique tolérant la virgule décimale : on garde le texte tapé tel
// quel et on ne pousse que la valeur interprétée (nombre, ou "" si vide).
function NumInput({
  id,
  value,
  onChange,
  unit,
  placeholder,
  disabled,
  className,
  ariaLabel,
}: {
  id?: string;
  value: number | "" | null;
  onChange: (v: number | "") => void;
  unit?: string;
  placeholder?: string;
  disabled?: boolean;
  className?: string;
  ariaLabel?: string;
}) {
  const fmt = (v: number | "" | null) => (v === "" || v == null ? "" : String(v).replace(".", ","));
  const [s, setS] = useState(fmt(value));
  useEffect(() => {
    const cur = parseNum(s);
    const ext = value === "" || value == null ? null : value;
    if (cur !== ext) setS(fmt(value));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [value]);
  return (
    <div className={cn("relative flex", className)}>
      <input
        id={id}
        type="text"
        inputMode="decimal"
        autoComplete="off"
        aria-label={ariaLabel}
        value={s}
        placeholder={placeholder}
        disabled={disabled}
        onChange={(e) => {
          setS(e.target.value);
          const n = parseNum(e.target.value);
          onChange(n == null ? "" : n);
        }}
        className={cn(inputCls, "font-mono tabular-nums", unit && "pr-12")}
      />
      {unit && (
        <i className="pointer-events-none absolute right-2.5 top-1/2 -translate-y-1/2 font-mono text-xs not-italic text-muted-foreground">
          {unit}
        </i>
      )}
    </div>
  );
}

function Champ({ label, hint, htmlFor, children }: { label: React.ReactNode; hint?: string; htmlFor?: string; children: React.ReactNode }) {
  return (
    <div className="flex min-w-0 flex-col gap-1">
      <label htmlFor={htmlFor} className="text-xs text-muted-foreground">
        {label} {hint && <span className="text-muted-foreground/70">{hint}</span>}
      </label>
      {children}
    </div>
  );
}

function Coche({ checked, onChange, children, disabled }: { checked: boolean; onChange: (v: boolean) => void; children: React.ReactNode; disabled?: boolean }) {
  return (
    <label className={cn("flex cursor-pointer items-center gap-2 py-1 text-sm", disabled && "cursor-default opacity-50")}>
      <input
        type="checkbox"
        checked={checked}
        disabled={disabled}
        onChange={(e) => onChange(e.target.checked)}
        className="h-4 w-4 accent-[hsl(var(--primary))]"
      />
      {children}
    </label>
  );
}

function Bloc({ n, titre, children }: { n: string; titre: string; children: React.ReactNode }) {
  return (
    <fieldset className="border-t py-4 first:border-t-0">
      <legend className="float-left mb-3 w-full text-[15px] font-semibold">
        <span className="mr-1.5 font-mono text-xs font-medium text-primary">{n}</span>
        {titre}
      </legend>
      <div className="clear-both">{children}</div>
    </fieldset>
  );
}

const grille = "grid grid-cols-[repeat(auto-fill,minmax(150px,1fr))] gap-x-3 gap-y-2.5";

// Bouton de suppression en deux clics (sans confirm() natif).
function useArme(): [boolean, () => boolean] {
  const [arme, setArme] = useState(false);
  const t = useRef<ReturnType<typeof setTimeout>>();
  useEffect(() => () => clearTimeout(t.current), []);
  return [
    arme,
    () => {
      if (arme) {
        setArme(false);
        clearTimeout(t.current);
        return true;
      }
      setArme(true);
      t.current = setTimeout(() => setArme(false), 3000);
      return false;
    },
  ];
}

export function RideauxDeleteButton({ id, onDone }: { id: number; onDone?: () => void }) {
  const [arme, armer] = useArme();
  const [pending, start] = useTransition();
  return (
    <button
      type="button"
      disabled={pending}
      title="Supprimer ce chiffrage"
      onClick={() => {
        if (!armer()) return;
        start(async () => {
          await deleteCalcul(id);
          onDone?.();
        });
      }}
      className={cn(
        "inline-flex items-center gap-1 rounded-md px-2 py-1 text-xs font-medium",
        arme ? "bg-destructive text-destructive-foreground" : "text-muted-foreground hover:bg-muted hover:text-destructive"
      )}
    >
      <Trash2 size={13} /> {pending ? "…" : arme ? "Confirmer ?" : <span className="sr-only">Supprimer</span>}
    </button>
  );
}

// ------------------------------------------------------------------ résultats
function Etape({ k, v, calcTxt, fort }: { k: string; v: string; calcTxt?: string; fort?: boolean }) {
  return (
    <li className="grid grid-cols-[minmax(0,1fr)_auto] items-baseline gap-x-2.5 gap-y-0.5">
      <span className={cn("text-[13px]", fort && "font-semibold")}>{k}</span>
      <span className={cn("whitespace-nowrap text-right font-mono font-medium tabular-nums", fort && "font-semibold")}>{v}</span>
      {calcTxt && <span className="col-span-2 break-words font-mono text-[11.5px] text-muted-foreground">{calcTxt}</span>}
    </li>
  );
}

function TableDetail({ lignes, total, extra }: { lignes: { k: string; d: string; v: string }[]; total: { k: string; v: string }[]; extra?: React.ReactNode }) {
  return (
    <table className="w-full text-[13px]">
      <tbody>
        {lignes.map((x, i) => (
          <tr key={i}>
            <td className="py-1 align-baseline">
              {x.k}
              {x.d && <span className="block font-mono text-[11.5px] text-muted-foreground">{x.d}</span>}
            </td>
            <td className="whitespace-nowrap py-1 pl-2.5 text-right align-baseline font-mono tabular-nums">{x.v}</td>
          </tr>
        ))}
        {extra}
        {total.map((t, i) => (
          <tr key={"t" + i} className="font-semibold">
            <td className="border-t pt-2">{t.k}</td>
            <td className="whitespace-nowrap border-t pl-2.5 pt-2 text-right font-mono tabular-nums">{t.v}</td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}

function Resultats({ L, P, r }: { L: LigneRideau; P: ParamsRideaux; r: Resultat }) {
  const titre = <h2 className="font-semibold">{L.nom || "Fenêtre"}</h2>;
  if (r.invalid) {
    return (
      <>
        <div className="flex items-center justify-between border-b px-3.5 py-3">{titre}</div>
        <p className="px-3.5 py-3 text-sm text-muted-foreground">
          Renseigner la largeur de tringle, la hauteur et la laize pour lancer le calcul.
        </p>
      </>
    );
  }
  const R = num(L.raccord);
  return (
    <>
      <div className="flex items-center justify-between gap-2 border-b px-3.5 py-3">
        {titre}
        <span
          className={cn(
            "rounded-full px-2 py-0.5 text-[11px] font-semibold",
            r.warn.length ? "bg-amber-100 text-amber-800 dark:bg-amber-950 dark:text-amber-300" : "bg-muted text-emerald-700 dark:text-emerald-400"
          )}
        >
          {r.warn.length ? `${r.warn.length} point${r.warn.length > 1 ? "s" : ""} à vérifier` : "calcul complet"}
        </span>
      </div>
      <div className="grid grid-cols-2 border-b">
        <div className="flex flex-col gap-0.5 p-3.5">
          <span className="brand-eyebrow text-muted-foreground">Tissu à commander</span>
          <span className="text-3xl font-semibold leading-none tabular-nums">
            {m2(r.metrage)}
            <small className="ml-1 text-sm font-medium text-muted-foreground">m</small>
          </span>
          <span className="font-mono text-xs text-muted-foreground">
            {r.mode === "travers" ? "coupé en travers" : `${f2(r.nLes)} lé${r.nLes > 1 ? "s" : ""} × ${f1(r.hCoupe)} cm`}
          </span>
        </div>
        <div className="flex flex-col gap-0.5 border-l p-3.5">
          <span className="brand-eyebrow text-muted-foreground">Total HT{r.qte > 1 ? ` · × ${r.qte}` : ""}</span>
          <span className="text-3xl font-semibold leading-none tabular-nums">
            {f0(Math.round(r.ht))}
            <small className="ml-1 text-sm font-medium text-muted-foreground">€</small>
          </span>
          <span className="font-mono text-xs text-muted-foreground">{fh(r.heures * r.qte)} de confection</span>
        </div>
      </div>

      <div className="border-b px-3.5 py-3">
        <h3 className="brand-eyebrow mb-2 text-muted-foreground">Métrage, pour une fenêtre</h3>
        <ol className="flex flex-col gap-1.5">
          <Etape
            k="Hauteur finie"
            v={f1(r.hFinie) + " cm"}
            calcTxt={
              L.tombe === "libre"
                ? "saisie telle quelle"
                : f1(num(L.hauteur)) + (num(L.ajust) >= 0 ? " + " : " − ") + f1(Math.abs(num(L.ajust))) + " (tombé)"
            }
          />
          <Etape
            k="Hauteur de coupe"
            v={f1(r.hCoupe) + " cm"}
            calcTxt={
              f1(r.hFinie) + " + " + P.rempli + " tête + " + P.ourletBas + " bas = " + f1(r.hBase) +
              (num(L.retrait) > 0 ? " ; + " + f1(num(L.retrait)) + " % retrait = " + f1(r.hRet) : "") +
              (R > 0
                ? P.raccordM === "exact"
                  ? " ; arrondi au raccord " + f1(R) + " → " + Math.round(r.hCoupe / R) + " × " + f1(R)
                  : " ; + raccord " + f1(R)
                : "")
            }
          />
          <Etape
            k="Largeur à confectionner"
            v={f1(r.lTot) + " cm"}
            calcTxt={"(" + f0(num(L.tringle)) + " + 2 × " + f0(num(L.debord)) + ") × " + f2(r.amp) + " + " + r.nOurlets + " × " + P.ourletCote}
          />
          {r.mode === "les" ? (
            <>
              <Etape
                k="Nombre de lés"
                v={f2(r.nLes)}
                calcTxt={
                  f1(r.lTot) + " ÷ " + f0(num(L.laize)) + " = " + f2(r.lesBrut) + " → " + f2(r.nLes) +
                  " (tolérance " + f2(P.seuil) + " lé" + (r.pan === 2 && P.demiLe ? ", demi-lés" : "") + ")"
                }
              />
              <Etape k="Ampleur réelle" v={"× " + f2(r.ampReelle)} />
              <Etape
                k="Métrage tissu"
                v={m2(r.metrage) + " m"}
                calcTxt={Math.ceil(r.nLes) + " × " + f1(r.hCoupe) + " = " + f1(r.metrageBrut) + " cm, arrondi aux 10 cm"}
                fort
              />
            </>
          ) : (
            <Etape
              k="Métrage tissu"
              v={m2(r.metrage) + " m"}
              calcTxt={"largeur à confectionner, arrondie aux 10 cm ; hauteur " + f1(r.hCoupe) + " ≤ laize " + f0(num(L.laize))}
              fort
            />
          )}
          {r.doubl > 0 && (
            <Etape k="Doublure" v={m2(r.doubl) + " m"} calcTxt={r.nLesD + " lé(s) × " + f1(r.hD ?? 0) + " cm, laize " + f0(num(L.laizeD, 140))} />
          )}
          {r.inter > 0 && <Etape k="Interdoublure" v={m2(r.inter) + " m"} calcTxt="même métrage que la doublure" />}
        </ol>
        {r.warn.map((w, i) => (
          <div key={i} className="mt-2 flex gap-2 rounded-md bg-amber-50 px-2.5 py-2 text-[12.5px] dark:bg-amber-950/50">
            <b className="text-amber-700 dark:text-amber-400">!</b>
            <span>{w}</span>
          </div>
        ))}
      </div>

      <div className="border-b px-3.5 py-3">
        <h3 className="brand-eyebrow mb-2 text-muted-foreground">Heures, pour une fenêtre</h3>
        <TableDetail
          lignes={r.heuresDetail.map((x) => ({ k: x.k, d: x.d, v: f0(x.v) + " min" }))}
          extra={
            r.maj ? (
              <tr>
                <td className="py-1">
                  Majoration
                  <span className="block font-mono text-[11.5px] text-muted-foreground">{r.majTxt.join(", ")}</span>
                </td>
                <td className="whitespace-nowrap py-1 pl-2.5 text-right font-mono tabular-nums">+ {f0(r.minutes - r.sousTotMin)} min</td>
              </tr>
            ) : null
          }
          total={[{ k: "Total confection", v: fh(r.heures) }]}
        />
      </div>

      <div className="px-3.5 py-3">
        <h3 className="brand-eyebrow mb-2 text-muted-foreground">Prix</h3>
        <TableDetail
          lignes={r.prix.map((x) => ({ k: x.k, d: x.d, v: eur(x.v) }))}
          total={[
            { k: "Total HT, une fenêtre", v: eur(r.ht1) },
            ...(r.qte > 1 ? [{ k: `Total HT × ${r.qte}`, v: eur(r.ht) }] : []),
          ]}
        />
      </div>
    </>
  );
}

// ------------------------------------------------------------------ texte récap
function recapTexte(nom: string, client: string, lignes: LigneRideau[], P: ParamsRideaux) {
  const out: string[] = [];
  out.push("DEVIS RIDEAUX — " + (nom || "Projet") + (client ? " — " + client : ""));
  out.push("");
  for (const L of lignes) {
    const r = calc(L, P);
    if (r.invalid) {
      out.push("• " + L.nom + " : cotes à compléter");
      continue;
    }
    out.push("• " + L.nom + (r.qte > 1 ? " (× " + r.qte + ")" : "") + " — " + r.tete.nom + (r.pan === 2 ? ", paire" : "") + (L.tissu ? ", " + L.tissu : ""));
    out.push("  Tringle " + f0(num(L.tringle)) + " cm, hauteur finie " + f1(r.hFinie) + " cm, ampleur × " + f2(r.amp));
    out.push(
      "  Tissu " + m2(r.metrage * r.qte) + " m" +
        (r.doubl ? " · doublure " + m2(r.doubl * r.qte) + " m" : "") +
        (r.inter ? " · molleton " + m2(r.inter * r.qte) + " m" : "") +
        " · confection " + fh(r.heures * r.qte) + " · " + eur(r.ht) + " HT"
    );
  }
  const T = totaux(lignes, P);
  out.push("");
  out.push("Total tissu : " + m2(T.tissu) + " m" + (T.doubl ? " · doublures : " + m2(T.doubl) + " m" : ""));
  out.push("Confection : " + fh(T.h));
  out.push("Total HT : " + eur(T.ht) + " · TTC : " + eur(T.ttc));
  return out.join("\n");
}

// ------------------------------------------------------------------ composant
export function RideauxCalculateur({
  initial,
  paramsAtelier,
  paramsValides,
  dossiers,
  peutEditerParams,
}: {
  initial: Initial;
  paramsAtelier: ParamsRideaux;
  paramsValides: boolean;
  dossiers: Dossier[];
  peutEditerParams: boolean;
}) {
  const router = useRouter();
  const [atelier, setAtelier] = useState<ParamsRideaux>(paramsAtelier);
  const [valide, setValide] = useState(paramsValides);
  // Paramètres du chiffrage : figés à l'enregistrement, sinon ceux de l'atelier.
  const [P, setP] = useState<ParamsRideaux>(() => (initial.params ? sanitizeParams(initial.params) : clone(paramsAtelier)));
  const [lignes, setLignes] = useState<LigneRideau[]>(() => {
    const src = initial.lignes && initial.lignes.length ? initial.lignes : null;
    return src ? src.map((l, i) => sanitizeLigne(l, i + 1, P)) : [newLigne(1, paramsAtelier)];
  });
  const [sel, setSel] = useState(0);
  const [nom, setNom] = useState(initial.nom);
  const [client, setClient] = useState(initial.client);
  const [dossierId, setDossierId] = useState<number | null>(initial.dossierId);
  const [id, setId] = useState<number | null>(initial.id);
  const [dirty, setDirty] = useState(false);
  const [onglet, setOnglet] = useState<"calc" | "par">("calc");
  const [msg, setMsg] = useState<{ t: string; err?: boolean } | null>(null);
  const [saving, startSave] = useTransition();
  const [savingPar, startSavePar] = useTransition();
  const [delArme, armerDel] = useArme();
  const [nouveauArme, armerNouveau] = useArme();
  const [copie, setCopie] = useState<string | null>(null);

  const L = lignes[Math.min(sel, lignes.length - 1)];
  const r = useMemo(() => calc(L, P), [L, P]);
  const T = useMemo(() => totaux(lignes, P), [lignes, P]);
  const T0 = teteOf(P, L.tete);
  const paramsDifferents = useMemo(() => JSON.stringify(P) !== JSON.stringify(atelier), [P, atelier]);

  // Alerte avant de quitter la page avec des modifications non enregistrées.
  useEffect(() => {
    if (!dirty) return;
    const h = (e: BeforeUnloadEvent) => {
      e.preventDefault();
      e.returnValue = "";
    };
    window.addEventListener("beforeunload", h);
    return () => window.removeEventListener("beforeunload", h);
  }, [dirty]);

  useEffect(() => {
    if (!msg || msg.err) return;
    const t = setTimeout(() => setMsg(null), 2500);
    return () => clearTimeout(t);
  }, [msg]);

  function majLigne(patch: Partial<LigneRideau>) {
    setLignes((ls) => ls.map((x, i) => (i === sel ? { ...x, ...patch } : x)));
    setDirty(true);
  }

  function enregistrer() {
    startSave(async () => {
      const res = await saveCalcul({ id, nom, client, dossierId, lignes, params: P });
      if (!res.ok) {
        setMsg({ t: "Erreur : " + res.error, err: true });
        return;
      }
      setDirty(false);
      setMsg({ t: `Chiffrage n° ${res.id} enregistré.` });
      if (id !== res.id) {
        setId(res.id);
        router.replace(`/rideaux/${res.id}`);
      }
    });
  }

  function majParam(patch: Partial<ParamsRideaux>) {
    const nv = { ...atelier, ...patch };
    setAtelier(nv);
    setP(clone(nv)); // le chiffrage ouvert suit les paramètres en cours d'édition
    setDirty(true);
  }

  function enregistrerParams() {
    startSavePar(async () => {
      const res = await saveParamsAtelier(atelier, valide);
      setMsg(res.ok ? { t: "Paramètres atelier enregistrés." } : { t: res.error, err: true });
    });
  }

  async function copier() {
    const txt = recapTexte(nom, client, lignes, P);
    try {
      await navigator.clipboard.writeText(txt);
      setCopie(null);
      setMsg({ t: "Récapitulatif copié." });
    } catch {
      setCopie(txt);
    }
  }

  const dossier = dossiers.find((d) => d.id === dossierId);

  return (
    <main className="mx-auto max-w-[1360px] px-4 py-6 sm:px-6">
      {/* En-tête */}
      <div className="flex flex-wrap items-end gap-x-6 gap-y-3 border-b pb-4">
        <div className="min-w-0">
          <Link href="/rideaux" className="mb-1 inline-flex items-center gap-1 text-xs text-muted-foreground hover:text-primary">
            <ArrowLeft size={13} /> Chiffrages enregistrés
          </Link>
          <div className="flex items-center gap-2.5">
            <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary">
              <Scissors size={18} />
            </span>
            <div>
              <p className="brand-eyebrow text-muted-foreground">Atelier ASH · Confection</p>
              <h1 className="brand-display text-xl sm:text-2xl">
                Devis rideaux{" "}
                {id ? <span className="font-mono text-base font-medium text-muted-foreground">n° {id}</span> : <span className="text-base font-medium text-muted-foreground">(nouveau)</span>}
              </h1>
            </div>
          </div>
        </div>
        <div className="flex flex-1 flex-wrap justify-end gap-2.5">
          <Champ label="Projet" htmlFor="p-nom">
            <input id="p-nom" className={cn(inputCls, "w-52")} placeholder="Ex. Séjour + chambre" value={nom} onChange={(e) => { setNom(e.target.value); setDirty(true); }} />
          </Champ>
          <Champ label="Client" htmlFor="p-client">
            <input id="p-client" className={cn(inputCls, "w-48")} placeholder="Nom du client" value={client} onChange={(e) => { setClient(e.target.value); setDirty(true); }} />
          </Champ>
          <Champ label="Dossier lié" htmlFor="p-dossier">
            <select
              id="p-dossier"
              className={cn(inputCls, "w-56")}
              value={dossierId ?? ""}
              onChange={(e) => {
                const v = e.target.value ? Number(e.target.value) : null;
                setDossierId(v);
                const d = dossiers.find((x) => x.id === v);
                if (d && !client) setClient(d.client);
                if (d && !nom) setNom(d.nom);
                setDirty(true);
              }}
            >
              <option value="">— Aucun —</option>
              {dossiers.map((d) => (
                <option key={d.id} value={d.id}>
                  #{d.id} {d.nom}
                  {d.client ? ` — ${d.client}` : ""}
                </option>
              ))}
            </select>
          </Champ>
        </div>
      </div>

      {/* Barre d'actions + onglets */}
      <div className="sticky top-0 z-10 -mx-4 mb-4 flex flex-wrap items-center gap-2 bg-background/95 px-4 py-3 backdrop-blur sm:-mx-6 sm:px-6">
        <nav className="flex gap-1" role="tablist">
          {(
            [
              ["calc", "Chiffrage"],
              ["par", "Paramètres atelier"],
            ] as const
          ).map(([k, lab]) => (
            <button
              key={k}
              role="tab"
              aria-selected={onglet === k}
              onClick={() => setOnglet(k)}
              className={cn(
                "rounded-full px-3.5 py-1.5 text-[13px] font-medium",
                onglet === k ? "bg-foreground text-background" : "text-muted-foreground hover:bg-muted"
              )}
            >
              {lab}
            </button>
          ))}
        </nav>
        <div className="ml-auto flex flex-wrap items-center gap-2">
          {msg && (
            <span role="status" className={cn("text-xs", msg.err ? "text-destructive" : "text-emerald-700 dark:text-emerald-400")}>
              {msg.t}
            </span>
          )}
          {dirty && !msg && <span className="text-xs text-amber-700 dark:text-amber-400">Modifications non enregistrées</span>}
          <button
            type="button"
            onClick={enregistrer}
            disabled={saving}
            className="inline-flex items-center gap-1.5 rounded-md bg-primary px-3 py-1.5 text-sm font-semibold text-primary-foreground shadow hover:bg-primary/90 disabled:opacity-60"
          >
            <Save size={15} /> {saving ? "Enregistrement…" : "Enregistrer le chiffrage"}
          </button>
          <Link
            href="/rideaux/nouveau"
            onClick={(e) => {
              // Modifications en cours : un second clic est demandé (pas de confirm()).
              if (dirty && !armerNouveau()) e.preventDefault();
            }}
            className={cn(
              "inline-flex items-center gap-1.5 rounded-md border px-3 py-1.5 text-sm font-medium",
              nouveauArme ? "border-amber-500 text-amber-700 dark:text-amber-400" : "hover:bg-muted"
            )}
          >
            <Plus size={15} /> {nouveauArme ? "Non enregistré — recliquer pour continuer" : "Nouveau devis rideaux"}
          </Link>
          {id && (
            <RideauxDeleteButton
              id={id}
              onDone={() => {
                setDirty(false);
                router.push("/rideaux");
              }}
            />
          )}
        </div>
      </div>

      {paramsDifferents && initial.params != null && onglet === "calc" && (
        <div className="mb-4 flex flex-wrap items-center gap-3 rounded-md bg-amber-50 px-3 py-2 text-sm dark:bg-amber-950/50">
          <span>
            Ce chiffrage utilise les paramètres atelier en vigueur lors de son enregistrement (taux, temps, têtes…). Ils diffèrent des paramètres actuels.
          </span>
          <button
            type="button"
            onClick={() => {
              setP(clone(atelier));
              setDirty(true);
            }}
            className="rounded-md border border-amber-300 bg-background px-2.5 py-1 text-xs font-medium hover:bg-muted dark:border-amber-800"
          >
            Recalculer avec les paramètres actuels
          </button>
        </div>
      )}

      {onglet === "calc" ? (
        <>
          <div className="grid items-start gap-5 lg:grid-cols-[200px_minmax(0,1fr)] xl:grid-cols-[220px_minmax(0,1fr)_380px]">
            {/* Fenêtres */}
            <aside className="min-w-0 rounded-lg border bg-card">
              <div className="flex items-center justify-between border-b px-3.5 py-3">
                <h2 className="font-semibold">Fenêtres</h2>
                <span className="brand-eyebrow text-muted-foreground">
                  {lignes.length} ligne{lignes.length > 1 ? "s" : ""}
                </span>
              </div>
              <ul className="p-1.5">
                {lignes.map((x, i) => {
                  const rx = calc(x, P);
                  return (
                    <li key={x.id}>
                      <button
                        type="button"
                        aria-current={i === sel}
                        onClick={() => setSel(i)}
                        className={cn("flex w-full flex-col gap-0.5 rounded px-2.5 py-2 text-left", i === sel ? "bg-primary/10" : "hover:bg-muted")}
                      >
                        <span className="break-words font-semibold">
                          {x.nom || `Fenêtre ${i + 1}`}
                          {num(x.qte, 1) > 1 && <span className="ml-1 rounded-full bg-muted px-1.5 text-[11px] font-semibold text-muted-foreground">× {x.qte}</span>}
                        </span>
                        <span className="font-mono text-xs tabular-nums text-muted-foreground">
                          {rx.invalid ? "cotes à compléter" : `${m2(rx.metrage)} m · ${eur(rx.ht)}`}
                        </span>
                      </button>
                    </li>
                  );
                })}
              </ul>
              <div className="flex flex-col gap-1.5 px-3 pb-3 pt-1">
                <button
                  type="button"
                  onClick={() => {
                    setLignes((ls) => [...ls, newLigne(ls.length + 1, P)]);
                    setSel(lignes.length);
                    setDirty(true);
                  }}
                  className="rounded-md bg-primary px-3 py-1.5 text-[13px] font-medium text-primary-foreground hover:bg-primary/90"
                >
                  + Ajouter une fenêtre
                </button>
                <button
                  type="button"
                  onClick={() => {
                    const c = { ...clone(L), id: Date.now() + "-d", nom: (L.nom || "Fenêtre") + " (copie)" };
                    setLignes((ls) => [...ls.slice(0, sel + 1), c, ...ls.slice(sel + 1)]);
                    setSel(sel + 1);
                    setDirty(true);
                  }}
                  className="rounded-md border px-3 py-1.5 text-[13px] font-medium hover:bg-muted"
                >
                  Dupliquer
                </button>
                <button
                  type="button"
                  disabled={lignes.length < 2}
                  onClick={() => {
                    if (!armerDel()) return;
                    setLignes((ls) => ls.filter((_, i) => i !== sel));
                    setSel(Math.max(0, sel - 1));
                    setDirty(true);
                  }}
                  className={cn(
                    "rounded-md border px-3 py-1.5 text-[13px] font-medium disabled:opacity-50",
                    delArme ? "border-destructive bg-destructive text-destructive-foreground" : "text-destructive hover:bg-muted"
                  )}
                >
                  {delArme ? "Confirmer la suppression" : "Supprimer"}
                </button>
              </div>
            </aside>

            {/* Saisie */}
            <div className="min-w-0 rounded-lg border bg-card px-4 pb-2" key={L.id}>
              <Bloc n="01" titre="Fenêtre">
                <div className={grille}>
                  <Champ label="Désignation" htmlFor="f-nom">
                    <input id="f-nom" className={inputCls} value={L.nom} onChange={(e) => majLigne({ nom: e.target.value })} />
                  </Champ>
                  <Champ label="Fenêtres identiques" htmlFor="f-qte">
                    <NumInput id="f-qte" value={L.qte} unit="×" onChange={(v) => majLigne({ qte: v })} />
                  </Champ>
                  <Champ label="Composition" htmlFor="f-pan">
                    <select id="f-pan" className={inputCls} value={L.panneaux} onChange={(e) => majLigne({ panneaux: e.target.value === "1" ? 1 : 2 })}>
                      <option value="1">1 panneau</option>
                      <option value="2">Paire (2 panneaux)</option>
                    </select>
                  </Champ>
                </div>
              </Bloc>

              <Bloc n="02" titre="Cotes">
                <div className={grille}>
                  <Champ label="Largeur tringle / rail" hint="hors embouts" htmlFor="f-tringle">
                    <NumInput id="f-tringle" value={L.tringle} unit="cm" onChange={(v) => majLigne({ tringle: v })} />
                  </Champ>
                  <Champ label="Débord par côté" htmlFor="f-debord">
                    <NumInput id="f-debord" value={L.debord} unit="cm" onChange={(v) => majLigne({ debord: v })} />
                  </Champ>
                  <Champ label="Hauteur tringle → sol" htmlFor="f-hauteur">
                    <NumInput id="f-hauteur" value={L.hauteur} unit="cm" onChange={(v) => majLigne({ hauteur: v })} />
                  </Champ>
                </div>
                <div className={cn(grille, "mt-2.5")}>
                  <Champ label="Tombé" htmlFor="f-tombe">
                    <select
                      id="f-tombe"
                      className={inputCls}
                      value={L.tombe}
                      onChange={(e) => {
                        const t = e.target.value as LigneRideau["tombe"];
                        majLigne({ tombe: t, ajust: AJUST[t] });
                      }}
                    >
                      {TOMBES.map((t) => (
                        <option key={t.v} value={t.v}>
                          {t.label}
                        </option>
                      ))}
                    </select>
                  </Champ>
                  <Champ label="Ajustement hauteur" htmlFor="f-ajust">
                    <NumInput id="f-ajust" value={L.ajust} unit="cm" disabled={L.tombe === "libre"} onChange={(v) => majLigne({ ajust: v })} />
                  </Champ>
                </div>
              </Bloc>

              <Bloc n="03" titre="Tête et ampleur">
                <div className="flex flex-wrap gap-1.5" role="radiogroup" aria-label="Type de tête">
                  {P.tetes.map((t) => (
                    <label key={t.id} className="cursor-pointer">
                      <input
                        type="radio"
                        name="tete"
                        value={t.id}
                        checked={L.tete === t.id}
                        onChange={() => majLigne({ tete: t.id, ampleur: null })}
                        className="peer sr-only"
                      />
                      <span className="inline-flex flex-col rounded-md border bg-background px-2.5 py-1.5 text-[13px] peer-checked:border-primary peer-checked:bg-primary/10 peer-focus-visible:ring-2 peer-focus-visible:ring-ring">
                        <b className="font-semibold">{t.nom}</b>
                        <small className="font-mono text-[11px] text-muted-foreground">× {f2(t.amp)}</small>
                      </span>
                    </label>
                  ))}
                </div>
                <div className={cn(grille, "mt-3")}>
                  <Champ
                    htmlFor="f-ampleur"
                    label={
                      <>
                        Ampleur retenue{" "}
                        <button type="button" className="text-[11px] text-primary underline" onClick={() => majLigne({ ampleur: null })}>
                          valeur de la tête
                        </button>
                      </>
                    }
                  >
                    <NumInput
                      id="f-ampleur"
                      value={L.ampleur}
                      unit="×"
                      placeholder={f2(L.voilage ? 2.5 : T0.amp) + " (auto)"}
                      onChange={(v) => majLigne({ ampleur: v === "" ? null : v })}
                    />
                  </Champ>
                  <div className="flex items-end">
                    <Coche checked={L.voilage} onChange={(v) => majLigne({ voilage: v, ampleur: null })}>
                      Voilage (ampleur × 2,5)
                    </Coche>
                  </div>
                </div>
              </Bloc>

              <Bloc n="04" titre="Tissu">
                <div className={grille}>
                  <Champ label="Référence" htmlFor="f-tissu">
                    <input id="f-tissu" className={inputCls} placeholder="Éditeur, coloris" value={L.tissu} onChange={(e) => majLigne({ tissu: e.target.value })} />
                  </Champ>
                  <Champ label="Laize" htmlFor="f-laize">
                    <NumInput id="f-laize" value={L.laize} unit="cm" onChange={(v) => majLigne({ laize: v })} />
                  </Champ>
                  <Champ label="Raccord vertical" hint="0 si uni" htmlFor="f-raccord">
                    <NumInput id="f-raccord" value={L.raccord} unit="cm" onChange={(v) => majLigne({ raccord: v })} />
                  </Champ>
                  <Champ label="Prix du tissu" htmlFor="f-prix">
                    <NumInput id="f-prix" value={L.prix} unit="€/m" onChange={(v) => majLigne({ prix: v })} />
                  </Champ>
                  <Champ label="Retrait fibres naturelles" htmlFor="f-retrait">
                    <NumInput id="f-retrait" value={L.retrait} unit="%" onChange={(v) => majLigne({ retrait: v })} />
                  </Champ>
                </div>
                <div className={cn(grille, "mt-2")}>
                  <Coche checked={L.travers} onChange={(v) => majLigne({ travers: v })}>Grande largeur, coupé en travers</Coche>
                  <Coche checked={L.delicat} onChange={(v) => majLigne({ delicat: v })}>Tissu délicat (velours, soie, glissant)</Coche>
                  <Coche checked={L.nonfeu} onChange={(v) => majLigne({ nonfeu: v })}>Non-feu exigé (ERP)</Coche>
                </div>
              </Bloc>

              <Bloc n="05" titre="Doublure">
                <div className={grille}>
                  <Champ label="Type" htmlFor="f-doublure">
                    <select id="f-doublure" className={inputCls} value={L.doublure} onChange={(e) => majLigne({ doublure: e.target.value as LigneRideau["doublure"] })}>
                      {DOUBLURES.map((d) => (
                        <option key={d.v} value={d.v}>
                          {d.label}
                        </option>
                      ))}
                    </select>
                  </Champ>
                  <Champ label="Laize doublure" htmlFor="f-laizeD">
                    <NumInput id="f-laizeD" value={L.laizeD} unit="cm" disabled={L.doublure === "aucune"} onChange={(v) => majLigne({ laizeD: v })} />
                  </Champ>
                  <Champ label="Prix doublure" htmlFor="f-prixD">
                    <NumInput id="f-prixD" value={L.prixD} unit="€/m" disabled={L.doublure === "aucune"} onChange={(v) => majLigne({ prixD: v })} />
                  </Champ>
                  <div className="flex items-end">
                    <Coche checked={L.interdoublure} disabled={L.doublure === "aucune"} onChange={(v) => majLigne({ interdoublure: v })}>
                      Interdoublure molleton
                    </Coche>
                  </div>
                  <Champ label="Prix molleton" htmlFor="f-prixI">
                    <NumInput id="f-prixI" value={L.prixI} unit="€/m" disabled={L.doublure === "aucune" || !L.interdoublure} onChange={(v) => majLigne({ prixI: v })} />
                  </Champ>
                </div>
              </Bloc>

              <Bloc n="06" titre="Finitions et pose">
                <div className={grille}>
                  <Coche checked={L.lestage} onChange={(v) => majLigne({ lestage: v })}>Lestage (plombs d&apos;angle)</Coche>
                  <Coche checked={L.mitres} onChange={(v) => majLigne({ mitres: v })}>Angles mitrés</Coche>
                  <Coche checked={L.main} onChange={(v) => majLigne({ main: v })}>Ourlets cousus main</Coche>
                </div>
                <div className={cn(grille, "mt-2.5")}>
                  <Champ label="Galon / bordure" htmlFor="f-galonMl">
                    <NumInput id="f-galonMl" value={L.galonMl} unit="m" onChange={(v) => majLigne({ galonMl: v })} />
                  </Champ>
                  <Champ label="Prix galon" htmlFor="f-galonPrix">
                    <NumInput id="f-galonPrix" value={L.galonPrix} unit="€/m" onChange={(v) => majLigne({ galonPrix: v })} />
                  </Champ>
                  <Champ label="Pose (par fenêtre)" htmlFor="f-pose">
                    <NumInput id="f-pose" value={L.pose} unit="€ HT" onChange={(v) => majLigne({ pose: v })} />
                  </Champ>
                </div>
              </Bloc>
            </div>

            {/* Résultats */}
            <aside aria-live="polite" className="min-w-0 rounded-lg border bg-card lg:col-span-2 xl:sticky xl:top-20 xl:col-span-1">
              <Resultats L={L} P={P} r={r} />
            </aside>
          </div>

          {/* Récapitulatif */}
          <section className="mt-5 rounded-lg border bg-card">
            <div className="flex items-center justify-between gap-2 border-b px-3.5 py-3">
              <h2 className="font-semibold">Récapitulatif du projet</h2>
              <span className="brand-eyebrow truncate text-muted-foreground">
                {[nom, client, dossier ? `dossier #${dossier.id}` : ""].filter(Boolean).join(" · ")}
              </span>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full min-w-[640px] text-[13px]">
                <thead>
                  <tr className="border-b text-left text-[11px] uppercase tracking-wide text-muted-foreground">
                    <th className="px-3 py-2 font-semibold">Fenêtre</th>
                    <th className="px-3 py-2 font-semibold">Tête</th>
                    <th className="px-3 py-2 font-semibold">Tissu</th>
                    <th className="px-3 py-2 text-right font-semibold">Qté</th>
                    <th className="px-3 py-2 text-right font-semibold">Tissu</th>
                    <th className="px-3 py-2 text-right font-semibold">Doublures</th>
                    <th className="px-3 py-2 text-right font-semibold">Confection</th>
                    <th className="px-3 py-2 text-right font-semibold">Total HT</th>
                  </tr>
                </thead>
                <tbody>
                  {lignes.map((x) => {
                    const rx = calc(x, P);
                    if (rx.invalid)
                      return (
                        <tr key={x.id} className="border-b">
                          <td className="px-3 py-2">{x.nom}</td>
                          <td colSpan={7} className="px-3 py-2 text-muted-foreground">
                            cotes à compléter
                          </td>
                        </tr>
                      );
                    return (
                      <tr key={x.id} className="border-b">
                        <td className="px-3 py-2">{x.nom}</td>
                        <td className="px-3 py-2">
                          {rx.tete.nom}
                          {rx.pan === 2 ? " · paire" : ""}
                        </td>
                        <td className="px-3 py-2">{x.tissu || "—"}</td>
                        <td className="px-3 py-2 text-right font-mono tabular-nums">{rx.qte}</td>
                        <td className="whitespace-nowrap px-3 py-2 text-right font-mono tabular-nums">{m2(rx.metrage * rx.qte)} m</td>
                        <td className="whitespace-nowrap px-3 py-2 text-right font-mono tabular-nums">{rx.doubl ? m2((rx.doubl + rx.inter) * rx.qte) + " m" : "—"}</td>
                        <td className="whitespace-nowrap px-3 py-2 text-right font-mono tabular-nums">{fh(rx.heures * rx.qte)}</td>
                        <td className="whitespace-nowrap px-3 py-2 text-right font-mono tabular-nums">{eur(rx.ht)}</td>
                      </tr>
                    );
                  })}
                </tbody>
                <tfoot className="font-semibold">
                  <tr>
                    <td colSpan={4} className="px-3 py-2">
                      Total projet
                    </td>
                    <td className="whitespace-nowrap px-3 py-2 text-right font-mono tabular-nums">{m2(T.tissu)} m</td>
                    <td className="whitespace-nowrap px-3 py-2 text-right font-mono tabular-nums">{T.doubl ? m2(T.doubl) + " m" : "—"}</td>
                    <td className="whitespace-nowrap px-3 py-2 text-right font-mono tabular-nums">{fh(T.h)}</td>
                    <td className="whitespace-nowrap px-3 py-2 text-right font-mono tabular-nums">{eur(T.ht)}</td>
                  </tr>
                  <tr>
                    <td colSpan={7} className="px-3 py-2 font-medium text-muted-foreground">
                      TTC (TVA {f1(P.tva)} %)
                    </td>
                    <td className="whitespace-nowrap px-3 py-2 text-right font-mono tabular-nums">{eur(T.ttc)}</td>
                  </tr>
                </tfoot>
              </table>
            </div>
            <div className="flex flex-wrap items-center gap-2 px-3.5 py-3">
              <button type="button" onClick={copier} className="inline-flex items-center gap-1.5 rounded-md border px-3 py-1.5 text-sm font-medium hover:bg-muted">
                <Copy size={14} /> Copier le récapitulatif
              </button>
              <button
                type="button"
                onClick={enregistrer}
                disabled={saving}
                className="inline-flex items-center gap-1.5 rounded-md bg-primary px-3 py-1.5 text-sm font-semibold text-primary-foreground hover:bg-primary/90 disabled:opacity-60"
              >
                <Save size={14} /> {saving ? "Enregistrement…" : "Enregistrer le chiffrage"}
              </button>
            </div>
            {copie != null && (
              <textarea
                readOnly
                aria-label="Texte du récapitulatif"
                value={copie}
                onFocus={(e) => e.currentTarget.select()}
                className="mx-3.5 mb-3.5 block min-h-[120px] w-[calc(100%-1.75rem)] rounded-md border bg-background p-2 font-mono text-xs"
              />
            )}
          </section>
        </>
      ) : (
        <ParamsAtelier
          P={atelier}
          valide={valide}
          setValide={(v) => setValide(v)}
          maj={majParam}
          peutEditer={peutEditerParams}
          saving={savingPar}
          onSave={enregistrerParams}
          onReset={() => majParam(clone(PARAMS_DEF))}
        />
      )}
    </main>
  );
}

// ------------------------------------------------------------------ paramètres
function BadgeEx({ show, children = "exemple" }: { show: boolean; children?: React.ReactNode }) {
  if (!show) return null;
  return (
    <span className="rounded bg-amber-100 px-1.5 py-0.5 text-[10.5px] font-semibold uppercase tracking-wide text-amber-800 dark:bg-amber-950 dark:text-amber-300">
      {children}
    </span>
  );
}

function ParamsAtelier({
  P,
  valide,
  setValide,
  maj,
  peutEditer,
  saving,
  onSave,
  onReset,
}: {
  P: ParamsRideaux;
  valide: boolean;
  setValide: (v: boolean) => void;
  maj: (p: Partial<ParamsRideaux>) => void;
  peutEditer: boolean;
  saving: boolean;
  onSave: () => void;
  onReset: () => void;
}) {
  const [resetArme, armerReset] = useArme();
  const ro = !peutEditer;
  const champ = (k: keyof ParamsRideaux, label: string, unit: string) => (
    <Champ label={label} htmlFor={`pr-${k}`}>
      <NumInput id={`pr-${k}`} value={P[k] as number} unit={unit} disabled={ro} onChange={(v) => maj({ [k]: v === "" ? (PARAMS_DEF[k] as number) : v } as Partial<ParamsRideaux>)} />
    </Champ>
  );
  const panel = (titre: string, badge: boolean, children: React.ReactNode, cls = "") => (
    <div className={cn("min-w-0 rounded-lg border bg-card", cls)}>
      <div className="flex items-center justify-between gap-2 border-b px-3.5 py-3">
        <h2 className="font-semibold">{titre}</h2>
        <BadgeEx show={badge} />
      </div>
      <div className="px-3.5 py-3">{children}</div>
    </div>
  );

  return (
    <section>
      <p className="mb-4 max-w-[75ch] text-sm text-muted-foreground">
        Ces valeurs s&apos;appliquent à toutes les fenêtres et sont enregistrées en base pour tout l&apos;atelier. Les temps, tarifs et fournitures marqués{" "}
        <BadgeEx show /> sont des valeurs de départ, à remplacer par les chiffres de l&apos;atelier après chronométrage.
        {ro && <b className="mt-1 block text-foreground">Lecture seule : seul l&apos;administrateur peut modifier ces paramètres.</b>}
      </p>
      <div className="grid gap-5 [grid-template-columns:repeat(auto-fit,minmax(min(100%,340px),1fr))]">
        {panel(
          "Règles de métrage",
          false,
          <div className={grille}>
            {champ("rempli", "Rempli de tête", "cm")}
            {champ("ourletBas", "Ourlet bas", "cm")}
            {champ("ourletCote", "Ourlet de côté (chacun)", "cm")}
            {champ("debordDef", "Débord par défaut", "cm")}
            {champ("seuil", "Tolérance avant lé suppl.", "lé")}
            <Champ label="Calcul du raccord" htmlFor="pr-raccordM">
              <select id="pr-raccordM" className={inputCls} disabled={ro} value={P.raccordM} onChange={(e) => maj({ raccordM: e.target.value === "simple" ? "simple" : "exact" })}>
                <option value="exact">Arrondi au multiple de R</option>
                <option value="simple">Ajouter R une fois</option>
              </select>
            </Champ>
            <div className="flex items-end">
              <Coche checked={P.demiLe} disabled={ro} onChange={(v) => maj({ demiLe: v })}>
                Demi-lés autorisés (paires)
              </Coche>
            </div>
          </div>
        )}
        {panel(
          "Tarifs",
          !valide,
          <div className={grille}>
            {champ("taux", "Taux horaire atelier", "€/h")}
            {champ("coef", "Coef. sur achats", "×")}
            {champ("lestPrix", "Lestage", "€/pan.")}
            {champ("tva", "TVA", "%")}
          </div>
        )}
        {panel(
          "Temps des opérations",
          !valide,
          <div className={grille}>
            {champ("tPrepa", "Préparation, fiche", "min/pan.")}
            {champ("tCoupe", "Coupe", "min/lé")}
            {champ("tAssemb", "Assemblage des lés", "min/cout.")}
            {champ("tOCote", "Ourlets de côté", "min/m")}
            {champ("tOBas", "Ourlet bas", "min/m")}
            {champ("tDoubl", "Montage doublure", "min/m")}
            {champ("tInter", "Interdoublure", "min/m")}
            {champ("tLest", "Lestage", "min/pan.")}
            {champ("tMitre", "Angle mitré", "min/angle")}
            {champ("tGalon", "Pose galon", "min/m")}
            {champ("tFinition", "Repassage, contrôle", "min/pan.")}
            {champ("kMain", "Ourlets main", "× ourlets")}
            {champ("kRaccord", "Majoration raccord", "%")}
            {champ("kDelicat", "Majoration tissu délicat", "%")}
          </div>
        )}
        {panel(
          "Têtes",
          !valide,
          <div className="overflow-x-auto">
            <table className="w-full min-w-[560px] text-[13px]">
              <thead>
                <tr className="border-b text-left text-[11px] uppercase tracking-wide text-muted-foreground">
                  <th className="px-1.5 py-1.5 font-semibold">Tête</th>
                  <th className="px-1.5 py-1.5 font-semibold">Ampleur ×</th>
                  <th className="px-1.5 py-1.5 font-semibold">Temps (min/m)</th>
                  <th className="px-1.5 py-1.5 font-semibold">Fourniture (€/m)</th>
                  <th className="px-1.5 py-1.5 font-semibold">Origine de l&apos;ampleur</th>
                </tr>
              </thead>
              <tbody>
                {P.tetes.map((t, i) => {
                  const set = (f: "amp" | "tm" | "fo", v: number | "") =>
                    maj({ tetes: P.tetes.map((x, j) => (j === i ? { ...x, [f]: v === "" ? 0 : v } : x)) });
                  return (
                    <tr key={t.id} className="border-b">
                      <td className="px-1.5 py-1.5 font-medium">{t.nom}</td>
                      <td className="px-1.5 py-1.5"><NumInput ariaLabel={`Ampleur ${t.nom}`} value={t.amp} disabled={ro} onChange={(v) => set("amp", v)} /></td>
                      <td className="px-1.5 py-1.5"><NumInput ariaLabel={`Temps ${t.nom}`} value={t.tm} disabled={ro} onChange={(v) => set("tm", v)} /></td>
                      <td className="px-1.5 py-1.5"><NumInput ariaLabel={`Fourniture ${t.nom}`} value={t.fo} disabled={ro} onChange={(v) => set("fo", v)} /></td>
                      <td className="px-1.5 py-1.5 text-muted-foreground">{t.src}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>,
          "[grid-column:1/-1]"
        )}
      </div>
      {peutEditer && (
        <div className="mt-4 flex flex-wrap items-center gap-3">
          <Coche checked={valide} onChange={setValide}>
            Valeurs validées par l&apos;atelier (retire le badge « exemple »)
          </Coche>
          <button
            type="button"
            onClick={onSave}
            disabled={saving}
            className="inline-flex items-center gap-1.5 rounded-md bg-primary px-3 py-1.5 text-sm font-semibold text-primary-foreground hover:bg-primary/90 disabled:opacity-60"
          >
            <Save size={14} /> {saving ? "Enregistrement…" : "Enregistrer les paramètres atelier"}
          </button>
          <button
            type="button"
            onClick={() => armerReset() && onReset()}
            className={cn("rounded-md border px-3 py-1.5 text-sm font-medium", resetArme ? "border-destructive text-destructive" : "hover:bg-muted")}
          >
            {resetArme ? "Confirmer le retour aux valeurs d'origine" : "Rétablir les valeurs d'origine"}
          </button>
        </div>
      )}
    </section>
  );
}
