"use client";

import { useRef, useState, useTransition } from "react";
import { Download, FileSpreadsheet, Upload, X } from "lucide-react";

import { Button } from "@/components/ui/button";

// Moteur d'import CSV / Excel partagé (commandes, dossiers…) : lecture du
// fichier dans le navigateur (SheetJS), correspondance colonnes → champs
// détectée puis modifiable, aperçu, envoi des lignes à une action serveur.

export type ChampImport = {
  key: string;
  label: string;
  // Intitulés de colonnes reconnus (comparés sans accents / casse / ponctuation).
  alias: string[];
  // date → AAAA-MM-JJ ; bool → oui/x/1 ; montant → « € » et espaces retirés.
  kind?: "date" | "bool" | "montant";
  // Valeur d'exemple (plus utilisée par le modèle Excel, gardée pour mémoire).
  exemple?: string;
  // Liste déroulante proposée dans le modèle Excel (évite les fautes de frappe).
  liste?: string[];
  // true = valeur hors liste refusée par Excel ; sinon simple avertissement
  // (ex : nouveau fournisseur autorisé).
  stricte?: boolean;
};
export type LigneTableur = Record<string, string | boolean>;

const norm = (s: string) =>
  s
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]/g, "");

const pad = (n: number) => String(n).padStart(2, "0");

// Cellule → texte. Les dates Excel (objets Date) sont ramenées en AAAA-MM-JJ.
function cellText(v: unknown): string {
  if (v == null) return "";
  if (v instanceof Date && !isNaN(v.getTime()))
    return `${v.getFullYear()}-${pad(v.getMonth() + 1)}-${pad(v.getDate())}`;
  return String(v).trim();
}
function toIsoDate(s: string): string {
  if (!s) return "";
  if (/^\d{4}-\d{2}-\d{2}$/.test(s)) return s;
  const m = s.match(/^(\d{1,2})[/.-](\d{1,2})[/.-](\d{2,4})$/);
  if (m) {
    const y = m[3].length === 2 ? `20${m[3]}` : m[3];
    return `${y}-${pad(+m[2])}-${pad(+m[1])}`;
  }
  return s;
}
const toBool = (s: string) =>
  ["oui", "o", "x", "1", "yes", "y", "vrai", "true", "ok"].includes(norm(s));

