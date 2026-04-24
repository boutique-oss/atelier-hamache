import { NextResponse } from 'next/server';
import Database from 'better-sqlite3';
import path from 'path';

export const dynamic = 'force-dynamic';

function getDb() {
  return new Database(path.join(process.cwd(), 'data', 'atelier.db'));
}

// ── GET : liste + stats ──────────────────────────────────────────────────
export async function GET(request) {
  const db = getDb();
  try {
    const { searchParams } = new URL(request.url);
    const dossierId = searchParams.get('dossier_id');
    const operateur  = searchParams.get('operateur');

    // Entrées filtrées
    let q = `
      SELECT h.*, d.client_nom AS nom_client, d.nom_dossier AS ref_dossier,
             COALESCE(d.heures_a_realiser, 0) AS prevues
      FROM heures h
      LEFT JOIN dossiers d ON h.dossier_id = d.id
      WHERE 1=1
    `;
    const params = [];
    if (dossierId) { q += ' AND h.dossier_id = ?'; params.push(dossierId); }
    if (operateur)  { q += ' AND h.operateur = ?';  params.push(operateur); }
    q += ' ORDER BY h.date DESC, h.created_at DESC';
    const heures = db.prepare(q).all(...params);

    // Stats par opérateur (scope identique)
    let qs = `
      SELECT operateur,
        ROUND(SUM(heures_passees), 2) as total_heures,
        COUNT(*) as nb_saisies,
        COUNT(DISTINCT dossier_id) as nb_dossiers
      FROM heures
    `;
    const paramsS = [];
    if (dossierId) { qs += ' WHERE dossier_id = ?'; paramsS.push(dossierId); }
    qs += ' GROUP BY operateur ORDER BY total_heures DESC';
    const stats = db.prepare(qs).all(...paramsS);

    // Synthèse prévues vs réelles (si dossier précis)
    let synthese = null;
    if (dossierId) {
      synthese = db.prepare(`
        SELECT
          COALESCE(d.heures_a_realiser, 0) as prevues,
          ROUND(COALESCE(SUM(h.heures_passees), 0), 2) as reelles,
          ROUND(COALESCE(SUM(h.heures_passees), 0) - COALESCE(d.heures_a_realiser, 0), 2) as ecart
        FROM dossiers d
        LEFT JOIN heures h ON h.dossier_id = d.id
        WHERE d.id = ?
        GROUP BY d.id
      `).get(dossierId);
    }

    return NextResponse.json({ heures, stats, synthese });
  } finally {
    db.close();
  }
}

// ── POST : créer une saisie ──────────────────────────────────────────────
export async function POST(request) {
  const db = getDb();
  try {
    const { dossier_id, operateur, date, heures_passees, type_travail, description } = await request.json();
    if (!dossier_id || !operateur || !date || !heures_passees) {
      return NextResponse.json({ error: 'Champs requis : dossier_id, operateur, date, heures_passees' }, { status: 400 });
    }
    const r = db.prepare(`
      INSERT INTO heures (dossier_id, operateur, date, heures_passees, type_travail, description)
      VALUES (?, ?, ?, ?, ?, ?)
    `).run(dossier_id, operateur, date, parseFloat(heures_passees), type_travail || 'Atelier', description || '');

    // Broadcast update to all connected clients
    fetch(new URL('/api/sync?action=broadcast', request.url).toString()).catch(() => {});

    return NextResponse.json({ id: r.lastInsertRowid });
  } finally {
    db.close();
  }
}

// ── PUT : modifier une saisie ────────────────────────────────────────────
export async function PUT(request) {
  const db = getDb();
  try {
    const { id, operateur, date, heures_passees, type_travail, description } = await request.json();
    db.prepare(`
      UPDATE heures
      SET operateur=?, date=?, heures_passees=?, type_travail=?, description=?
      WHERE id=?
    `).run(operateur, date, parseFloat(heures_passees), type_travail, description, id);

    // Broadcast update to all connected clients
    fetch(new URL('/api/sync?action=broadcast', request.url).toString()).catch(() => {});

    return NextResponse.json({ ok: true });
  } finally {
    db.close();
  }
}

// ── DELETE ───────────────────────────────────────────────────────────────
export async function DELETE(request) {
  const db = getDb();
  try {
    const id = new URL(request.url).searchParams.get('id');
    db.prepare('DELETE FROM heures WHERE id=?').run(id);

    // Broadcast update to all connected clients
    fetch(new URL('/api/sync?action=broadcast', request.url).toString()).catch(() => {});

    return NextResponse.json({ ok: true });
  } finally {
    db.close();
  }
}
