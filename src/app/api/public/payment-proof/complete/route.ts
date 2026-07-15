import { NextResponse } from 'next/server';

export async function POST() {
  return NextResponse.json(
    {
      ok: false,
      error: 'Verifikasi pembayaran manual sudah dimatikan. Pembayaran Rumah Keripik sekarang diproses otomatis lewat checkout online Duitku.',
    },
    { status: 410 },
  );
}
