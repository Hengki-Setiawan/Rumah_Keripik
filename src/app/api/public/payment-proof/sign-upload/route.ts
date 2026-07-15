import { NextResponse } from 'next/server';

export async function POST() {
  return NextResponse.json(
    {
      ok: false,
      error: 'Upload bukti pembayaran manual sudah dimatikan. Gunakan checkout online Duitku dari halaman status atau Pesanan Saya.',
    },
    { status: 410 },
  );
}
