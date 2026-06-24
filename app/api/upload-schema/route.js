import { put } from '@vercel/blob';
import { NextResponse } from 'next/server';

export const runtime = 'nodejs';
export const maxDuration = 60;

const BLOB_TOKEN = process.env.BLOB_READ_WRITE_TOKEN_READ_WRITE_TOKEN || process.env.BLOB_READ_WRITE_TOKEN;

export async function POST(request) {
  if (!BLOB_TOKEN) {
    console.error('[upload-schema] Aucun token Blob trouvé (BLOB_READ_WRITE_TOKEN_READ_WRITE_TOKEN ou BLOB_READ_WRITE_TOKEN)');
    return NextResponse.json({ error: 'Configuration serveur manquante (token blob)' }, { status: 500 });
  }

  try {
    const formData = await request.formData();
    const file = formData.get('file');

    if (!file) return NextResponse.json({ error: 'Aucun fichier reçu' }, { status: 400 });

    const ext = (file.name || '').split('.').pop().toLowerCase();
    const allowed = ['jpg', 'jpeg', 'png', 'webp', 'gif', 'heic'];
    if (!allowed.includes(ext)) {
      return NextResponse.json({ error: `Format non supporté : ${ext}` }, { status: 400 });
    }

    const arrayBuffer = await file.arrayBuffer();
    const buffer = Buffer.from(arrayBuffer);

    const blob = await put(`schemas/${Date.now()}-${file.name}`, buffer, {
      access: 'public',
      contentType: file.type || 'image/jpeg',
      token: BLOB_TOKEN,
    });

    return NextResponse.json({ url: blob.url });
  } catch (err) {
    console.error('[upload-schema]', err);
    return NextResponse.json({ error: err.message || 'Erreur serveur' }, { status: 500 });
  }
}
