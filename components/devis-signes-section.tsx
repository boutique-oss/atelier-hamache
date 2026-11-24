"use client";

import { useRef, useState, useTransition } from "react";
import { FileText, Upload, Printer, Download, Trash2 } from "lucide-react";

import { uploadDevisSigne, deleteDevisSigne } from "@/app/devis-signes/actions";
import { DevisRemplir, type ClientActuel } from "@/components/devis-remplir";

export type DevisSigneRow = {
  id: number;
  nomFichier: string;
  url: string;
  taille: number | null;
  contentType: string | null;
  createdAt: string | null;
};

function formatTaille(o: number | null): string {
  if (!o) return "";
  if (o < 1024) return `${o} o`;
  if (o < 1024 * 1024) return `${Math.round(o / 1024)} Ko`;
  return `${(o / 1024 / 1024).toFixed(1)} Mo`;
}

export function DevisSignesSection({
  dossierId,
  devis,
  actuel,
}: {
  dossierId: number;
  devis: DevisSigneRow[];
  // Infos client actuelles du dossier (pour « Remplir depuis ce devis »).
  actuel?: ClientActuel;
}) {
  const [pending, start] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const formRef = useRef<HTMLFormElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError(null);
    const fd = new FormData(e.currentTarget);
    start(async () => {
      const res = await uploadDevisSigne(dossierId, fd);
      if (res.ok) {
        formRef.current?.reset();
      } else {
        setError(res.error ?? "Échec de l'envoi.");
      }
    });
  }

  return (
    <section className="rounded-lg border">
      <h2 className="border-b bg-muted/40 px-4 py-2 text-sm font-semibold">
        Devis signés{" "}
        <span className="text-muted-foreground">({devis.length})</span>
      </h2>

      {/* Import */}
      <form
        ref={formRef}
        onSubmit={onSubmit}
        className="flex flex-wrap items-center gap-2 border-b px-4 py-3"
      >
        <input
          ref={inputRef}
          type="file"
          name="fichier"
          accept="application/pdf,image/*,.md,.markdown,.txt,text/markdown,text/plain"
          required
          className="text-sm file:mr-3 file:rounded-md file:border-0 file:bg-primary/10 file:px-3 file:py-1.5 file:text-sm file:font-medium file:text-primary hover:file:bg-primary/20"
        />
        <button
          type="submit"
          disabled={pending}
          className="inline-flex items-center gap-1.5 rounded-md bg-primary px-3 py-1.5 text-sm font-medium text-primary-foreground hover:bg-primary/90 disabled:opacity-50"
        >
          <Upload className="h-4 w-4" />
          {pending ? "Envoi…" : "Importer le devis signé"}
        </button>
        <span className="text-xs text-muted-foreground">PDF, image ou devis Markdown (.md) · 14 Mo max</span>
      </form>

      {error ? (
        <p className="border-b bg-destructive/10 px-4 py-2 text-sm text-destructive">
          {error}
        </p>
      ) : null}

      {/* Liste */}
      {devis.length === 0 ? (
        <p className="px-4 py-3 text-sm text-muted-foreground">
          Aucun devis signé importé.
        </p>
      ) : (
        <div className="divide-y">
          {devis.map((d) => (
            <div
              key={d.id}
              className="flex items-center justify-between gap-2 px-4 py-2 text-sm"
            >
              <a
                href={`/api/devis/${d.id}`}
                target="_blank"
                rel="noopener noreferrer"
                className="flex min-w-0 items-center gap-2 hover:text-primary"
                title="Ouvrir dans un nouvel onglet"
              >
                <FileText className="h-4 w-4 shrink-0 text-muted-foreground" />
                <span className="truncate">{d.nomFichier}</span>
                {d.taille ? (
                  <span className="shrink-0 text-xs text-muted-foreground">
                    {formatTaille(d.taille)}
                  </span>
                ) : null}
              </a>
              <span className="flex shrink-0 items-center gap-3">
                {/* Aussi pour un scan (image) : la fenêtre propose alors de
                    choisir le PDF EBP d'origine. */}
                {actuel && (
                  <DevisRemplir devisId={d.id} dossierId={dossierId} actuel={actuel} />
                )}
                <a
                  href={`/api/devis/${d.id}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-1 text-xs text-primary hover:underline"
                  title="Ouvrir / imprimer"
                >
                  <Printer className="h-3.5 w-3.5" />
                  Imprimer
                </a>
                <a
                  href={`/api/devis/${d.id}?download=1`}
                  className="inline-flex items-center gap-1 text-xs text-primary hover:underline"
                  title="Télécharger"
                >
                  <Download className="h-3.5 w-3.5" />
                  Télécharger
                </a>
                <DeleteButton id={d.id} dossierId={dossierId} nom={d.nomFichier} />
              </span>
            </div>
          ))}
        </div>
      )}
    </section>
  );
}

function DeleteButton({
  id,
  dossierId,
  nom,
}: {
  id: number;
  dossierId: number;
  nom: string;
}) {
  const [pending, start] = useTransition();
  return (
    <button
      type="button"
      disabled={pending}
      onClick={() => {
        if (!confirm(`Supprimer le devis signé « ${nom} » ?`)) return;
        start(() => deleteDevisSigne(id, dossierId));
      }}
      className="text-muted-foreground hover:text-destructive disabled:opacity-50"
      title="Supprimer"
    >
      <Trash2 className="h-3.5 w-3.5" />
    </button>
  );
}
