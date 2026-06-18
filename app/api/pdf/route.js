import { NextResponse } from 'next/server';
import { put, del, head } from '@vercel/blob';
import { sql } from '@/lib/postgres';

export const dynamic = 'force-dynamic';

export async function GET(request) {
  const dossierId = new URL(request.url).searchParams.get('dossier_id');
  if (!dossierId) return NextResponse.json({ error: 'dossier_id requis' }, { status: 400 });

  const { rows } = await sql`SELECT fiche_pdf FROM dossiers WHERE id = ${parseInt(dossierId)}`;
  const blobUrl = rows[0]?.fiche_pdf;
  if (!blobUrl) return NextResponse.json({ error: 'Fichier introuvable' }, { status: 404 });

  const res = await fetch(blobUrl);
  if (!res.ok) return NextResponse.json({ error: 'Fichier introuvable' }, { status: 404 });

  const buffer = await res.arrayBuffer();
  return new Response(buffer, {
    headers: {
      'Content-Type': 'application/pdf',
      'Content-Disposition': `inline; filename="fiche-${dossierId}.pdf"`,
    },
  });
}

export async function POST(request) {
  const formData = await request.formData();
  const file = formData.get('file');
  const dossierId = formData.get('dossier_id');

  if (!file || !dossierId) return NextResponse.json({ error: 'file et dossier_id requis' }, { status: 400 });
  if (!file.name.toLowerCase().endsWith('.pdf')) return NextResponse.json({ error: 'Seuls les .pdf sont acceptés' }, { status: 400 });

  const buffer = await file.arrayBuffer();
  const blob = await put(`pdfs/dossier-${dossierId}.pdf`, buffer, {
    access: 'public',
    contentType: 'application/pdf',
    addRandomSuffix: false,
  });

  await sql`UPDATE dossiers SET fiche_pdf = ${blob.url} WHERE id = ${parseInt(dossierId)}`;
  return NextResponse.json({ ok: true, filename: blob.url });
}

export async function DELETE(request) {
  const dossierId = new URL(request.url).searchParams.get('dossier_id');
  if (!dossierId) return NextResponse.json({ error: 'dossier_id requis' }, { status: 400 });

  const { rows } = await sql`SELECT fiche_pdf FROM dossiers WHERE id = ${parseInt(dossierId)}`;
  const blobUrl = rows[0]?.fiche_pdf;
  if (blobUrl) {
    try { await del(blobUrl); } catch {}
  }
  await sql`UPDATE dossiers SET fiche_pdf = NULL WHERE id = ${parseInt(dossierId)}`;
  return NextResponse.json({ ok: true });
}
