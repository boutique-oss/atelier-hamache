import { NextResponse } from 'next/server';
import Database from 'better-sqlite3';
import path from 'path';

export const dynamic = 'force-dynamic';

function getDb() {
  const db = new Database(path.join(process.cwd(), 'data', 'atelier.db'));
  db.prepare(`
    CREATE TABLE IF NOT EXISTS tasks (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      titre TEXT NOT NULL,
      type TEXT DEFAULT 'dossiers',
      statut TEXT DEFAULT 'pending',
      notes TEXT DEFAULT '',
      created_at TEXT DEFAULT (datetime('now'))
    )
  `).run();
  return db;
}

export async function GET() {
  const db = getDb();
  try {
    const rows = db.prepare('SELECT * FROM tasks ORDER BY created_at DESC').all();
    return NextResponse.json(rows);
  } finally {
    db.close();
  }
}

export async function POST(request) {
  const db = getDb();
  try {
    const { titre, type, notes } = await request.json();
    if (!titre) return NextResponse.json({ error: 'titre requis' }, { status: 400 });
    const r = db.prepare(
      'INSERT INTO tasks (titre, type, notes) VALUES (?, ?, ?)'
    ).run(titre, type || 'dossiers', notes || '');
    return NextResponse.json({ id: r.lastInsertRowid });
  } finally {
    db.close();
  }
}

export async function PUT(request) {
  const db = getDb();
  try {
    const id = new URL(request.url).searchParams.get('id');
    const body = await request.json();
    const existing = db.prepare('SELECT * FROM tasks WHERE id=?').get(id);
    if (!existing) return NextResponse.json({ error: 'not found' }, { status: 404 });
    db.prepare('UPDATE tasks SET statut=?, titre=?, type=?, notes=? WHERE id=?').run(
      body.statut ?? existing.statut,
      body.titre ?? existing.titre,
      body.type ?? existing.type,
      body.notes ?? existing.notes,
      id,
    );
    return NextResponse.json({ ok: true });
  } finally {
    db.close();
  }
}

export async function DELETE(request) {
  const db = getDb();
  try {
    const id = new URL(request.url).searchParams.get('id');
    db.prepare('DELETE FROM tasks WHERE id=?').run(id);
    return NextResponse.json({ ok: true });
  } finally {
    db.close();
  }
}
