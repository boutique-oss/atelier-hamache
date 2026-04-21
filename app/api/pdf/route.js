import { NextResponse } from 'next/server';
import { getDb } from '@/lib/db';
import path from 'path';
import fs from 'fs';

export const dynamic = 'force-dynamic';

const PDF_DIR = path.join(process.cwd(), 'data', 'pdfs');

function ensureDir() {
  if (!fs.existsSync(PDF_DIR)) fs.mkdirSync(PDF_DIR, { recursive: true });
}

// ── GET /api/pdf?dossier_id=X  →  sert le PDF inline ────────────────────
export async function GET(request) {
  try {
    const dossierId = new URL(request.url).searchParams.get('dossier_id');
    if (!dossierId) return NextResponse.json({ error: 'dossier_id requis' }, { status: 400 });

    const filePath = path.join(PDF_DIR, `dossier-${dossierId}.pdf`);
    if (!fs.existsSync(filePath)) {
      return NextResponse.json({ error: 'Fichier introuvable' }, { status: 404 });
    }

    const buffer = fs.readFileSync(filePath);
    return new Response(buffer, {
      headers: {
        'Content-Type': 'application/pdf',
        'Content-Disposition': `inline; filename="fiche-${dossierId}.pdf"`,
      },
    });
  } catch(e) {
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}

// ── POST /api/pdf  (FormData: file + dossier_id)  →  sauvegarde le PDF ──
export async function POST(request) {
  try {
    ensureDir();
    const formData   = await request.formData();
    const file       = formData.get('file');
    const dossierId  = formData.get('dossier_id');

    if (!file || !dossierId) {
      return NextResponse.json({ error: 'file et dossier_id requis' }, { status: 400 });
    }
    if (!file.name.toLowerCase().endsWith('.pdf')) {
      return NextResponse.json({ error: 'Seuls les fichiers .pdf sont acceptés' }, { status: 400 });
    }

    const filename = `dossier-${dossierId}.pdf`;
    const filePath = path.join(PDF_DIR, filename);
    fs.writeFileSync(filePath, Buffer.from(await file.arrayBuffer()));

    const db = getDb();
    db.prepare('UPDATE dossiers SET fiche_pdf = ? WHERE id = ?')
      .run(filename, parseInt(dossierId));

    return NextResponse.json({ ok: true, filename });
  } catch(e) {
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}

// ── DELETE /api/pdf?dossier_id=X  →  supprime le PDF ────────────────────
export async function DELETE(request) {
  try {
    const dossierId = new URL(request.url).searchParams.get('dossier_id');
    if (!dossierId) return NextResponse.json({ error: 'dossier_id requis' }, { status: 400 });

    const filePath = path.join(PDF_DIR, `dossier-${dossierId}.pdf`);
    if (fs.existsSync(filePath)) fs.unlinkSync(filePath);

    const db = getDb();
    db.prepare('UPDATE dossiers SET fiche_pdf = NULL WHERE id = ?').run(parseInt(dossierId));

    return NextResponse.json({ ok: true });
  } catch(e) {
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}
