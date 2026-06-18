import { NextResponse } from 'next/server';
import { sql } from '@/lib/postgres';

export const dynamic = 'force-dynamic';

export async function GET() {
  const [
    { rows: [{ count: dossiersActifs }] },
    { rows: [{ count: enAtelier }] },
    { rows: [{ count: pretAPoser }] },
    { rows: [{ count: commandes }] },
    { rows: [{ count: cmdEnAttente }] },
    { rows: [{ count: heuresSaisies }] },
    { rows: [{ count: rideaux }] },
    { rows: fichesEnAtelier },
  ] = await Promise.all([
    sql`SELECT COUNT(*) FROM dossiers WHERE statut != 'Clos'`,
    sql`SELECT COUNT(*) FROM dossiers WHERE statut = 'En atelier'`,
    sql`SELECT COUNT(*) FROM dossiers WHERE statut = 'Prêt à poser'`,
    sql`SELECT COUNT(*) FROM commandes`,
    sql`SELECT COUNT(*) FROM commandes WHERE qte_livree IS NULL OR qte_livree = 0`,
    sql`SELECT COUNT(*) FROM heures`,
    sql`SELECT COUNT(*) FROM interventions_rideaux`,
    sql`SELECT id, nom_dossier, client_nom, type_intervention, heures_a_realiser
        FROM dossiers WHERE statut = 'En atelier' ORDER BY date_ouverture DESC`,
  ]);

  return NextResponse.json({
    dossiers: { total: parseInt(dossiersActifs), enAtelier: parseInt(enAtelier), pretAPoser: parseInt(pretAPoser) },
    commandes: { total: parseInt(commandes), enAttente: parseInt(cmdEnAttente) },
    heures: { saisies: parseInt(heuresSaisies) },
    rideaux: { total: parseInt(rideaux) },
    fichesEnAtelier,
  });
}
