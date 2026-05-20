import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';

export const dynamic = 'force-dynamic';

export async function GET() {
  const supabase = createClient();

  const [
    { count: dossiersActifs },
    { count: enAtelier },
    { count: pretAPoser },
    { count: commandes },
    { count: cmdEnAttente },
    { count: heuresSaisies },
    { count: rideaux },
    { data: fichesEnAtelier },
  ] = await Promise.all([
    supabase.from('dossiers').select('*', { count: 'exact', head: true }).neq('statut', 'Clos'),
    supabase.from('dossiers').select('*', { count: 'exact', head: true }).eq('statut', 'En atelier'),
    supabase.from('dossiers').select('*', { count: 'exact', head: true }).eq('statut', 'Prêt à poser'),
    supabase.from('commandes').select('*', { count: 'exact', head: true }),
    supabase.from('commandes').select('*', { count: 'exact', head: true }).or('qte_livree.is.null,qte_livree.eq.0'),
    supabase.from('heures').select('*', { count: 'exact', head: true }),
    supabase.from('interventions_rideaux').select('*', { count: 'exact', head: true }),
    supabase.from('dossiers')
      .select('id, nom_dossier, client_nom, type_intervention, heures_a_realiser')
      .eq('statut', 'En atelier')
      .order('date_ouverture', { ascending: false }),
  ]);

  return NextResponse.json({
    dossiers: { total: dossiersActifs || 0, enAtelier: enAtelier || 0, pretAPoser: pretAPoser || 0 },
    commandes: { total: commandes || 0, enAttente: cmdEnAttente || 0 },
    heures: { saisies: heuresSaisies || 0 },
    rideaux: { total: rideaux || 0 },
    fichesEnAtelier: fichesEnAtelier || [],
  });
}
