"use client";

import { useState, useTransition } from "react";

import { saveFiche } from "@/app/fiches/actions";
import { Button } from "@/components/ui/button";
import { SCHEMAS, type FicheField } from "@/lib/fiches-schemas";

const inputCls =
  "rounded-md border border-input bg-background px-2 py-1.5 text-sm focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring";
const labelCls = "text-xs font-medium text-muted-foreground";

// Étapes par défaut par type (si la fiche n'en a pas encore).
const ETAPES_DEFAUT: Record<string, { etape: string; type: string }[]> = {
  Tapisserie: ["DÉCOUVERTURE", "SANGLAGE", "GARNISSAGE", "POSE TISSU", "FINITION"].map((e) => ({ etape: e, type: "" })),
  Rideaux: ["COUPE", "COUTURE", "TÊTES", "FINITIONS", "POSE"].map((e) => ({ etape: e, type: "" })),
  Stores: ["DÉCOUPE", "MONTAGE", "ESSAI", "POSE"].map((e) => ({ etape: e, type: "" })),
  Autre: ["ÉTAPE 1", "ÉTAPE 2", "ÉTAPE 3"].map((e) => ({ etape: e, type: "" })),
};

type Ligne = { ref?: string; coloris?: string; placement?: string; metrage?: string };
type Etape = { etape: string; type: string };

