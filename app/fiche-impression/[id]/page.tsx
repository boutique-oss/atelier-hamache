import PrintButton from "./PrintButton";
import {
  chargerFiche,
  FicheAtelierSheet,
  STYLES_IMPRESSION,
} from "@/components/fiche-atelier-print";
import { PiecesJointesPrint } from "@/components/pieces-jointes-print";

export const dynamic = "force-dynamic";

// Impression d'UNE fiche de travail (noir & blanc, lisible à l'atelier).
export default async function FicheImpressionPage({
  params,
}: {
  params: { id: string };
}) {
  const id = Number(params.id);
  const data = Number.isFinite(id) ? await chargerFiche(id) : null;
  if (!data) {
    return <div style={{ padding: 40, fontFamily: "sans-serif" }}>Fiche introuvable (id={params.id})</div>;
  }
  return (
    <>
      <title>{`Fiche ${data.dossier?.client_nom || data.dossier?.nom_dossier || ""}`.trim()}</title>
      <style>{STYLES_IMPRESSION}</style>
      <PrintButton className="print-btn" />
      <div className="feuille">
        <FicheAtelierSheet data={data} />
      </div>
      {/* Fiche Rideaux : la prise de cotes jointe sort à la suite. */}
      {data.pdfs.length > 0 && <PiecesJointesPrint pieces={data.pdfs} />}
    </>
  );
}
