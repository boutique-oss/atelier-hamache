import { NextResponse } from 'next/server';
import Database from 'better-sqlite3';
import path from 'path';

export const dynamic = 'force-dynamic';

function getDb() {
  const db = new Database(path.join(process.cwd(), 'data', 'atelier.db'));
  db.prepare(`
    CREATE TABLE IF NOT EXISTS interventions_rideaux (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      client TEXT NOT NULL,
      telephone TEXT DEFAULT '',
      adresse TEXT DEFAULT '',
      date TEXT DEFAULT '',
      pieces_json TEXT DEFAULT '[]',
      tissu TEXT DEFAULT '',
      ref_tissu TEXT DEFAULT '',
      coloris TEXT DEFAULT '',
      metrage TEXT DEFAULT '',
      type_tete TEXT DEFAULT '',
      heures TEXT DEFAULT '',
      notes TEXT DEFAULT '',
      created_at TEXT DEFAULT (datetime('now')),
      updated_at TEXT DEFAULT (datetime('now'))
    )
  `).run();
  // Migrations colonnes optionnelles (silencieuses si déjà présentes)
  try { db.prepare("ALTER TABLE interventions_rideaux ADD COLUMN dossier_id INTEGER").run(); } catch {}
  try { db.prepare("ALTER TABLE interventions_rideaux ADD COLUMN materiaux_json TEXT DEFAULT '[]'").run(); } catch {}
  return db;
}

export async function GET(request) {
  const db = getDb();
  try {
    const { searchParams } = new URL(request.url);
    const dossierId = searchParams.get('dossier_id');

    if (dossierId) {
      // Retourne la fiche liée à ce dossier (ou null)
      const row = db.prepare(
        'SELECT * FROM interventions_rideaux WHERE dossier_id = ? ORDER BY created_at DESC LIMIT 1'
      ).get(dossierId);
      return NextResponse.json({ fiche: row || null });
    }

    const rows = db.prepare(
      'SELECT * FROM interventions_rideaux ORDER BY date DESC, created_at DESC'
    ).all();
    return NextResponse.json(rows);
  } finally {
    db.close();
  }
}

export async function POST(request) {
  const db = getDb();
  try {
    const {
      client, telephone, adresse, date, pieces_json,
      tissu, ref_tissu, coloris, metrage, type_tete, heures, notes,
      dossier_id, materiaux_json,
    } = await request.json();
    if (!client) return NextResponse.json({ error: 'client requis' }, { status: 400 });
    const r = db.prepare(`
      INSERT INTO interventions_rideaux
        (client, telephone, adresse, date, pieces_json, tissu, ref_tissu, coloris, metrage, type_tete, heures, notes, dossier_id, materiaux_json)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).run(
      client, telephone || '', adresse || '', date || '',
      pieces_json || '[]', tissu || '', ref_tissu || '',
      coloris || '', metrage || '', type_tete || '', heures || '', notes || '',
      dossier_id || null, materiaux_json || '[]',
    );
    return NextResponse.json({ id: r.lastInsertRowid });
  } finally {
    db.close();
  }
}

export async function PUT(request) {
  const db = getDb();
  try {
    const id = new URL(request.url).searchParams.get('id');
    const {
      client, telephone, adresse, date, pieces_json,
      tissu, ref_tissu, coloris, metrage, type_tete, heures, notes,
      dossier_id, materiaux_json,
    } = await request.json();
    db.prepare(`
      UPDATE interventions_rideaux
      SET client=?, telephone=?, adresse=?, date=?, pieces_json=?,
          tissu=?, ref_tissu=?, coloris=?, metrage=?, type_tete=?, heures=?, notes=?,
          dossier_id=?, materiaux_json=?,
          updated_at=datetime('now')
      WHERE id=?
    `).run(
      client, telephone || '', adresse || '', date || '',
      pieces_json || '[]', tissu || '', ref_tissu || '',
      coloris || '', metrage || '', type_tete || '', heures || '', notes || '',
      dossier_id || null, materiaux_json || '[]',
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
    db.prepare('DELETE FROM interventions_rideaux WHERE id=?').run(id);
    return NextResponse.json({ ok: true });
  } finally {
    db.close();
  }
}
