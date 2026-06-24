import { handleUpload } from '@vercel/blob/multipart';
import { NextResponse } from 'next/server';

export async function POST(request) {
  try {
    const response = await handleUpload({
      request,
      onBeforeGenerateToken: async (pathname) => ({
        allowedContentTypes: ['image/jpeg', 'image/png', 'image/webp', 'image/gif', 'image/heic'],
        maximumSizeInBytes: 20 * 1024 * 1024, // 20 MB
      }),
      onUploadCompleted: async ({ blob }) => {
        console.log('[upload-schema] completed:', blob.url);
      },
    });
    return NextResponse.json(response);
  } catch (err) {
    console.error('[upload-schema]', err);
    return NextResponse.json({ error: err.message }, { status: 400 });
  }
}
