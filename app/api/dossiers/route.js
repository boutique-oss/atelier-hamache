import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { row2dossier } from '@/lib/db';

export const dynamic = 'force-dynamic';

export async function GET() {
  const supabase = createClient();
  const { data, error } = await supabase
    .from('dossiers')
    .select('*')
    .order('date_ouverture', { ascending: false });
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json(data.map(row2dossier));
}

export async function POST(request) {
  const supabase = createClient();
  const body = await request.json();
  const e = body.etapes || {};

  const { data, error } = await supabase
    .from('dossiers')
    .insert({
      nom_dossier: body.nom_dossier,
      client_nom: body.client_nom || body.nom_dossier,
      statut: body.statut,
      flags: JSON.stringify(body.flags || []),
      type_intervention: body.type_intervention || 'Autre',
      date_ouverture: body.date_ouverture || null,
      etape_devis: !!e.devis,
      etape_cmde: !!e.cmde,
      etape_atelier: !!e.atelier,
      etape_print: !!e.print,
      etape_realise: !!e.realise,
      lien_dossier_externe: body.lien || '',
      commentaires: body.comm || '',
      adresse: body.adresse || '',
      telephone: body.telephone || '',
      email: body.email || '',
      heures_a_realiser: parseFloat(body.heures_a_realiser) || 0,
    })
    .select()
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json(row2dossier(data), { status: 201 });
}
