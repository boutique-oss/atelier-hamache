import Database from 'better-sqlite3';
import path from 'path';
import { NextResponse } from 'next/server';

export const dynamic = 'force-dynamic';

function getDb() {
  return new Database(path.join(process.cwd(), 'data', 'atelier.db'));
}

export async function GET() {
  const db = getDb();
  try {
    const dossiersActifs = db.prepare(`SELECT COUNT(*) as n FROM dossiers WHERE statut != 'Clos'`).get().n;
    const enAtelier     = db.prepare(`SELECT COUNT(*) as n FROM dossiers WHERE statut = 'En atelier'`).get().n;
    const pretAPoser    = db.prepare(`SELECT COUNT(*) as n FROM dossiers WHERE statut = 'Prêt à poser'`).get().n;

    const commandes      = db.prepare(`SELECT COUNT(*) as n FROM commandes`).get().n;
    const cmdEnAttente   = db.prepare(`SELECT COUNT(*) as n FROM commandes WHERE (qte_livree IS NULL OR qte_livree = 0)`).get().n;

    let heuresSaisies = 0;
    try { heuresSaisies = db.prepare(`SELECT COUNT(*) as n FROM heures`).get().n; } catch {}

    let rideaux = 0;
    try {
      db.prepare(`CREATE TABLE IF NOT EXISTS interventions_rideaux (id INTEGER PRIMARY KEY)`).run();
      rideaux = db.prepare(`SELECT COUNT(*) as n FROM interventions_rideaux`).get().n;
    } catch {}

    // Dossiers "En atelier" pour la zone fiches individuelles
    const fichesEnAtelier = db.prepare(`
      SELECT id, nom_dossier, client_nom, type_intervention, heures_a_realiser
      FROM dossiers
      WHERE statut = 'En atelier'
      ORDER BY date_ouverture DESC
    `).all();

    return NextResponse.json({
      dossiers:       { total: dossiersActifs, enAtelier, pretAPoser },
      commandes:      { total: commandes, enAttente: cmdEnAttente },
      heures:         { saisies: heuresSaisies },
      rideaux:        { total: rideaux },
      fichesEnAtelier,
    });
  } finally {
    db.close();
  }
}
