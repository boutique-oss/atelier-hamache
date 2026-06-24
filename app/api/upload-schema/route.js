import { put } from '@vercel/blob';
import { NextResponse } from 'next/server';

export async function POST(request) {
  try {
    const formData = await request.formData();
    const file = formData.get('file');

    if (!file) return NextResponse.json({ error: 'Aucun fichier reçu' }, { status: 400 });

    const ext = (file.name || '').split('.').pop().toLowerCase();
    const allowed = ['jpg', 'jpeg', 'png', 'webp', 'heic', 'gif'];
    if (!allowed.includes(ext)) {
      return NextResponse.json({ error: `Format non supporté : ${ext}` }, { status: 400 });
    }

    const token = process.env.BLOB_READ_WRITE_TOKEN;
    const blob = await put(`schemas/${Date.now()}-${file.name}`, file, {
      access: 'public',
      token: token || undefined,
    });
    return NextResponse.json({ url: blob.url });
  } catch (err) {
    console.error('[upload-schema]', err);
    return NextResponse.json({
      error: err.message || 'Erreur serveur',
      details: err?.cause?.message || err?.stack?.split('\n')[0] || null,
      tokenPresent: !!process.env.BLOB_READ_WRITE_TOKEN,
      tokenPrefix: process.env.BLOB_READ_WRITE_TOKEN?.slice(0, 20) || 'absent',
    }, { status: 500 });
  }
}
