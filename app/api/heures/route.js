import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';

export const dynamic = 'force-dynamic';

export async function GET(request) {
  const supabase = createClient();
  const { searchParams } = new URL(request.url);
  const dossierId = searchParams.get('dossier_id');
  const operateur = searchParams.get('operateur');

  let query = supabase
    .from('heures')
    .select('*, dossiers(client_nom, nom_dossier, heures_a_realiser, statut)')
    .order('date', { ascending: false })
    .order('created_at', { ascending: false });

  if (dossierId) query = query.eq('dossier_id', dossierId);
  if (operateur) query = query.eq('operateur', operateur);

  const { data: heuresRaw, error } = await query;
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  const heures = heuresRaw.map(h => ({
    ...h,
    nom_client: h.dossiers?.client_nom,
    ref_dossier: h.dossiers?.nom_dossier,
    prevues: h.dossiers?.heures_a_realiser || 0,
    statut: h.dossiers?.statut,
    dossiers: undefined,
  }));

  // Stats par opérateur
  const statsMap = {};
  (dossierId ? heures : heures).forEach(h => {
    const op = h.operateur;
    if (!statsMap[op]) statsMap[op] = { operateur: op, total_heures: 0, nb_saisies: 0, nb_dossiers: new Set() };
    statsMap[op].total_heures += h.heures_passees || 0;
    statsMap[op].nb_saisies++;
    if (h.dossier_id) statsMap[op].nb_dossiers.add(h.dossier_id);
  });
  const stats = Object.values(statsMap).map(s => ({
    operateur: s.operateur,
    total_heures: Math.round(s.total_heures * 100) / 100,
    nb_saisies: s.nb_saisies,
    nb_dossiers: s.nb_dossiers.size,
  })).sort((a, b) => b.total_heures - a.total_heures);

  // Synthèse prévues vs réelles si dossier précis
  let synthese = null;
  if (dossierId) {
    const { data: dossier } = await supabase
      .from('dossiers').select('heures_a_realiser').eq('id', dossierId).single();
    const prevues = dossier?.heures_a_realiser || 0;
    const reelles = Math.round(heures.reduce((s, h) => s + (h.heures_passees || 0), 0) * 100) / 100;
    synthese = { prevues, reelles, ecart: Math.round((reelles - prevues) * 100) / 100 };
  }

  return NextResponse.json({ heures, stats, synthese });
}

export async function POST(request) {
  const supabase = createClient();
  const { dossier_id, operateur, date, heures_passees, type_travail, description } = await request.json();
  if (!dossier_id || !operateur || !date || !heures_passees) {
    return NextResponse.json({ error: 'Champs requis : dossier_id, operateur, date, heures_passees' }, { status: 400 });
  }

  const { data, error } = await supabase.from('heures').insert({
    dossier_id, operateur, date,
    heures_passees: parseFloat(heures_passees),
    type_travail: type_travail || 'Atelier',
    description: description || '',
  }).select().single();
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ id: data.id });
}

export async function PUT(request) {
  const supabase = createClient();
  const { id, operateur, date, heures_passees, type_travail, description } = await request.json();

  const { error } = await supabase.from('heures').update({
    operateur, date,
    heures_passees: parseFloat(heures_passees),
    type_travail, description,
  }).eq('id', id);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true });
}

export async function DELETE(request) {
  const supabase = createClient();
  const id = new URL(request.url).searchParams.get('id');
  const { error } = await supabase.from('heures').delete().eq('id', id);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true });
}
