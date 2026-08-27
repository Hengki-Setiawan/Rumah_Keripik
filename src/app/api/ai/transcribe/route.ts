import { NextResponse } from 'next/server';
import { transcribeVoiceNote } from '@/lib/workers-ai';

export const dynamic = 'force-dynamic';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization',
};

export async function OPTIONS() {
  return new NextResponse(null, {
    status: 204,
    headers: corsHeaders,
  });
}

export async function POST(req: Request) {
  try {
    const contentType = req.headers.get('content-type') || '';
    let audioBytes: Uint8Array;

    if (contentType.includes('multipart/form-data')) {
      const formData = await req.formData();
      const file = (formData.get('file') || formData.get('audio')) as File | null;
      if (!file) {
        return NextResponse.json({ ok: false, error: 'File audio tidak ditemukan' }, { status: 400, headers: corsHeaders });
      }
      const arrayBuffer = await file.arrayBuffer();
      audioBytes = new Uint8Array(arrayBuffer);
    } else {
      const arrayBuffer = await req.arrayBuffer();
      if (!arrayBuffer || arrayBuffer.byteLength === 0) {
        return NextResponse.json({ ok: false, error: 'Body audio kosong' }, { status: 400, headers: corsHeaders });
      }
      audioBytes = new Uint8Array(arrayBuffer);
    }

    const transcribedText = await transcribeVoiceNote(audioBytes);

    return NextResponse.json({
      ok: true,
      text: transcribedText,
      provider: 'cloudflare-workers-ai-whisper',
    }, { headers: corsHeaders });
  } catch (error: any) {
    console.error('Error transkripsi voice note:', error);
    return NextResponse.json(
      {
        ok: false,
        error: error.message || 'Gagal memproses pesan suara',
      },
      { status: 500, headers: corsHeaders }
    );
  }
}
