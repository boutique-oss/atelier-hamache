// Marqueur d'un congé « général » = fermeture de l'atelier qui s'applique à TOUT
// le monde (et non une demande individuelle). Réutilisé côté serveur (actions)
// ET côté client (calendrier) : ce module ne contient que des constantes, aucune
// dépendance serveur, pour être importable partout sans casser le bundle client.
//
// Stockage : réutilise la table `conges` sans nouvelle colonne —
//   conges.type      = FERMETURE_TYPE   (discriminant)
//   conges.operateur = FERMETURE_LABEL  (libellé affiché)
//   conges.statut    = "Validé"         (décision de l'entreprise, pas une demande)
export const FERMETURE_TYPE = "Fermeture atelier";
export const FERMETURE_LABEL = "Atelier (tous)";
export const estFermeture = (c: { type?: string | null }) =>
  c.type === FERMETURE_TYPE;
