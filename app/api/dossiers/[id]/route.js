import { NextResponse } from 'next/server';
import { getDb, row2dossier } from '@/lib/db';

export async function PUT(request, { params }) {
  const id = parseInt(params.id);
  const body = await request.json();
  const db = getDb();

  // Merge avec l'existant pour les mises à jour partielles (ex: kanban → date_planifiee seule)
  const existing = db.prepare('SELECT * FROM dossiers WHERE id = ?').get(id);
  if (!existing) return NextResponse.json({ error: 'not found' }, { status: 404 });

  const merged = { ...existing, ...body };
  const e = merged.etapes || {};

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

  stmt.run(
    merged.nom_dossier,
    merged.client_nom || merged.nom_dossier,
    merged.statut,
    typeof merged.flags === 'string' ? merged.flags : JSON.stringify(merged.flags || []),
    merged.type_intervention || 'Autre',
    merged.date_ouverture || null,
    e.devis ? 1 : (merged.etape_devis ?? 0),
    e.cmde  ? 1 : (merged.etape_cmde  ?? 0),
    e.atelier ? 1 : (merged.etape_atelier ?? 0),
    e.print ? 1 : (merged.etape_print ?? 0),
    e.realise ? 1 : (merged.etape_realise ?? 0),
    merged.lien || merged.lien_dossier_externe || '',
    merged.comm || merged.commentaires || '',
    merged.adresse || '', merged.telephone || '', merged.email || '',
    parseFloat(merged.heures_a_realiser) || 0,
    'date_planifiee' in body ? body.date_planifiee : existing.date_planifiee,
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
