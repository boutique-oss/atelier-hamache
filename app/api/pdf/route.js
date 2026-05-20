import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';

export const dynamic = 'force-dynamic';

const BUCKET = 'pdfs';

export async function GET(request) {
  const supabase = createClient();
  const dossierId = new URL(request.url).searchParams.get('dossier_id');
  if (!dossierId) return NextResponse.json({ error: 'dossier_id requis' }, { status: 400 });

  const filename = `dossier-${dossierId}.pdf`;
  const { data, error } = await supabase.storage.from(BUCKET).download(filename);
  if (error) return NextResponse.json({ error: 'Fichier introuvable' }, { status: 404 });

  const buffer = await data.arrayBuffer();
  return new Response(buffer, {
    headers: {
      'Content-Type': 'application/pdf',
      'Content-Disposition': `inline; filename="fiche-${dossierId}.pdf"`,
    },
  });
}

export async function POST(request) {
  const supabase = createClient();
  const formData = await request.formData();
  const file = formData.get('file');
  const dossierId = formData.get('dossier_id');

  if (!file || !dossierId) return NextResponse.json({ error: 'file et dossier_id requis' }, { status: 400 });
  if (!file.name.toLowerCase().endsWith('.pdf')) return NextResponse.json({ error: 'Seuls les .pdf sont acceptés' }, { status: 400 });

  const filename = `dossier-${dossierId}.pdf`;
  const buffer = await file.arrayBuffer();

  const { error: uploadErr } = await supabase.storage
    .from(BUCKET).upload(filename, buffer, { contentType: 'application/pdf', upsert: true });
  if (uploadErr) return NextResponse.json({ error: uploadErr.message }, { status: 500 });

  const { error: dbErr } = await supabase
    .from('dossiers').update({ fiche_pdf: filename }).eq('id', parseInt(dossierId));
  if (dbErr) return NextResponse.json({ error: dbErr.message }, { status: 500 });

  return NextResponse.json({ ok: true, filename });
}

export async function DELETE(request) {
  const supabase = createClient();
  const dossierId = new URL(request.url).searchParams.get('dossier_id');
  if (!dossierId) return NextResponse.json({ error: 'dossier_id requis' }, { status: 400 });

  const filename = `dossier-${dossierId}.pdf`;
  await supabase.storage.from(BUCKET).remove([filename]);
  await supabase.from('dossiers').update({ fiche_pdf: null }).eq('id', parseInt(dossierId));
  return NextResponse.json({ ok: true });
}
