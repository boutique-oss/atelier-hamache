import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';

export const dynamic = 'force-dynamic';

export async function GET(request, { params }) {
  const supabase = createClient();
  const { data, error } = await supabase
    .from('predevis').select('*').eq('id', parseInt(params.id)).single();
  if (error) return NextResponse.json({ error: 'not found' }, { status: 404 });
  return NextResponse.json(data);
}

export async function PUT(request, { params }) {
  const supabase = createClient();
  const id = parseInt(params.id);
  const body = await request.json();

  const { error } = await supabase.from('predevis').update({
    statut: body.statut || 'brouillon',
    dossier_id: body.dossier_id || null,
    client_nom: body.client_nom || '',
    client_tel: body.client_tel || '',
    client_email: body.client_email || '',
    client_adresse: body.client_adresse || '',
    description: body.description || '',
    type_intervention: body.type_intervention || 'Tapisserie',
    tapisserie_ops: body.tapisserie_ops ? JSON.stringify(body.tapisserie_ops) : null,
    urgent: !!body.urgent,
    tissus: body.tissus ? JSON.stringify(body.tissus) : null,
    fournitures: body.fournitures ? JSON.stringify(body.fournitures) : null,
    heures_estimees: parseFloat(body.heures_estimees) || 0,
    taux_horaire: parseFloat(body.taux_horaire) || 55,
    forfait_pose: parseFloat(body.forfait_pose) || 0,
    km_deplacement: parseFloat(body.km_deplacement) || 0,
    tarif_km: parseFloat(body.tarif_km) || 0.5,
    taux_tva: parseFloat(body.taux_tva) || 0.20,
    notes: body.notes || '',
    total_ht: parseFloat(body.total_ht) || 0,
    total_ttc: parseFloat(body.total_ttc) || 0,
    updated_at: new Date().toISOString(),
  }).eq('id', id);

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true });
}

export async function DELETE(request, { params }) {
  const supabase = createClient();
  const { error } = await supabase.from('predevis').delete().eq('id', parseInt(params.id));
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true });
}