export function TableurImport({
  champs,
  estValide,
  onImport,
  nomModele,
  libelle,
  aide,
  listesAJour,
}: {
  champs: ChampImport[];
  // Relit en base les listes déroulantes juste avant de générer le modèle
  // (clé de champ → valeurs), pour qu'il suive l'état réel au moment du clic.
  listesAJour?: () => Promise<Partial<Record<string, string[]>>>;
  // Une ligne est-elle importable ? (sert au compteur du bouton)
  estValide: (l: LigneTableur) => boolean;
  onImport: (lignes: LigneTableur[]) => Promise<{ ok: boolean; msg: string }>;
  nomModele: string;
  // Nom de l'objet importé, au singulier (« commande », « dossier »).
  libelle: string;
  aide?: string;
}) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [nomFichier, setNomFichier] = useState("");
  const [entetes, setEntetes] = useState<string[]>([]);
  const [lignes, setLignes] = useState<string[][]>([]);
  const [mapping, setMapping] = useState<Record<string, number>>({});
  const [message, setMessage] = useState<{ ok: boolean; msg: string } | null>(null);
  const [pending, startTransition] = useTransition();

  function reinitialiser() {
    setNomFichier("");
    setEntetes([]);
    setLignes([]);
    if (inputRef.current) inputRef.current.value = "";
  }

  // Modèle Excel : une feuille « Import » (en-têtes + listes déroulantes sur
  // 500 lignes) et une feuille « Listes » masquée qui porte les valeurs.
  async function telechargerModele() {
    let fraiches: Partial<Record<string, string[]>> = {};
    if (listesAJour) {
      try {
        fraiches = await listesAJour();
      } catch (e) {
        console.error("listesAJour", e);
      }
    }
    const champsModele = champs.map((c) => (fraiches[c.key] ? { ...c, liste: fraiches[c.key] } : c));
    const ExcelJS = (await import("exceljs")).default;
    const wb = new ExcelJS.Workbook();
    const ws = wb.addWorksheet("Import", { views: [{ state: "frozen", ySplit: 1 }] });
    const wl = wb.addWorksheet("Listes", { state: "hidden" });
    // Validation sur une plage entière (supportée par exceljs, absente de ses types).
    const validations = (
      ws as unknown as {
        dataValidations: { add(plage: string, v: import("exceljs").DataValidation): void };
      }
    ).dataValidations;
    const NB = 500;
    const lettre = (n: number) => {
      let out = "";
      for (n++; n > 0; n = Math.floor((n - 1) / 26))
        out = String.fromCharCode(65 + ((n - 1) % 26)) + out;
      return out;
    };

    ws.columns = champsModele.map((c) => ({
      header: c.label.replace(/ \(.*\)$/, ""),
      key: c.key,
      width: Math.max(14, c.label.length + 4),
    }));
    const head = ws.getRow(1);
    head.font = { bold: true, color: { argb: "FFFFFFFF" } };
    head.fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FF4B3F72" } };

    let iListe = 0;
    champsModele.forEach((c, i) => {
      const col = lettre(i);
      const plage = `${col}2:${col}${NB + 1}`;
      const valeurs = c.kind === "bool" ? ["oui", "non"] : c.liste?.filter(Boolean);
      if (valeurs && valeurs.length) {
        const lc = lettre(iListe++);
        wl.getCell(`${lc}1`).value = c.label;
        valeurs.forEach((v, j) => (wl.getCell(`${lc}${j + 2}`).value = v));
        const stricte = c.kind === "bool" || !!c.stricte;
        validations.add(plage, {
          type: "list",
          allowBlank: true,
          formulae: [`Listes!$${lc}$2:$${lc}$${valeurs.length + 1}`],
          showErrorMessage: true,
          errorStyle: stricte ? "stop" : "warning",
          errorTitle: c.label,
          error: stricte
            ? "Choisis une valeur dans la liste."
            : "Valeur hors liste : vérifie l'orthographe (Oui = garder quand même).",
        });
        head.getCell(i + 1).note = stricte
          ? "Choisir dans la liste déroulante"
          : "Liste déroulante (nouvelle valeur possible)";
      } else if (c.kind === "date") {
        ws.getColumn(i + 1).numFmt = "dd/mm/yyyy";
        validations.add(plage, {
          type: "date",
          operator: "greaterThan",
          allowBlank: true,
          formulae: [new Date(2000, 0, 1)],
          showErrorMessage: true,
          errorStyle: "stop",
          errorTitle: c.label,
          error: "Saisis une date (jj/mm/aaaa).",
        });
        head.getCell(i + 1).note = "Date au format jj/mm/aaaa";
      }
    });

    const buf = await wb.xlsx.writeBuffer();
    const a = document.createElement("a");
    a.href = URL.createObjectURL(
      new Blob([buf], {
        type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      })
    );
    a.download = nomModele;
    a.click();
    URL.revokeObjectURL(a.href);
  }

  async function lireFichier(file: File) {
    setMessage(null);
    try {
      const XLSX = await import("xlsx");
      const buf = await file.arrayBuffer();
      let wb;
      if (/\.(csv|txt)$/i.test(file.name)) {
        // CSV : UTF-8 si valide, sinon Windows-1252 (export Excel / EBP).
        let txt: string;
        try {
          txt = new TextDecoder("utf-8", { fatal: true }).decode(buf);
        } catch {
          txt = new TextDecoder("windows-1252").decode(buf);
        }
        wb = XLSX.read(txt.replace(/^﻿/, ""), { type: "string", raw: true });
      } else {
        wb = XLSX.read(buf, { type: "array", cellDates: true });
      }
      const ws = wb.Sheets[wb.SheetNames[0]];
      const grille = XLSX.utils.sheet_to_json<unknown[]>(ws, {
        header: 1,
        defval: "",
        blankrows: false,
      });
      // Ligne d'en-tête = première ligne non vide.
      const iEntete = grille.findIndex((r) => r.some((c) => cellText(c)));
      if (iEntete < 0) {
        setMessage({ ok: false, msg: "Fichier vide." });
        return;
      }
      const head = grille[iEntete].map(cellText);
      const corps = grille
        .slice(iEntete + 1)
        .map((r) => head.map((_, i) => cellText(r[i])))
        .filter((r) => r.some(Boolean));

      // Correspondance automatique colonnes → champs.
      const auto: Record<string, number> = {};
      const prises = new Set<number>();
      for (const c of champs) {
        const i = head.findIndex(
          (h, idx) => !prises.has(idx) && c.alias.includes(norm(h))
        );
        auto[c.key] = i;
        if (i >= 0) prises.add(i);
      }
      setNomFichier(file.name);
      setEntetes(head);
      setLignes(corps);
      setMapping(auto);
    } catch (e) {
      console.error(e);
      setMessage({ ok: false, msg: "Impossible de lire ce fichier (CSV, XLSX ou XLS attendu)." });
    }
  }

  // Lignes prêtes à envoyer, selon la correspondance choisie.
  const construire = (): LigneTableur[] =>
    lignes.map((r) => {
      const out: LigneTableur = {};
      for (const c of champs) {
        const i = mapping[c.key] ?? -1;
        const v = i >= 0 ? r[i] ?? "" : "";
        out[c.key] =
          c.kind === "date"
            ? toIsoDate(v)
            : c.kind === "bool"
              ? toBool(v)
              : c.kind === "montant"
                ? v.replace(/[€\s]/g, "")
                : v;
      }
      return out;
    });

  const valides = lignes.length ? construire().filter(estValide).length : 0;
  const pluriel = (n: number) => `${libelle}${n > 1 ? "s" : ""}`;

  function importer() {
    const data = construire();
    startTransition(async () => {
      const res = await onImport(data);
      setMessage(res);
      if (res.ok) reinitialiser();
    });
  }

  const apercu = lignes.slice(0, 8);
  const champsMappes = champs.filter((c) => (mapping[c.key] ?? -1) >= 0);
  const reste = lignes.length - apercu.length;

  return (
    <div className="space-y-3 px-4 py-3">
      <div className="flex flex-wrap items-center gap-2">
        <input
          ref={inputRef}
          type="file"
          accept=".csv,.txt,.xlsx,.xls,.ods"
          className="hidden"
          onChange={(e) => {
            const f = e.target.files?.[0];
            if (f) lireFichier(f);
          }}
        />
        <Button type="button" size="sm" variant="outline" onClick={() => inputRef.current?.click()}>
          <Upload size={14} className="mr-1.5" />
          Choisir un fichier CSV / Excel
        </Button>
        <Button type="button" size="sm" variant="ghost" onClick={telechargerModele}>
          <Download size={14} className="mr-1.5" />
          Modèle Excel
        </Button>
        {nomFichier && (
          <span className="flex items-center gap-1.5 text-xs text-muted-foreground">
            <FileSpreadsheet size={14} />
            {nomFichier} · {lignes.length} ligne{lignes.length > 1 ? "s" : ""}
            <button
              type="button"
              onClick={reinitialiser}
              className="rounded p-0.5 hover:bg-muted"
              aria-label="Annuler l'import"
            >
              <X size={13} />
            </button>
          </span>
        )}
        {message && (
          <span
            role="status"
            className={`text-xs font-medium ${message.ok ? "text-emerald-600" : "text-destructive"}`}
          >
            {message.msg}
          </span>
        )}
      </div>

      {nomFichier && (
        <>
          <div>
            <p className="mb-1.5 text-xs text-muted-foreground">
              Correspondance des colonnes (détectée automatiquement, modifiable) :
            </p>
            <div className="grid grid-cols-2 gap-2 sm:grid-cols-3 lg:grid-cols-4">
              {champs.map((c) => (
                <label key={c.key} className="flex flex-col gap-0.5 text-xs">
                  <span className="text-muted-foreground">{c.label}</span>
                  <select
                    value={mapping[c.key] ?? -1}
                    onChange={(e) => setMapping({ ...mapping, [c.key]: Number(e.target.value) })}
                    className="rounded-md border border-input bg-background px-2 py-1 text-sm"
                  >
                    <option value={-1}>— ignorer —</option>
                    {entetes.map((h, i) => (
                      <option key={i} value={i}>
                        {h || `Colonne ${i + 1}`}
                      </option>
                    ))}
                  </select>
                </label>
              ))}
            </div>
          </div>

          {champsMappes.length > 0 && (
            <div className="overflow-x-auto rounded-md border">
              <table className="w-full text-xs">
                <thead className="bg-muted/40 text-left text-[10px] uppercase tracking-wider text-muted-foreground">
                  <tr>
                    {champsMappes.map((c) => (
                      <th key={c.key} className="px-2 py-1.5 font-medium">
                        {c.label}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {apercu.map((r, i) => (
                    <tr key={i} className="border-t">
                      {champsMappes.map((c) => (
                        <td key={c.key} className="px-2 py-1">
                          {r[mapping[c.key]] || "—"}
                        </td>
                      ))}
                    </tr>
                  ))}
                </tbody>
              </table>
              {reste > 0 && (
                <p className="border-t px-2 py-1 text-[11px] text-muted-foreground">
                  … et {reste} autre{reste > 1 ? "s" : ""} ligne{reste > 1 ? "s" : ""}
                </p>
              )}
            </div>
          )}

          <div className="flex items-center gap-3">
            <Button type="button" size="sm" disabled={pending || valides === 0} onClick={importer}>
              {pending ? "Import en cours…" : `Importer ${valides} ${pluriel(valides)}`}
            </Button>
            {aide && <span className="text-xs text-muted-foreground">{aide}</span>}
          </div>
        </>
      )}
    </div>
  );
}
