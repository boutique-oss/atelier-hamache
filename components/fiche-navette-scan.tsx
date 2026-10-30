"use client";

import { useEffect, useRef, useState } from "react";
import { Camera, CheckCircle2, Loader2 } from "lucide-react";

import { creerFicheNavette } from "@/app/pointages/actions";
import { deposerDocument } from "@/components/document-depot";

const CLE_OPERATEUR = "ash-scan-operateur";

const champ =
  "h-12 w-full rounded-md border border-input bg-background px-3 text-base";

// Formulaire de la page scan (téléphone) : opérateur + semaine + photo.
// Le nom choisi est mémorisé sur le téléphone pour la fois suivante.
export function FicheNavetteScan({
  operateurs,
  semaines,
}: {
  operateurs: string[];
  semaines: { value: string; label: string }[];
}) {
  const [operateur, setOperateur] = useState("");
  const [semaine, setSemaine] = useState(semaines[0]?.value ?? "");
  const [etat, setEtat] = useState<"pret" | "envoi" | "fait">("pret");
  const [progression, setProgression] = useState(0);
  const [erreur, setErreur] = useState<string | null>(null);
  const input = useRef<HTMLInputElement>(null);

  useEffect(() => {
    try {
      const v = localStorage.getItem(CLE_OPERATEUR);
      if (v && operateurs.includes(v)) setOperateur(v);
    } catch {
      /* stockage indisponible : rien à retenir */
    }
  }, [operateurs]);

  async function envoyer(file: File) {
    setErreur(null);
    if (!operateur) {
      setErreur("Choisissez d'abord votre nom.");
      return;
    }
    setEtat("envoi");
    setProgression(0);
    const res = await deposerDocument(
      file,
      { dossierId: null, categorie: "fiche_navette", origine: "scan" },
      setProgression
    );
    if (!res.ok) {
      setEtat("pret");
      setErreur(res.error);
      return;
    }
    const fiche = await creerFicheNavette(res.document.id, operateur, semaine);
    if (!fiche.ok) {
      setEtat("pret");
      setErreur(fiche.error);
      return;
    }
    try {
      localStorage.setItem(CLE_OPERATEUR, operateur);
    } catch {
      /* ignoré */
    }
    setEtat("fait");
  }

  if (etat === "fait") {
    return (
      <div className="rounded-lg border bg-card p-5 text-center">
        <CheckCircle2 size={36} aria-hidden className="mx-auto text-[hsl(var(--brand-green))]" />
        <p className="mt-3 text-lg font-medium">Fiche envoyée, merci {operateur} !</p>
        <p className="mt-1 text-sm text-muted-foreground">Le bureau va la saisir.</p>
        <button
          type="button"
          onClick={() => setEtat("pret")}
          className="mt-5 h-12 w-full rounded-md border border-input bg-background text-base font-medium hover:bg-accent"
        >
          Envoyer une autre fiche
        </button>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <label className="block space-y-1.5">
        <span className="text-sm font-medium">Votre nom</span>
        <select value={operateur} onChange={(e) => setOperateur(e.target.value)} className={champ}>
          <option value="">Choisir…</option>
          {operateurs.map((o) => (
            <option key={o} value={o}>
              {o}
            </option>
          ))}
        </select>
      </label>
      <label className="block space-y-1.5">
        <span className="text-sm font-medium">Semaine de la fiche</span>
        <select value={semaine} onChange={(e) => setSemaine(e.target.value)} className={champ}>
          {semaines.map((s) => (
            <option key={s.value} value={s.value}>
              {s.label}
            </option>
          ))}
        </select>
      </label>

      <input
        ref={input}
        type="file"
        accept="image/*"
        capture="environment"
        className="sr-only"
        tabIndex={-1}
        onChange={(e) => {
          const f = e.target.files?.[0];
          e.target.value = "";
          if (f) void envoyer(f);
        }}
      />
      <button
        type="button"
        disabled={etat === "envoi"}
        onClick={() => {
          if (!operateur) {
            setErreur("Choisissez d'abord votre nom.");
            return;
          }
          input.current?.click();
        }}
        className="flex h-16 w-full items-center justify-center gap-2 rounded-md bg-primary text-lg font-medium text-primary-foreground shadow disabled:opacity-70"
      >
        {etat === "envoi" ? (
          <>
            <Loader2 size={22} aria-hidden className="animate-spin" /> Envoi… {progression} %
          </>
        ) : (
          <>
            <Camera size={22} aria-hidden /> Photographier la fiche
          </>
        )}
      </button>
      {erreur && (
        <p role="alert" className="rounded-md border border-destructive/40 bg-destructive/5 px-3 py-2 text-sm text-destructive">
          {erreur}
        </p>
      )}
    </div>
  );
}
