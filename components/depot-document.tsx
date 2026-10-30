"use client";

import { useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { Upload } from "lucide-react";
import { upload } from "@vercel/blob/client";

import { enregistrerDocument, type DocumentDepose } from "@/app/(main)/documents/actions";
import type { CategorieDocument, OrigineDocument } from "@/lib/documents-db";
import {
  cheminDocument,
  DOCUMENT_ACCEPT,
  DOCUMENT_SEUIL_MULTIPART,
  DOCUMENT_TAILLE_MAX,
  formatTaille,
  typeDocument,
} from "@/lib/documents-fichiers";

export type CibleDocument = {
  dossierId: number | null;
  categorie: CategorieDocument;
  origine?: OrigineDocument;
  docDossierId?: number | null;
  commandeId?: number | null;
};

// Dépose UN fichier : envoi direct navigateur → Blob privé (jeton délivré par
// /api/documents/upload), puis enregistrement de la ligne `documents`.
// Réutilisable hors composant (page scan téléphone, export PDF…).
export async function deposerDocument(
  file: File,
  cible: CibleDocument,
  onProgress?: (pourcentage: number) => void
): Promise<{ ok: true; document: DocumentDepose } | { ok: false; error: string }> {
  const contentType = typeDocument(file.name, file.type);
  if (!contentType) {
    return { ok: false, error: `« ${file.name} » : format non accepté (PDF, JPG, PNG ou HEIC).` };
  }
  if (file.size === 0) return { ok: false, error: `« ${file.name} » est vide.` };
  if (file.size > DOCUMENT_TAILLE_MAX) {
    return {
      ok: false,
      error: `« ${file.name} » est trop volumineux (${formatTaille(file.size)}). Maximum ${formatTaille(DOCUMENT_TAILLE_MAX)}.`,
    };
  }

  const pathname = cheminDocument(cible.dossierId, cible.categorie, file.name);
  try {
    await upload(pathname, file, {
      access: "private",
      handleUploadUrl: "/api/documents/upload",
      clientPayload: JSON.stringify({ dossierId: cible.dossierId, categorie: cible.categorie }),
      contentType,
      multipart: file.size > DOCUMENT_SEUIL_MULTIPART,
      onUploadProgress: onProgress ? (p) => onProgress(Math.round(p.percentage)) : undefined,
    });
  } catch (e) {
    console.error("Envoi document échoué:", (e as Error).message);
    return { ok: false, error: `« ${file.name} » : l'envoi a échoué. Vérifiez la connexion et réessayez.` };
  }

  const res = await enregistrerDocument({
    pathname,
    nom: file.name,
    dossierId: cible.dossierId,
    categorie: cible.categorie,
    origine: cible.origine,
    docDossierId: cible.docDossierId ?? null,
    commandeId: cible.commandeId ?? null,
  });
  return res.ok ? res : { ok: false, error: `« ${file.name} » : ${res.error}` };
}

// Zone de dépôt minimale (un ou plusieurs fichiers, envoyés l'un après
// l'autre). L'interface complète du module viendra avec la page Documents.
export function DepotDocument({
  libelle = "Déposer un fichier",
  onDepose,
  ...cible
}: CibleDocument & {
  libelle?: string;
  onDepose?: (doc: DocumentDepose) => void;
}) {
  const router = useRouter();
  const inputRef = useRef<HTMLInputElement>(null);
  const [etat, setEtat] = useState<string | null>(null);
  const [erreurs, setErreurs] = useState<string[]>([]);
  const enCours = etat !== null;

  async function envoyer(fichiers: File[]) {
    if (!fichiers.length) return;
    setErreurs([]);
    const ko: string[] = [];
    let deposes = 0;
    for (const [i, f] of fichiers.entries()) {
      const rang = fichiers.length > 1 ? ` (${i + 1}/${fichiers.length})` : "";
      setEtat(`Envoi${rang}…`);
      const res = await deposerDocument(f, cible, (pct) => setEtat(`Envoi${rang} ${pct} %`));
      if (res.ok) {
        deposes++;
        onDepose?.(res.document);
      } else {
        ko.push(res.error);
      }
    }
    setEtat(null);
    setErreurs(ko);
    if (inputRef.current) inputRef.current.value = "";
    if (deposes) router.refresh();
  }

  return (
    <div className="space-y-2">
      <label
        className={`inline-flex cursor-pointer items-center gap-1.5 rounded-md bg-primary px-3 py-1.5 text-sm font-medium text-primary-foreground hover:bg-primary/90 [@media(pointer:coarse)]:py-2.5 ${
          enCours ? "pointer-events-none opacity-50" : ""
        }`}
      >
        <Upload className="h-4 w-4" aria-hidden />
        <span aria-live="polite">{etat ?? libelle}</span>
        <input
          ref={inputRef}
          type="file"
          multiple
          accept={DOCUMENT_ACCEPT}
          disabled={enCours}
          className="sr-only"
          onChange={(e) => envoyer(Array.from(e.currentTarget.files ?? []))}
        />
      </label>
      <p className="text-xs text-muted-foreground">
        PDF, JPG, PNG ou HEIC · {formatTaille(DOCUMENT_TAILLE_MAX)} max par fichier
      </p>
      {erreurs.length ? (
        <ul role="alert" className="rounded-md bg-destructive/10 px-3 py-2 text-sm text-destructive">
          {erreurs.map((m, i) => (
            <li key={i}>{m}</li>
          ))}
        </ul>
      ) : null}
    </div>
  );
}