export function FicheEditor({
  ficheId,
  dossierId,
  initialType,
  initialContenu,
  initialNotes,
}: {
  ficheId: number;
  dossierId: number;
  initialType: string;
  initialContenu: Record<string, any>;
  initialNotes: string;
}) {
  const [type, setType] = useState(initialType || "Autre");
  const [contenu, setContenu] = useState<Record<string, any>>(initialContenu || {});
  const [notes, setNotes] = useState(initialNotes || "");
  const [pending, startTransition] = useTransition();
  const [saved, setSaved] = useState(false);
  const [photoUrl, setPhotoUrl] = useState("");

  const champs: FicheField[] = SCHEMAS[type] || SCHEMAS["Autre"];
  const etapes: Etape[] = Array.isArray(contenu.etapes_custom)
    ? contenu.etapes_custom
    : ETAPES_DEFAUT[type] || ETAPES_DEFAUT["Autre"];
  const tissus: Ligne[] = Array.isArray(contenu.tissus_list) ? contenu.tissus_list : [];
  const fournitures: Ligne[] = Array.isArray(contenu.fournitures_list) ? contenu.fournitures_list : [];
  const photos: string[] = Array.isArray(contenu.schemas_photos) ? contenu.schemas_photos : [];

  const patch = (p: Record<string, any>) => {
    setContenu((c) => ({ ...c, ...p }));
    setSaved(false);
  };
  const setField = (key: string, v: string) => patch({ [key]: v });

  // Lignes (tissus / fournitures)
  const setLigne = (list: Ligne[], key: string, i: number, k: keyof Ligne, v: string) =>
    patch({ [key]: list.map((x, j) => (j === i ? { ...x, [k]: v } : x)) });
  const addLigne = (list: Ligne[], key: string) =>
    patch({ [key]: [...list, { ref: "", coloris: "", placement: "", metrage: "" }] });
  const delLigne = (list: Ligne[], key: string, i: number) =>
    patch({ [key]: list.filter((_, j) => j !== i) });

  // Étapes
  const setEtape = (i: number, k: keyof Etape, v: string) =>
    patch({ etapes_custom: etapes.map((e, j) => (j === i ? { ...e, [k]: v } : e)) });
  const addEtape = () => patch({ etapes_custom: [...etapes, { etape: "", type: "" }] });
  const delEtape = (i: number) => patch({ etapes_custom: etapes.filter((_, j) => j !== i) });

  // Photos (URL)
  const addPhoto = () => {
    const u = photoUrl.trim();
    if (!u) return;
    patch({ schemas_photos: [...photos, u] });
    setPhotoUrl("");
  };
  const delPhoto = (i: number) => patch({ schemas_photos: photos.filter((_, j) => j !== i) });

  const save = () => {
    // On garantit que les listes sont dans le contenu sauvegardé.
    const contenuComplet = {
      ...contenu,
      etapes_custom: etapes,
      tissus_list: tissus,
      fournitures_list: fournitures,
      schemas_photos: photos,
    };
    startTransition(async () => {
      await saveFiche(ficheId, dossierId, { type, contenu: contenuComplet, notes });
      setSaved(true);
    });
  };

  const fieldsHorsTextarea = champs.filter((f) => f.type !== "textarea");
  const textareas = champs.filter((f) => f.type === "textarea");

  return (
    <div className="space-y-6">
      {/* Type */}
      <div>
        <label className={labelCls}>Type d&apos;intervention</label>
        <select
          value={type}
          onChange={(e) => { setType(e.target.value); setSaved(false); }}
          className={`${inputCls} mt-1 block w-60`}
        >
          {Object.keys(SCHEMAS).map((t) => (
            <option key={t} value={t}>{t}</option>
          ))}
        </select>
      </div>

      {/* Heures estimées (toutes interventions) */}
      <div>
        <label className={labelCls}>Heures estimées (H)</label>
        <input
          type="number"
          step="any"
          min="0"
          value={contenu.heures_estimees ?? ""}
          onChange={(e) => setField("heures_estimees", e.target.value)}
          placeholder="ex. 12"
          className={`${inputCls} mt-1 block w-60`}
        />
        <p className="mt-1 text-[10px] text-muted-foreground">
          S&apos;affiche en gros sur la fiche imprimée (en haut à gauche).
        </p>
      </div>

      {/* Champs structurés */}
      {fieldsHorsTextarea.length > 0 && (
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          {fieldsHorsTextarea.map((f) => (
            <div key={f.key}>
              <label className={labelCls}>{f.label}{f.unit ? ` (${f.unit})` : ""}</label>
              {f.type === "select" ? (
                <select value={contenu[f.key] || ""} onChange={(e) => setField(f.key, e.target.value)} className={`${inputCls} mt-1 block w-full`}>
                  <option value="">— Choisir —</option>
                  {(f.options || []).map((o) => <option key={o} value={o}>{o}</option>)}
                </select>
              ) : (
                <>
                  <input
                    type={f.type === "number" ? "number" : "text"}
                    step="any"
                    list={f.options && f.type !== "number" ? `dl-${f.key}` : undefined}
                    value={contenu[f.key] || ""}
                    onChange={(e) => setField(f.key, e.target.value)}
                    className={`${inputCls} mt-1 block w-full`}
                  />
                  {f.options && f.type !== "number" && (
                    <datalist id={`dl-${f.key}`}>
                      {f.options.map((o) => (
                        <option key={o} value={o} />
                      ))}
                    </datalist>
                  )}
                </>
              )}
            </div>
          ))}
        </div>
      )}

      {/* Tissus */}
      <Bloc titre="Tissus">
        {tissus.map((t, i) => (
          <LigneEdit key={i} l={t} onChange={(k, v) => setLigne(tissus, "tissus_list", i, k, v)} onDel={() => delLigne(tissus, "tissus_list", i)} />
        ))}
        <BtnAdd onClick={() => addLigne(tissus, "tissus_list")}>+ Ajouter un tissu</BtnAdd>
      </Bloc>

      {/* Fournitures */}
      <Bloc titre="Fournitures">
        {fournitures.map((t, i) => (
          <LigneEdit key={i} l={t} onChange={(k, v) => setLigne(fournitures, "fournitures_list", i, k, v)} onDel={() => delLigne(fournitures, "fournitures_list", i)} />
        ))}
        <BtnAdd onClick={() => addLigne(fournitures, "fournitures_list")}>+ Ajouter une fourniture</BtnAdd>
      </Bloc>

      {/* Étapes */}
      <Bloc titre="Étapes atelier">
        {etapes.map((e, i) => (
          <div key={i} className="mb-1.5 flex items-center gap-2">
            <input value={e.etape} onChange={(ev) => setEtape(i, "etape", ev.target.value)} placeholder="ÉTAPE" className={`${inputCls} flex-[2] uppercase`} />
            <input value={e.type} onChange={(ev) => setEtape(i, "type", ev.target.value)} placeholder="Type / tissu" className={`${inputCls} flex-1`} />
            <button type="button" onClick={() => delEtape(i)} aria-label={`Retirer l'étape ${i + 1}`} title="Retirer l'étape" className="flex h-7 w-7 shrink-0 items-center justify-center rounded-md text-xs text-muted-foreground hover:text-destructive [@media(pointer:coarse)]:h-11 [@media(pointer:coarse)]:w-11">✕</button>
          </div>
        ))}
        <BtnAdd onClick={addEtape}>+ Ajouter une étape</BtnAdd>
      </Bloc>

      {/* Schémas / photos (URL) */}
      <Bloc titre="Schémas / photos (URL)">
        {photos.length > 0 && (
          <div className="mb-3 flex flex-wrap gap-3">
            {photos.map((url, i) => (
              <div key={i} className="relative">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={url} alt={`Schéma ${i + 1}`} className="h-[90px] w-[120px] border object-cover" />
                <button type="button" onClick={() => delPhoto(i)} aria-label={`Retirer le schéma ${i + 1}`} title="Retirer le schéma" className="absolute right-0.5 top-0.5 h-6 w-6 bg-black text-xs text-white [@media(pointer:coarse)]:h-9 [@media(pointer:coarse)]:w-9">×</button>
              </div>
            ))}
          </div>
        )}
        <div className="flex gap-2">
          <input
            type="url"
            value={photoUrl}
            onChange={(e) => setPhotoUrl(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && (e.preventDefault(), addPhoto())}
            placeholder="Coller une URL d'image…"
            className={`${inputCls} flex-1`}
          />
          <Button type="button" size="sm" variant="outline" onClick={addPhoto} disabled={!photoUrl.trim()}>
            Ajouter
          </Button>
        </div>
        <p className="mt-1 text-[10px] text-muted-foreground">URL d&apos;une image hébergée (Vercel Blob, Drive, convertisseur image→URL…).</p>
      </Bloc>

      {/* Textareas + notes */}
      {textareas.map((f) => (
        <div key={f.key}>
          <label className={labelCls}>{f.label}</label>
          <textarea value={contenu[f.key] || ""} onChange={(e) => setField(f.key, e.target.value)} rows={3} className={`${inputCls} mt-1 block w-full`} />
        </div>
      ))}
      <div>
        <label className={labelCls}>Notes libres</label>
        <textarea value={notes} onChange={(e) => { setNotes(e.target.value); setSaved(false); }} rows={3} className={`${inputCls} mt-1 block w-full`} />
      </div>

      {/* Actions */}
      <div className="flex items-center gap-3">
        <Button onClick={save} disabled={pending}>
          {pending ? "Enregistrement…" : saved ? "✓ Enregistré" : "Enregistrer"}
        </Button>
        <a href={`/fiche-impression/${ficheId}`} target="_blank" rel="noopener noreferrer" className="text-sm text-primary hover:underline">
          Aperçu / impression A4 ↗
        </a>
      </div>
    </div>
  );
}

function Bloc({ titre, children }: { titre: string; children: React.ReactNode }) {
  return (
    <fieldset className="rounded-lg border p-3">
      <legend className="px-1 text-xs font-semibold text-muted-foreground">{titre}</legend>
      {children}
    </fieldset>
  );
}

function BtnAdd({ onClick, children }: { onClick: () => void; children: React.ReactNode }) {
  return (
    <button type="button" onClick={onClick} className="mt-1 rounded border border-dashed px-3 py-1.5 text-xs text-muted-foreground hover:bg-accent">
      {children}
    </button>
  );
}

function LigneEdit({
  l,
  onChange,
  onDel,
}: {
  l: Ligne;
  onChange: (k: keyof Ligne, v: string) => void;
  onDel: () => void;
}) {
  const cls = "rounded-md border border-input bg-background px-2 py-1.5 text-sm";
  return (
    <div className="mb-2 grid grid-cols-[2fr_1fr_1fr_70px_20px] items-center gap-2">
      <input value={l.ref || ""} onChange={(e) => onChange("ref", e.target.value)} placeholder="Référence" className={cls} />
      <input value={l.coloris || ""} onChange={(e) => onChange("coloris", e.target.value)} placeholder="Coloris" className={cls} />
      <input value={l.placement || ""} onChange={(e) => onChange("placement", e.target.value)} placeholder="Placement" className={cls} />
      <input value={l.metrage || ""} onChange={(e) => onChange("metrage", e.target.value)} placeholder="Métr." className={cls} />
      <button type="button" onClick={onDel} aria-label="Retirer cette ligne de tissu" title="Retirer la ligne" className="text-xs text-muted-foreground hover:text-destructive">✕</button>
    </div>
  );
}
