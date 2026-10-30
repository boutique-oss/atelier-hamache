"use client";

import { useRef, useState, useTransition } from "react";
import { useFormStatus } from "react-dom";
import { Download } from "lucide-react";

import { Button } from "@/components/ui/button";

// Bouton d'export EBP : construit l'URL AU MOMENT DU CLIC avec un horodatage
// unique, pour qu'aucune couche de cache (navigateur, CDN) ne puisse resservir
// un ancien CSV — le fichier reflète toujours l'état courant de la base.
export function ExportEbpButton({
  fournisseurId,
  label,
}: {
  fournisseurId?: number;
  label: string;
}) {
  function exporter() {
    const qs = new URLSearchParams();
    if (fournisseurId) qs.set("fournisseur", String(fournisseurId));
    qs.set("t", String(Date.now()));
    window.location.href = `/api/catalogue/export-ebp?${qs.toString()}`;
  }
  return (
    <button
      type="button"
      onClick={exporter}
      className="inline-flex items-center gap-1.5 rounded-md border px-3 py-1.5 text-sm font-medium hover:bg-muted"
      title="Exporter au format d'import article EBP (toujours à jour)"
    >
      <Download size={15} /> {label}
    </button>
  );
}

const inputCls =
  "rounded-md border border-input bg-background px-2 py-1.5 text-sm focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring";

// Action serveur déjà « bindée » côté page (fournisseurId / collectionId figés).
type FormAction = (fd: FormData) => Promise<void>;

function Submit({ label = "Ajouter" }: { label?: string }) {
  const { pending } = useFormStatus();
  return (
    <Button type="submit" size="sm" disabled={pending}>
      {pending ? "…" : label}
    </Button>
  );
}

function Champ({
  nom,
  label,
  className = "",
  ...rest
}: {
  nom: string;
  label: string;
  className?: string;
} & React.InputHTMLAttributes<HTMLInputElement>) {
  return (
    <label className="flex flex-col gap-1 text-xs">
      <span className="text-muted-foreground">{label}</span>
      <input name={nom} className={`${inputCls} ${className}`} {...rest} />
    </label>
  );
}

// -------------------------------------------------------------- Fournisseur
export function FournisseurAddForm({ action }: { action: FormAction }) {
  const ref = useRef<HTMLFormElement>(null);
  return (
    <form
      ref={ref}
      action={async (fd) => {
        await action(fd);
        ref.current?.reset();
      }}
      className="flex flex-wrap items-end gap-2 px-4 py-3"
    >
      <Champ nom="nom" label="Nom du fournisseur" className="w-48" required />
      <Champ nom="codeEbp" label="Code EBP" className="w-28" />
      <Champ nom="contact" label="Contact" className="w-40" />
      <Champ
        nom="urlSite"
        label="Site web"
        className="w-52"
        type="url"
        placeholder="https://…"
      />
      <Champ nom="commentaires" label="Commentaire" className="w-52" />
      <Submit />
    </form>
  );
}

// --------------------------------------------------------------- Collection
export function CollectionAddForm({ action }: { action: FormAction }) {
  const ref = useRef<HTMLFormElement>(null);
  return (
    <form
      ref={ref}
      action={async (fd) => {
        await action(fd);
        ref.current?.reset();
      }}
      className="flex flex-wrap items-end gap-2 px-4 py-3"
    >
      <Champ nom="nom" label="Nom de la collection" className="w-48" required />
      <Champ nom="editeur" label="Éditeur / marque" className="w-40" />
      <Champ nom="annee" label="Année" className="w-20" />
      <Champ nom="commentaires" label="Commentaire" className="w-56" />
      <Submit />
    </form>
  );
}

// ---------------------------------------------------------------- Référence
export function RefAddForm({ action }: { action: FormAction }) {
  const ref = useRef<HTMLFormElement>(null);
  return (
    <form
      ref={ref}
      action={async (fd) => {
        await action(fd);
        ref.current?.reset();
      }}
      className="flex flex-wrap items-end gap-2 px-4 py-3"
    >
      <Champ nom="reference" label="Référence" className="w-32" required />
      <Champ nom="coloris" label="Coloris" className="w-28" />
      <Champ nom="laize" label="Laize" className="w-24" placeholder="140 cm" />
      <Champ
        nom="prixAchat"
        label="Prix achat €"
        className="w-24"
        type="number"
        step="0.01"
        min="0"
      />
      <Champ
        nom="prixVente"
        label="Prix vente €"
        className="w-24"
        type="number"
        step="0.01"
        min="0"
      />
      <Champ nom="unite" label="Unité" className="w-16" defaultValue="ml" />
      <Champ nom="codeEbp" label="Code EBP" className="w-28" />
      <Champ nom="numEchantillon" label="N° échantillon" className="w-24" />
      <label className="flex items-center gap-1.5 pb-1.5 text-xs">
        <input
          name="enMagasin"
          type="checkbox"
          defaultChecked
          className="h-4 w-4 rounded border-input"
        />
        <span className="text-muted-foreground">En magasin</span>
      </label>
      <Champ nom="commentaires" label="Commentaire" className="w-40" />
      <Submit />
    </form>
  );
}

// ---------------------------------------------- Duplication (sans confirm)
// Recrée une variante de la référence (nouveau coloris à renseigner).
export function CatalogueDuplicateButton({
  action,
  label = "Dupliquer",
  title = "Dupliquer pour un autre coloris",
}: {
  action: () => Promise<void>;
  label?: string;
  title?: string;
}) {
  const [pending, start] = useTransition();
  return (
    <button
      type="button"
      onClick={() => start(async () => { await action(); })}
      disabled={pending}
      className="text-xs text-muted-foreground hover:text-foreground disabled:opacity-40"
      title={title}
    >
      {pending ? "…" : label}
    </button>
  );
}

// ---------------------------------------------- Suppression (avec confirm)
export function CatalogueDeleteButton({
  action,
  message,
  label = "✕",
  title = "Supprimer",
}: {
  action: () => Promise<void>;
  message: string;
  label?: string;
  title?: string;
}) {
  const [pending, start] = useTransition();
  // Confirmation EN DEUX CLICS dans la page (pas de confirm() natif, qui peut
  // être bloqué en silence par le navigateur « ne plus afficher de dialogue »).
  // 1er clic : le bouton s'arme (« Confirmer ? ») ; 2e clic : suppression.
  // S'auto-désarme après 4 s si on ne confirme pas.
  const [armed, setArmed] = useState(false);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  function onClick() {
    if (!armed) {
      setArmed(true);
      timer.current = setTimeout(() => setArmed(false), 4000);
      return;
    }
    if (timer.current) clearTimeout(timer.current);
    setArmed(false);
    start(async () => {
      await action();
    });
  }
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={pending}
      className={
        armed
          ? "rounded px-1.5 text-xs font-semibold text-destructive"
          : "text-xs text-muted-foreground hover:text-destructive disabled:opacity-40"
      }
      title={message || title}
    >
      {pending ? "…" : armed ? "Confirmer ?" : label}
    </button>
  );
}
