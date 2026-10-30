"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { KeyRound, Loader2, QrCode } from "lucide-react";
import { browserSupportsWebAuthn, startAuthentication, startRegistration } from "@simplewebauthn/browser";

import {
  optionsConnexionCle,
  optionsCreationCle,
  terminerConnexionCle,
  terminerCreationCle,
} from "@/app/cles-acces/actions";
import { cn } from "@/lib/utils";

// L'utilisateur a fermé la fenêtre du navigateur : pas une erreur à afficher.
const annule = (e: unknown) => (e as Error)?.name === "NotAllowedError" || (e as Error)?.name === "AbortError";

const NON_SUPPORTE = "Ce navigateur ne gère pas les clés d'accès. Utilisez Chrome, Edge ou Safari à jour.";

// Page de connexion : « Se connecter avec une clé d'accès ». Sur PC, le
// navigateur affiche un QR code à scanner avec le téléphone.
export function ConnexionCleAcces({ className }: { className?: string }) {
  const [enCours, demarrer] = useTransition();
  const [erreur, setErreur] = useState<string | null>(null);

  return (
    <div className={cn("space-y-2", className)}>
      <button
        type="button"
        disabled={enCours}
        onClick={() => {
          setErreur(null);
          if (!browserSupportsWebAuthn()) return setErreur(NON_SUPPORTE);
          demarrer(async () => {
            const o = await optionsConnexionCle();
            if (!o.ok) return setErreur(o.error);
            try {
              const reponse = await startAuthentication({ optionsJSON: o.options });
              const r = await terminerConnexionCle(reponse);
              if (!r.ok) return setErreur(r.error ?? "Connexion refusée.");
              window.location.href = "/";
            } catch (e) {
              if (!annule(e)) setErreur("La clé d'accès n'a pas abouti. Réessayez.");
            }
          });
        }}
        className="inline-flex h-10 w-full items-center justify-center gap-2 rounded-md border border-input bg-background px-4 text-sm font-medium shadow-sm transition-colors hover:bg-accent disabled:opacity-60"
      >
        {enCours ? <Loader2 size={16} aria-hidden className="animate-spin" /> : <QrCode size={16} aria-hidden />}
        Se connecter avec une clé d&apos;accès
      </button>
      {erreur && (
        <p role="alert" className="text-sm text-destructive">
          {erreur}
        </p>
      )}
    </div>
  );
}

// Page « Clés d'accès » : enregistre le téléphone (ou ce PC) comme clé.
export function CreerCleAcces() {
  const router = useRouter();
  const [enCours, demarrer] = useTransition();
  const [nom, setNom] = useState("Mon téléphone");
  const [erreur, setErreur] = useState<string | null>(null);
  const [fait, setFait] = useState(false);

  return (
    <div className="space-y-3">
      <label className="block space-y-1">
        <span className="text-sm font-medium">Nom de la clé</span>
        <input
          value={nom}
          onChange={(e) => setNom(e.target.value)}
          maxLength={60}
          className="h-10 w-full max-w-xs rounded-md border border-input bg-background px-3 text-sm"
        />
      </label>
      <button
        type="button"
        disabled={enCours}
        onClick={() => {
          setErreur(null);
          setFait(false);
          if (!browserSupportsWebAuthn()) return setErreur(NON_SUPPORTE);
          demarrer(async () => {
            const o = await optionsCreationCle();
            if (!o.ok) return setErreur(o.error);
            try {
              const reponse = await startRegistration({ optionsJSON: o.options });
              const r = await terminerCreationCle(reponse, nom);
              if (!r.ok) return setErreur(r.error ?? "Clé refusée.");
              setFait(true);
              router.refresh();
            } catch (e) {
              if ((e as Error)?.name === "InvalidStateError") setErreur("Cet appareil a déjà une clé pour votre compte.");
              else if (!annule(e)) setErreur("La création de la clé n'a pas abouti. Réessayez.");
            }
          });
        }}
        className="inline-flex h-10 items-center gap-2 rounded-md bg-primary px-4 text-sm font-medium text-primary-foreground shadow hover:bg-primary/90 disabled:opacity-60"
      >
        {enCours ? <Loader2 size={16} aria-hidden className="animate-spin" /> : <KeyRound size={16} aria-hidden />}
        Créer une clé d&apos;accès
      </button>
      {fait && <p role="status" className="text-sm">Clé enregistrée. Vous pourrez l&apos;utiliser à la prochaine connexion.</p>}
      {erreur && (
        <p role="alert" className="text-sm text-destructive">
          {erreur}
        </p>
      )}
    </div>
  );
}
