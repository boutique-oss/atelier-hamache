"use client";

import { FileText, Upload } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";

import {
  creerDossierDepuisDevis,
  lireDevisFichier,
  lireDevisMarkdownAction,
} from "@/app/devis-signes/actions";
import { DevisFormulaire } from "@/components/devis-remplir";
import { Button } from "@/components/ui/button";
import type { DevisLu } from "@/lib/devis-pdf";

// « Créer un dossier depuis un devis » (page Nouveau dossier) : dépose le
// PDF EBP du devis (ou un devis Markdown, ou colle son texte), vérifie ce
// qui a été lu — client, lignes, fiches atelier — puis crée le dossier d'un
// coup. Rien n'est écrit avant « Créer le dossier ».

const VIDE = { clientNom: "", adresse: "", telephone: "", email: "", dateDevis: "" };

export function DevisMarkdownImport() {
  const router = useRouter();
  const [devis, setDevis] = useState<DevisLu | null>(null);
  const [nomFichier, setNomFichier] = useState("");
  const [texte, setTexte] = useState("");
  const [coller, setColler] = useState(false);
  const [erreur, setErreur] = useState("");
  const [lecture, startLecture] = useTransition();

  function lire(fd: FormData, nom: string, pdf = false) {
    setErreur("");
    setDevis(null);
    startLecture(async () => {
      const res = await (pdf ? lireDevisFichier(fd) : lireDevisMarkdownAction(fd));
      if (res.ok) {
        setDevis(res.devis);
        setNomFichier(nom);
      } else setErreur(res.error);
    });
  }

  function lireFichier(f: File) {
    const fd = new FormData();
    fd.set("fichier", f);
    // PDF (export EBP) ou Markdown : la même action serveur sait lire les deux.
    lire(fd, f.name, true);
  }

  function lireTexte() {
    const fd = new FormData();
    fd.set("texte", texte);
    lire(fd, "texte collé");
  }

  if (devis) {
    const nomInitial =
      devis.client.nom ||
      (devis.ouvrages.find((o) => o.probable)?.realisation ?? "") ||
      nomFichier.replace(/\.(pdf|md|markdown|txt)$/i, "");
    return (
      <section id="devis" className="rounded-xl border">
        <div className="flex flex-wrap items-center justify-between gap-2 border-b bg-muted/40 px-4 py-2.5">
          <h2 className="text-sm font-semibold">
            Devis lu{devis.numero ? ` — ${devis.numero}` : ""}
            <span className="ml-2 font-normal text-muted-foreground">{nomFichier}</span>
          </h2>
          <button
            type="button"
            onClick={() => setDevis(null)}
            className="text-xs text-primary hover:underline"
          >
            Lire un autre devis
          </button>
        </div>
        <DevisFormulaire
          devis={devis}
          actuel={VIDE}
          idKey="md"
          mode="creer"
          libelleBouton="Créer le dossier"
          nomDossierInitial={nomInitial}
          onAnnuler={() => setDevis(null)}
          onEnvoyer={async (v, nomDossier) => {
            const res = await creerDossierDepuisDevis(nomDossier, v);
            if (!res.ok) return res;
            router.push(`/dossiers/${res.id}`);
            return { ok: true };
          }}
        />
      </section>
    );
  }

  return (
    <section id="devis" className="rounded-xl border">
      <div className="flex items-center gap-2 border-b bg-muted/40 px-4 py-2.5">
        <FileText size={16} className="text-primary" />
        <h2 className="text-sm font-semibold">Créer depuis un devis (PDF EBP)</h2>
        <span className="text-xs text-muted-foreground">
          Client, lignes du devis et fiches atelier pré-remplis, à vérifier avant création.
        </span>
      </div>
      <div className="space-y-3 px-4 py-4 text-sm">
        <div className="flex flex-wrap items-center gap-3">
          <label className="inline-flex cursor-pointer items-center gap-1.5 rounded-md bg-primary px-3 py-1.5 font-medium text-primary-foreground hover:bg-primary/90">
            <Upload size={15} />
            Choisir le PDF du devis
            <input
              type="file"
              accept="application/pdf,.pdf,.md,.markdown,.txt,text/markdown,text/plain"
              className="hidden"
              onChange={(e) => {
                const f = e.target.files?.[0];
                if (f) lireFichier(f);
                e.target.value = "";
              }}
            />
          </label>
          <button
            type="button"
            onClick={() => setColler((c) => !c)}
            className="text-xs text-primary hover:underline"
          >
            {coller ? "Masquer la zone de texte" : "…ou coller le texte du devis"}
          </button>
          {lecture && <span className="text-xs text-muted-foreground">Lecture…</span>}
        </div>
        {coller && (
          <div className="space-y-2">
            <textarea
              value={texte}
              onChange={(e) => setTexte(e.target.value)}
              rows={8}
              placeholder={"Client : Mme Dupont\nDevis n° : DE2026-041\n\n| Désignation | Qté | Unité | P.U. HT | Montant HT |\n|---|---|---|---|---|\n| Fauteuil Voltaire — réfection | 2 | U | 450,00 | 900,00 |"}
              className="w-full rounded border border-input bg-background px-2 py-1.5 font-mono text-xs"
            />
            <Button type="button" size="sm" onClick={lireTexte} disabled={lecture || !texte.trim()}>
              Lire ce texte
            </Button>
          </div>
        )}
        {erreur && (
          <p role="alert" className="text-xs text-destructive">
            {erreur}
          </p>
        )}
        <p className="text-xs text-muted-foreground">
          Le PDF exporté depuis EBP (avant signature, avec du texte, pas un scan). Un devis en
          Markdown (.md) ou son texte collé sont lus aussi. Le fichier est seulement lu, pas
          enregistré : importe-le ensuite dans « Devis signés » du dossier si besoin.
        </p>
      </div>
    </section>
  );
}
