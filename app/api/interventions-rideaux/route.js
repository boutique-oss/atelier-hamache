import { NextResponse } from 'next/server';
import { sql } from '@/lib/postgres';

export const dynamic = 'force-dynamic';

export async function GET(request) {
  const { searchParams } = new URL(request.url);
  const dossierId = searchParams.get('dossier_id');

  if (dossierId) {
    const { rows } = await sql`
      SELECT * FROM interventions_rideaux WHERE dossier_id = ${dossierId}
      ORDER BY created_at DESC LIMIT 1`;
    return NextResponse.json({ fiche: rows[0] || null });
  }

  const { rows } = await sql`
    SELECT * FROM interventions_rideaux ORDER BY date DESC, created_at DESC`;
  return NextResponse.json(rows);
}

export async function POST(request) {
  const body = await request.json();
  if (!body.client) return NextResponse.json({ error: 'client requis' }, { status: 400 });
  const { rows } = await sql`
    INSERT INTO interventions_rideaux
      (client, telephone, adresse, date, pieces_json, tissu, ref_tissu, coloris, metrage, type_tete, heures, notes, dossier_id, materiaux_json)
    VALUES (
      ${body.client}, ${body.telephone || ''}, ${body.adresse || ''}, ${body.date || ''},
      ${body.pieces_json || '[]'}, ${body.tissu || ''}, ${body.ref_tissu || ''},
      ${body.coloris || ''}, ${body.metrage || ''}, ${body.type_tete || ''},
      ${body.heures || ''}, ${body.notes || ''}, ${body.dossier_id || null}, ${body.materiaux_json || '[]'}
    ) RETURNING id`;
  return NextResponse.json({ id: rows[0].id });
}

export async function PUT(request) {
  const id = new URL(request.url).searchParams.get('id');
  const body = await request.json();
  await sql`
    UPDATE interventions_rideaux SET
      client         = ${body.client},
      telephone      = ${body.telephone || ''},
      adresse        = ${body.adresse || ''},
      date           = ${body.date || ''},
      pieces_json    = ${body.pieces_json || '[]'},
      tissu          = ${body.tissu || ''},
      ref_tissu      = ${body.ref_tissu || ''},
      coloris        = ${body.coloris || ''},
      metrage        = ${body.metrage || ''},
      type_tete      = ${body.type_tete || ''},
      heures         = ${body.heures || ''},
      notes          = ${body.notes || ''},
      dossier_id     = ${body.dossier_id || null},
      materiaux_json = ${body.materiaux_json || '[]'},
      updated_at     = NOW()
    WHERE id = ${id}`;
  return NextResponse.json({ ok: true });
}

export async function DELETE(request) {
  const id = new URL(request.url).searchParams.get('id');
  await sql`DELETE FROM interventions_rideaux WHERE id = ${id}`;
  return NextResponse.json({ ok: true });
}
