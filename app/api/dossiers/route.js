import { NextResponse } from 'next/server';
import { getDb, row2dossier } from '@/lib/db';

export const dynamic = 'force-dynamic';

export async function GET() {
  const db = getDb();
  const rows = db.prepare('SELECT * FROM dossiers ORDER BY date_ouverture DESC').all();
  return NextResponse.json(rows.map(row2dossier));
}

export async function POST(request) {
  const body = await request.json();
  const db = getDb();
  
  const stmt = db.prepare(`
    INSERT INTO dossiers (nom_dossier, client_nom, statut, flags, type_intervention, date_ouverture,
      etape_devis, etape_cmde, etape_atelier, etape_print, etape_realise,
      lien_dossier_externe, commentaires, adresse, telephone, email, heures_a_realiser)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `);

  const e = body.etapes || {};
  const result = stmt.run(
    body.nom_dossier, body.client_nom || body.nom_dossier, body.statut,
    JSON.stringify(body.flags || []), body.type_intervention || 'Autre',
    body.date_ouverture || null,
    e.devis ? 1 : 0, e.cmde ? 1 : 0, e.atelier ? 1 : 0, e.print ? 1 : 0, e.realise ? 1 : 0,
    body.lien || '', body.comm || '', body.adresse || '', body.telephone || '', body.email || '',
    parseFloat(body.heures_a_realiser) || 0
  );
  
  const created = db.prepare('SELECT * FROM dossiers WHERE id = ?').get(result.lastInsertRowid);

  // Broadcast update to all connected clients
  fetch(new URL('/api/sync?action=broadcast', request.url).toString()).catch(() => {});

  return NextResponse.json(row2dossier(created), { status: 201 });
}
