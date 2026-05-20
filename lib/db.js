// Utilitaire de transformation de ligne dossier
// Compatible SQLite (0/1) et PostgreSQL (boolean)
export function row2dossier(row) {
  if (!row) return null;
  return {
    id: row.id,
    nom_dossier: row.nom_dossier,
    client_nom: row.client_nom || row.nom_dossier,
    statut: row.statut,
    flags: typeof row.flags === 'string' ? JSON.parse(row.flags || '[]') : (row.flags || []),
    type_intervention: row.type_intervention,
    date_ouverture: row.date_ouverture,
    adresse: row.adresse || '',
    telephone: row.telephone || '',
    email: row.email || '',
    lien: row.lien_dossier_externe || '',
    comm: row.commentaires || '',
    heures_a_realiser: row.heures_a_realiser || 0,
    date_planifiee: row.date_planifiee || null,
    fiche_pdf: row.fiche_pdf || null,
    etapes: {
      devis:   !!(row.etape_devis),
      cmde:    !!(row.etape_cmde),
      atelier: !!(row.etape_atelier),
      print:   !!(row.etape_print),
      realise: !!(row.etape_realise),
    },
  };
}
