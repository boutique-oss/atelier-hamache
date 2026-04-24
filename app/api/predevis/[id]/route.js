import { NextResponse } from 'next/server';
import { getDb } from '@/lib/db';

export const dynamic = 'force-dynamic';

export async function GET(request, { params }) {
  const db = getDb();
  const row = db.prepare('SELECT * FROM predevis WHERE id = ?').get(parseInt(params.id));
  if (!row) return NextResponse.json({ error: 'not found' }, { status: 404 });
  return NextResponse.json(row);
}

export async function PUT(request, { params }) {
  const db = getDb();
  const id = parseInt(params.id);
  const body = await request.json();

  db.prepare(`
    UPDATE predevis SET
      statut=?, dossier_id=?, client_nom=?, client_tel=?, client_email=?, client_adresse=?,
      description=?, type_intervention=?, tapisserie_ops=?, urgent=?,
      tissus=?, fournitures=?, heures_estimees=?, taux_horaire=?, forfait_pose=?,
      km_deplacement=?, tarif_km=?, taux_tva=?, notes=?, total_ht=?, total_ttc=?,
      updated_at=CURRENT_TIMESTAMP
    WHERE id=?
  `).run(
    body.statut || 'brouillon',
    body.dossier_id || null,
    body.client_nom || '',
    body.client_tel || '',
    body.client_email || '',
    body.client_adresse || '',
    body.description || '',
    body.type_intervention || 'Tapisserie',
    body.tapisserie_ops ? JSON.stringify(body.tapisserie_ops) : null,
    body.urgent ? 1 : 0,
    body.tissus ? JSON.stringify(body.tissus) : null,
    body.fournitures ? JSON.stringify(body.fournitures) : null,
    parseFloat(body.heures_estimees) || 0,
    parseFloat(body.taux_horaire) || 55,
    parseFloat(body.forfait_pose) || 0,
    parseFloat(body.km_deplacement) || 0,
    parseFloat(body.tarif_km) || 0.5,
    parseFloat(body.taux_tva) || 0.20,
    body.notes || '',
    parseFloat(body.total_ht) || 0,
    parseFloat(body.total_ttc) || 0,
    id,
  );

  return NextResponse.json({ ok: true });
}

export async function DELETE(request, { params }) {
  const db = getDb();
  db.prepare('DELETE FROM predevis WHERE id = ?').run(parseInt(params.id));
  return NextResponse.json({ ok: true });
}
