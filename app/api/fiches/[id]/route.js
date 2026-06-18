import { NextResponse } from 'next/server';
import { sql } from '@/lib/postgres';

export const dynamic = 'force-dynamic';

export async function GET(request, { params }) {
  const { rows } = await sql`SELECT * FROM fiches_atelier WHERE id = ${params.id}`;
  if (!rows.length) return NextResponse.json({ error: 'not found' }, { status: 404 });
  return NextResponse.json(rows[0]);
}

export async function PUT(request, { params }) {
  const { type_intervention, contenu_json, notes_libres } = await request.json();
  await sql`
    UPDATE fiches_atelier SET
      type_intervention = ${type_intervention},
      contenu_json      = ${JSON.stringify(contenu_json || {})},
      notes_libres      = ${notes_libres || ''},
      updated_at        = NOW()
    WHERE id = ${params.id}`;
  return NextResponse.json({ ok: true });
}

export async function DELETE(request, { params }) {
  await sql`DELETE FROM fiches_atelier WHERE id = ${params.id}`;
  return NextResponse.json({ ok: true });
}
