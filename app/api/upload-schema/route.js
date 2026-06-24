import { put } from '@vercel/blob';
import { NextResponse } from 'next/server';

export async function POST(request) {
  const formData = await request.formData();
  const file = formData.get('file');

  if (!file) return NextResponse.json({ error: 'Aucun fichier' }, { status: 400 });

  const ext = file.name.split('.').pop().toLowerCase();
  const allowed = ['jpg', 'jpeg', 'png', 'webp', 'heic'];
  if (!allowed.includes(ext)) {
    return NextResponse.json({ error: 'Format non supporté' }, { status: 400 });
  }

  const blob = await put(`schemas/${Date.now()}-${file.name}`, file, { access: 'public' });
  return NextResponse.json({ url: blob.url });
}
