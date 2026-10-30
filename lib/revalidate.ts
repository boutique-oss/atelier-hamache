import { revalidatePath } from "next/cache";

// Rafraîchit TOUTES les vues qui affichent des données de dossier. À appeler
// après n'importe quelle mutation touchant un dossier (statut, flags, dates,
// heures, opérateur affecté, création, suppression…). Évite qu'une page reste
// figée sur une version en cache (Router Cache) après une modif faite ailleurs.
//
// Les pages concernées et pourquoi :
//   /dossiers  — liste (statut, flags, impression, compteur commandes…)
//   /planning  — calendrier des dates + Gantt (dépend statut/heures/opérateur)
//   /rapports  — liste des dossiers Clos + estimations d'heures
export function revalidateDossierViews(id?: number) {
  revalidatePath("/dossiers");
  revalidatePath("/planning");
  revalidatePath("/rapports");
  if (id != null) revalidatePath(`/dossiers/${id}`);
}

// Rafraîchit les vues qui dépendent des opérateurs (leur capacité alimente le
// Gantt du planning, et le sélecteur d'opérateur des formulaires dossier).
export function revalidateOperateurViews() {
  // Le widget opérateurs vit désormais sur le Rapport des heures.
  revalidatePath("/rapports");
  revalidatePath("/planning");
  // Le pointage liste les opérateurs actifs et le drapeau « dirigeant ».
  revalidatePath("/pointage");
}
