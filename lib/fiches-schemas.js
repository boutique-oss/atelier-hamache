export function groupBySection(schema) {
  const groups = [];
  let current = null;
  for (const field of schema) {
    if (field.sectionTitle) {
      current = { title: field.sectionTitle, fields: [field] };
      groups.push(current);
    } else if (current) {
      current.fields.push(field);
    } else {
      current = { title: null, fields: [field] };
      groups.push(current);
    }
  }
  return groups;
}

export const SCHEMAS = {
  Tapisserie: [
    // ── Structure & dimensions ─────────────────────────────────────────────
    { key: 'meuble',            label: 'Type de meuble',          type: 'text',     sectionTitle: 'Structure & dimensions' },
    { key: 'epoque',            label: 'Époque / style',           type: 'text' },
    { key: 'nb_places',         label: 'Nb de places',             type: 'number' },
    { key: 'cotes_largeur',     label: 'Largeur assise',           type: 'number',   unit: 'cm' },
    { key: 'cotes_profondeur',  label: 'Profondeur assise',        type: 'number',   unit: 'cm' },
    { key: 'etat_structure',    label: 'État structure',           type: 'select',   options: ['Bon', 'Moyen', 'À consolider', 'À refaire'] },
    // ── Travaux ────────────────────────────────────────────────────────────
    { key: 'depose_necessaire', label: 'Dépose nécessaire',        type: 'select',   options: ['Non', 'Partielle', 'Complète'], sectionTitle: 'Travaux' },
    { key: 'croquis',           label: 'Croquis / schéma',         type: 'textarea', hint: 'Décris la forme ou colle une note' },
    { key: 'observations',      label: 'Observations atelier',     type: 'textarea' },
  ],

  Rideaux: [
    // ── Dimensions ────────────────────────────────────────────────────────
    { key: 'piece',         label: 'Pièce / espace',               type: 'text',   sectionTitle: 'Dimensions' },
    { key: 'nb_panneaux',   label: 'Nb de panneaux',               type: 'number' },
    { key: 'hauteur_fini',  label: 'Hauteur finie',                type: 'number', unit: 'cm' },
    { key: 'largeur_fini',  label: 'Largeur finie / panneau',      type: 'number', unit: 'cm' },
    { key: 'coeff_fonce',   label: 'Coefficient de foncé',         type: 'select', options: ['1.5', '1.8', '2', '2.5', '3'] },
    // ── Confection ────────────────────────────────────────────────────────
    { key: 'type_tete',     label: 'Type de tête',                 type: 'select', options: ['Pince simple', 'Pince triple', 'Œillets', 'Ruban fronceur', 'Accordéon', 'Passants', 'Smocks', 'Plats'], sectionTitle: 'Confection' },
    { key: 'doublure',      label: 'Doublure / entoilage',         type: 'select', options: ['Non', 'Simple', 'Thermique', 'Obscurcissante', 'Thermique + obscurcissante'] },
    // ── Pose ──────────────────────────────────────────────────────────────
    { key: 'type_pose',     label: 'Tringle / rail',               type: 'select', options: ['Tringle', 'Rail', 'Câble', 'Motorisé', 'Tringle + embrasses'], sectionTitle: 'Pose' },
    { key: 'ref_tringle',   label: 'Réf. tringle / rail',          type: 'text' },
    { key: 'observations',  label: 'Observations atelier',         type: 'textarea' },
  ],

  Stores: [
    // ── Identification ────────────────────────────────────────────────────
    { key: 'type_store',   label: 'Type de store',    type: 'select', options: ['Store bateau', 'Store enrouleur', 'Store vénitien', 'Store plissé', 'Store californien', 'Store banne'], sectionTitle: 'Identification' },
    { key: 'piece',        label: 'Pièce',             type: 'text' },
    { key: 'nb_stores',    label: 'Nb de stores',      type: 'number' },
    // ── Dimensions ────────────────────────────────────────────────────────
    { key: 'largeur',      label: 'Largeur',           type: 'number', unit: 'cm', sectionTitle: 'Dimensions' },
    { key: 'hauteur',      label: 'Hauteur',           type: 'number', unit: 'cm' },
    // ── Pose ──────────────────────────────────────────────────────────────
    { key: 'motorisation', label: 'Motorisation',      type: 'select', options: ['Non', 'Oui - filaire', 'Oui - radio'], sectionTitle: 'Pose' },
    { key: 'pose_incluse', label: 'Pose incluse',      type: 'select', options: ['Oui', 'Non'] },
    { key: 'observations', label: 'Observations atelier', type: 'textarea' },
  ],

  'Tête de lit': [
    // ── Dimensions & forme ────────────────────────────────────────────────
    { key: 'largeur',   label: 'Largeur',  type: 'number', unit: 'cm', sectionTitle: 'Dimensions & forme' },
    { key: 'hauteur',   label: 'Hauteur',  type: 'number', unit: 'cm' },
    { key: 'forme',     label: 'Forme',    type: 'select', options: ['Droite', 'Cintrée', 'Capitonnée', 'Avec oreilles', 'Arrondie', 'Asymétrique'] },
    // ── Pose ──────────────────────────────────────────────────────────────
    { key: 'fixation',     label: 'Fixation mur',          type: 'select', options: ['Pattes de fixation', 'Pieds', 'Suspendu', 'Intégré sommier'], sectionTitle: 'Pose' },
    { key: 'observations', label: 'Observations atelier',  type: 'textarea' },
  ],

  'Habillage de lit': [
    // ── Dimensions ────────────────────────────────────────────────────────
    { key: 'dimensions_lit', label: 'Dimensions lit',       type: 'text',     sectionTitle: 'Dimensions' },
    // ── Travaux ────────────────────────────────────────────────────────────
    { key: 'elements',       label: 'Éléments à réaliser',  type: 'textarea', sectionTitle: 'Travaux' },
    { key: 'ciel_de_lit',    label: 'Ciel de lit',          type: 'select',   options: ['Non', 'Plat', 'Drapé', 'Couronne', 'Baldaquin'] },
    { key: 'observations',   label: 'Observations atelier', type: 'textarea' },
  ],

  Coussins: [
    // ── Identification ────────────────────────────────────────────────────
    { key: 'nb_coussins', label: 'Nombre de coussins', type: 'number', sectionTitle: 'Identification' },
    { key: 'dimensions',  label: 'Dimensions',         type: 'text',   hint: 'Ex : 50 × 50 cm' },
    { key: 'forme',       label: 'Forme',              type: 'select', options: ['Carré', 'Rectangulaire', 'Rond', 'Cylindrique', 'Autre'] },
    // ── Confection ────────────────────────────────────────────────────────
    { key: 'fermeture',    label: 'Fermeture',             type: 'select', options: ['Couture', 'Zip invisible', 'Zip apparent', 'Boutons', 'Rabat', 'Liens'], sectionTitle: 'Confection' },
    { key: 'observations', label: 'Observations atelier',  type: 'textarea' },
  ],

  Galettes: [
    // ── Identification ────────────────────────────────────────────────────
    { key: 'nb_galettes', label: 'Nombre de galettes', type: 'number', sectionTitle: 'Identification' },
    { key: 'dimensions',  label: 'Dimensions',         type: 'text',   hint: 'Ex : ∅ 40 cm ou 45 × 45 cm' },
    { key: 'forme',       label: 'Forme',              type: 'select', options: ['Ronde', 'Carrée', 'Rectangulaire', 'Trapèze', 'Polygonale', 'Autre'] },
    // ── Confection ────────────────────────────────────────────────────────
    { key: 'fermeture',      label: 'Fermeture',        type: 'select', options: ['Couture perdue', 'Zip invisible', 'Zip apparent', 'Boutons', 'Rabat', 'Liens tissu'], sectionTitle: 'Confection' },
    { key: 'liens_attaches', label: 'Liens / attaches', type: 'select', options: ['Non', 'Oui - liens tissu', 'Oui - liens corde', 'Oui - velcro'] },
    { key: 'observations',   label: 'Observations atelier', type: 'textarea' },
  ],

  'Tenture murale': [
    // ── Dimensions ────────────────────────────────────────────────────────
    { key: 'largeur_mur', label: 'Largeur mur',    type: 'number', unit: 'cm', sectionTitle: 'Dimensions' },
    { key: 'hauteur_mur', label: 'Hauteur mur',    type: 'number', unit: 'cm' },
    { key: 'nb_les',      label: 'Nombre de lés',  type: 'number' },
    // ── Pose ──────────────────────────────────────────────────────────────
    { key: 'technique_pose', label: 'Technique de pose',    type: 'select', options: ['Agrafage', 'Baguettes bois', 'Tendu sur cadre', 'Collé', 'Mixte'], sectionTitle: 'Pose' },
    { key: 'type_mur',       label: 'Type de support mur',  type: 'select', options: ['Plâtre', 'Placo', 'Bois', 'Béton', 'Parpaing'] },
    { key: 'toile_fond',     label: 'Toile de fond',        type: 'select', options: ['Non', 'Oui - simple', 'Oui - thermique', 'Oui - acoustique'] },
    { key: 'observations',   label: 'Observations atelier', type: 'textarea' },
  ],

  'Pose seule': [
    // ── Intervention ──────────────────────────────────────────────────────
    { key: 'adresse_pose',       label: 'Adresse de pose',                  type: 'text',     sectionTitle: 'Intervention' },
    { key: 'type_pose',          label: 'Type de pose',                     type: 'text' },
    { key: 'nb_points_pose',     label: "Nb de points d'accroche",          type: 'number' },
    // ── Matériel ──────────────────────────────────────────────────────────
    { key: 'fournitures_client', label: 'Fournitures apportées par client', type: 'select', options: ['Oui - complètes', 'Oui - partielles', 'Non'], sectionTitle: 'Matériel' },
    { key: 'contraintes',        label: 'Contraintes particulières',        type: 'textarea' },
    { key: 'observations',       label: 'Observations',                     type: 'textarea' },
  ],

  Autre: [
    // ── Travaux ────────────────────────────────────────────────────────────
    { key: 'description',  label: 'Description du travail',    type: 'textarea', sectionTitle: 'Travaux' },
    { key: 'observations', label: 'Observations atelier',      type: 'textarea' },
  ],
};
