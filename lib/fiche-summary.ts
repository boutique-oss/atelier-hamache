// Construit un résumé compact d'une fiche atelier (pour l'aperçu au clic droit
// depuis la saisie d'heures). Réutilise SCHEMAS pour les libellés.
import { SCHEMAS } from "@/lib/fiches-schemas";

export type FicheSummary = {
  ficheId: number;
  type: string;
  heuresEstimees: string;
  lignes: { label: string; value: string }[];
  tissu: string | null;
  etapes: string | null;
  notes: string;
};

type FicheRow = {
  id: number;
  type_intervention: string;
  contenu_json: unknown;
  notes_libres?: string | null;
};

export function buildFicheSummary(fiche: FicheRow): FicheSummary {
  const contenu: Record<string, any> =
    typeof fiche.contenu_json === "string"
      ? JSON.parse(fiche.contenu_json || "{}")
      : ((fiche.contenu_json as Record<string, any>) || {});

  const type = fiche.type_intervention || "Autre";
  const schema = SCHEMAS[type] || SCHEMAS["Autre"];

  // Champs structurés renseignés (hors textarea), 6 max pour rester compact.
  const lignes = schema
    .filter((f) => f.type !== "textarea")
    .map((f) => ({ label: f.label, value: contenu[f.key] }))
    .filter(
      (x) => x.value !== undefined && x.value !== null && String(x.value).trim() !== ""
    )
    .map((x) => ({ label: x.label, value: String(x.value) }))
    .slice(0, 6);

  // Premier tissu (liste ou champ simple).
  const tissus = Array.isArray(contenu.tissus_list) ? contenu.tissus_list : [];
  const tissu =
    tissus.length > 0
      ? [tissus[0].ref, tissus[0].coloris, tissus[0].metrage ? `${tissus[0].metrage}m` : ""]
          .filter(Boolean)
          .join(" · ")
      : contenu.tissu_ref || null;

  const etapesArr = Array.isArray(contenu.etapes_custom)
    ? contenu.etapes_custom.map((e: any) => e.etape).filter(Boolean)
    : [];
  const etapes = etapesArr.length > 0 ? etapesArr.join(" · ") : null;

  const heuresEstimees = contenu.heures_estimees ? `${contenu.heures_estimees} h` : "";

  return {
    ficheId: fiche.id,
    type,
    heuresEstimees,
    lignes,
    tissu,
    etapes,
    notes: fiche.notes_libres || "",
  };
}
