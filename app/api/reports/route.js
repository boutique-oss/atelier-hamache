import { NextResponse } from 'next/server';
import Database from 'better-sqlite3';
import path from 'path';

export const dynamic = 'force-dynamic';

const TAUX_HORAIRE = 55; // € HT / heure

function getDb() {
  return new Database(path.join(process.cwd(), 'data', 'atelier.db'));
}

// ── GET /api/reports ─────────────────────────────────────────────────────
export async function GET() {
  const db = getDb();
  try {
    // KPIs globaux
    const kpi = db.prepare(`
      SELECT
        COUNT(*)                                                                     AS total_dossiers,
        COUNT(CASE WHEN statut NOT IN ('Clos') THEN 1 END)                          AS dossiers_actifs,
        ROUND(SUM(CASE WHEN statut NOT IN ('Clos') THEN COALESCE(heures_a_realiser,0) ELSE 0 END) * ${TAUX_HORAIRE}, 0) AS ca_pipeline,
        ROUND(SUM(CASE WHEN statut = 'Clos' THEN COALESCE(heures_a_realiser,0) ELSE 0 END) * ${TAUX_HORAIRE}, 0)       AS ca_clos,
        ROUND(SUM(COALESCE(heures_a_realiser, 0)), 1)                               AS total_heures_prevues,
        COUNT(CASE WHEN flags LIKE '%Urgent%'  THEN 1 END)                          AS nb_urgent,
        COUNT(CASE WHEN flags LIKE '%SAV%'     THEN 1 END)                          AS nb_sav
      FROM dossiers
    `).get();

    // KPIs heures
    const kpiHeures = db.prepare(`
      SELECT
        ROUND(SUM(heures_passees), 1)                               AS total_heures_reelles,
        ROUND(SUM(heures_passees) * ${TAUX_HORAIRE}, 0)             AS ca_realise,
        COUNT(DISTINCT operateur)                                    AS nb_operateurs,
        COUNT(DISTINCT dossier_id)                                   AS dossiers_avec_heures
      FROM heures
    `).get();

    // Répartition par statut
    const parStatut = db.prepare(`
      SELECT statut, COUNT(*) AS nb, 0 AS total_ht,
        ROUND(SUM(COALESCE(heures_a_realiser, 0)), 1) AS heures_prevues
      FROM dossiers GROUP BY statut ORDER BY
        CASE statut
          WHEN 'Nouveau'       THEN 1
          WHEN 'Devis envoyé'  THEN 2
          WHEN 'Validé'        THEN 3
          WHEN 'En atelier'    THEN 4
          WHEN 'Prêt à poser'  THEN 5
          WHEN 'Clos'          THEN 6
          ELSE 7 END
    `).all();

    // Répartition par type
    const parType = db.prepare(`
      SELECT type_intervention, COUNT(*) AS nb, 0 AS total_ht
      FROM dossiers GROUP BY type_intervention ORDER BY nb DESC
    `).all();

    // Heures : prévues vs réelles par dossier (actifs uniquement, triés par écart)
    const heuresComparaison = db.prepare(`
      SELECT
        d.id,
        d.nom_dossier  AS ref_dossier,
        d.client_nom   AS nom_client,
        d.statut, d.type_intervention,
        COALESCE(d.heures_a_realiser, 0)                                                  AS prevues,
        ROUND(COALESCE(SUM(h.heures_passees), 0), 2)                                      AS reelles,
        ROUND(COALESCE(SUM(h.heures_passees), 0) - COALESCE(d.heures_a_realiser, 0), 2)  AS ecart,
        ROUND(COALESCE(d.heures_a_realiser, 0) * ${TAUX_HORAIRE}, 0)                      AS ca_prevu,
        ROUND(COALESCE(SUM(h.heures_passees), 0) * ${TAUX_HORAIRE}, 0)                    AS ca_reel
      FROM dossiers d
      LEFT JOIN heures h ON h.dossier_id = d.id
      WHERE d.statut NOT IN ('Clos')
      GROUP BY d.id
      HAVING prevues > 0 OR reelles > 0
      ORDER BY ABS(COALESCE(SUM(h.heures_passees), 0) - COALESCE(d.heures_a_realiser, 0)) DESC
      LIMIT 20
    `).all();

    // Heures par opérateur (global)
    const heuresParOp = db.prepare(`
      SELECT operateur,
        ROUND(SUM(heures_passees),1)         AS total,
        COUNT(*)                              AS nb_saisies,
        COUNT(DISTINCT dossier_id)            AS nb_dossiers,
        MAX(date)                             AS derniere_saisie
      FROM heures GROUP BY operateur ORDER BY total DESC
    `).all();

    // Top 10 fournisseurs
    const topFournisseurs = db.prepare(`
      SELECT fournisseur, COUNT(*) AS nb_cmd, ROUND(SUM(COALESCE(montant, 0)), 2) AS total_ht
      FROM commandes GROUP BY fournisseur ORDER BY nb_cmd DESC LIMIT 10
    `).all();

    // Dossiers ouverts par mois (basé sur date_ouverture)
    const caMensuel = db.prepare(`
      SELECT
        substr(date_ouverture, 1, 7) AS mois,
        COUNT(*)                     AS nb,
        0                            AS ca_ht
      FROM dossiers
      WHERE date_ouverture IS NOT NULL AND date_ouverture != ''
      GROUP BY substr(date_ouverture, 1, 7)
      ORDER BY mois DESC LIMIT 12
    `).all();

    return NextResponse.json({
      kpi: { ...kpi, ...kpiHeures },
      parStatut,
      parType,
      heuresComparaison,
      heuresParOp,
      topFournisseurs,
      caMensuel,
    });
  } finally {
    db.close();
  }
}
