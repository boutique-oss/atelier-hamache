import PrintButton from "../../[id]/PrintButton";
import {
  chargerFichesDossier,
  FicheAtelierSheet,
  STYLES_IMPRESSION,
} from "@/components/fiche-atelier-print";
import { PiecesJointesPrint } from "@/components/pieces-jointes-print";

export const dynamic = "force-dynamic";

// Impression de TOUTES les fiches de travail d'un dossier, une par page.
export default async function FichesDossierImpressionPage({
  params,
}: {
  params: { id: string };
}) {
  const id = Number(params.id);
  const fiches = Number.isFinite(id) ? await chargerFichesDossier(id) : [];
  if (fiches.length === 0) {
    return (
      <div style={{ padding: 40, fontFamily: "sans-serif" }}>
        Aucune fiche de travail pour ce dossier.
      </div>
    );
  }
  const d = fiches[0].dossier;
  return (
    <>
      <title>{`Fiches ${d?.client_nom || d?.nom_dossier || ""}`.trim()}</title>
      <style>{STYLES_IMPRESSION}</style>
      <PrintButton className="print-btn" />
      {fiches.map((f, i) => (
        <div key={f.fiche.id}>
          <div className="feuille">
            <FicheAtelierSheet data={f} saut={i < fiches.length - 1} />
          </div>
          {/* Fiche Rideaux : sa prise de cotes jointe juste derrière. */}
          {f.pdfs.length > 0 && <PiecesJointesPrint pieces={f.pdfs} />}
        </div>
      ))}
    </>
  );
}
