import { NextResponse } from 'next/server';
import { getDb, row2dossier } from '@/lib/db';

export async function PUT(request, { params }) {
  const id = parseInt(params.id);
  const body = await request.json();
  const db = getDb();
  
  const stmt = db.prepare(`
    UPDATE dossiers SET
      nom_dossier = ?, client_nom = ?, statut = ?, flags = ?,
      type_intervention = ?, date_ouverture = ?,
      etape_devis = ?, etape_cmde = ?, etape_atelier = ?, etape_print = ?, etape_realise = ?,
      lien_dossier_externe = ?, commentaires = ?,
      adresse = ?, telephone = ?, email = ?,
      heures_a_realiser = ?,
      date_planifiee = ?,
      updated_at = CURRENT_TIMESTAMP
    WHERE id = ?
  `);

  const e = body.etapes || {};
  stmt.run(
    body.nom_dossier, body.client_nom || body.nom_dossier, body.statut,
    JSON.stringify(body.flags || []), body.type_intervention || 'Autre',
    body.date_ouverture || null,
    e.devis ? 1 : 0, e.cmde ? 1 : 0, e.atelier ? 1 : 0, e.print ? 1 : 0, e.realise ? 1 : 0,
    body.lien || '', body.comm || '',
    body.adresse || '', body.telephone || '', body.email || '',
    parseFloat(body.heures_a_realiser) || 0,
    body.date_planifiee !== undefined ? body.date_planifiee : (db.prepare('SELECT date_planifiee FROM dossiers WHERE id=?').get(id)?.date_planifiee ?? null),
    id
  );
  
  const updated = db.prepare('SELECT * FROM dossiers WHERE id = ?').get(id);

  // Broadcast update to all connected clients
  fetch(new URL('/api/sync?action=broadcast', request.url).toString()).catch(() => {});

  return NextResponse.json(row2dossier(updated));
}

export async function DELETE(request, { params }) {
  try {
    const id = parseInt(params.id);
    const db = getDb();
    db.transaction(() => {
      db.prepare('DELETE FROM heures WHERE dossier_id = ?').run(id);
      db.prepare('DELETE FROM dossiers WHERE id = ?').run(id);
    })();

    // Broadcast update to all connected clients
    fetch(new URL('/api/sync?action=broadcast', request.url).toString()).catch(() => {});

    return NextResponse.json({ deleted: id });
  } catch(e) {
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}
