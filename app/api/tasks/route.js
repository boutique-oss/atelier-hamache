import { NextResponse } from 'next/server';
import { sql } from '@/lib/postgres';

export const dynamic = 'force-dynamic';

export async function GET() {
  const { rows } = await sql`SELECT * FROM tasks ORDER BY created_at DESC`;
  return NextResponse.json(rows);
}

export async function POST(request) {
  const { titre, type, notes } = await request.json();
  if (!titre) return NextResponse.json({ error: 'titre requis' }, { status: 400 });
  const { rows } = await sql`
    INSERT INTO tasks (titre, type, notes) VALUES (${titre}, ${type || 'dossiers'}, ${notes || ''}) RETURNING id`;
  return NextResponse.json({ id: rows[0].id });
}

export async function PUT(request) {
  const id = new URL(request.url).searchParams.get('id');
  const body = await request.json();
  const { rows: existing } = await sql`SELECT * FROM tasks WHERE id = ${id}`;
  if (!existing.length) return NextResponse.json({ error: 'not found' }, { status: 404 });
  const t = existing[0];
  await sql`
    UPDATE tasks SET
      statut = ${body.statut ?? t.statut},
      titre  = ${body.titre ?? t.titre},
      type   = ${body.type ?? t.type},
      notes  = ${body.notes ?? t.notes}
    WHERE id = ${id}`;
  return NextResponse.json({ ok: true });
}

export async function DELETE(request) {
  const id = new URL(request.url).searchParams.get('id');
  await sql`DELETE FROM tasks WHERE id = ${id}`;
  return NextResponse.json({ ok: true });
}
