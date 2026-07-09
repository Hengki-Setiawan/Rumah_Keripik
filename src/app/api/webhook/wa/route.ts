import { NextRequest, NextResponse } from 'next/server';

/**
 * Webhook Evolution API (DEACTIVATED).
 */
export async function GET() {
  return NextResponse.json({
    ok: false,
    message: 'WhatsApp integration via Evolution API has been deactivated.',
  });
}

export async function POST() {
  return NextResponse.json({
    ok: false,
    message: 'WhatsApp integration via Evolution API has been deactivated.',
  });
}
