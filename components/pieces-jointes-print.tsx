"use client";

import { useEffect, useState } from "react";

import type { PieceJointe } from "@/lib/fiche-pieces-db";

// Prise de cotes jointe à une fiche Rideaux, affichée SOUS la fiche pour
// qu'un seul « Imprimer » sorte les deux. Un PDF est dessiné page par page
// dans le navigateur (pdf.js via unpdf, chargé seulement ici) ; une image
// scannée est affichée telle quelle. Chaque page commence une nouvelle feuille.
export function PiecesJointesPrint({ pieces }: { pieces: PieceJointe[] }) {
  const [pages, setPages] = useState<{ cle: string; src: string }[]>([]);
  const [etat, setEtat] = useState<"chargement" | "pret" | "erreur">("chargement");

  useEffect(() => {
    let annule = false;
    (async () => {
      try {
        const out: { cle: string; src: string }[] = [];
        for (const p of pieces) {
          const res = await fetch(`/api/fiche-pdf/${p.id}`);
          if (!res.ok) continue;
          const type = res.headers.get("content-type") || "";
          const octets = new Uint8Array(await res.arrayBuffer());
          if (type.startsWith("image/")) {
            out.push({ cle: `${p.id}`, src: URL.createObjectURL(new Blob([octets], { type })) });
            continue;
          }
          const { getDocumentProxy } = await import("unpdf");
          const pdf = await getDocumentProxy(octets);
          for (let n = 1; n <= pdf.numPages; n++) {
            const page = await pdf.getPage(n);
            const vue = page.getViewport({ scale: 2 }); // net à l'impression
            const canvas = document.createElement("canvas");
            canvas.width = vue.width;
            canvas.height = vue.height;
            const ctx = canvas.getContext("2d");
            if (!ctx) continue;
            await page.render({ canvasContext: ctx, viewport: vue }).promise;
            out.push({ cle: `${p.id}-${n}`, src: canvas.toDataURL("image/png") });
          }
        }
        if (!annule) {
          setPages(out);
          setEtat("pret");
        }
      } catch (e) {
        console.error("Affichage prise de cotes impossible:", e);
        if (!annule) setEtat("erreur");
      }
    })();
    return () => {
      annule = true;
    };
  }, [pieces]);

  if (etat === "chargement") {
    return (
      <p className="no-print" style={{ textAlign: "center", padding: 16, fontFamily: "Arial", fontSize: 14 }}>
        Chargement de la prise de cotes… attends qu&apos;elle apparaisse avant d&apos;imprimer.
      </p>
    );
  }
  if (etat === "erreur") {
    return (
      <p className="no-print" style={{ textAlign: "center", padding: 16, fontFamily: "Arial", fontSize: 14, color: "#b00" }}>
        La prise de cotes jointe n&apos;a pas pu être affichée. Ouvre-la depuis la fiche dossier pour
        l&apos;imprimer à part.
      </p>
    );
  }
  return (
    <>
      {pages.map((p) => (
        <div key={p.cle} className="feuille piece-jointe">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={p.src} alt="Prise de cotes" style={{ display: "block", width: "100%", height: "auto" }} />
        </div>
      ))}
    </>
  );
}
