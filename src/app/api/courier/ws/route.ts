import { NextRequest, NextResponse } from 'next/server';

export async function GET(req: NextRequest) {
  const upgrade = req.headers.get('upgrade')?.toLowerCase();
  if (upgrade !== 'websocket') {
    return new NextResponse('Expected WebSocket upgrade', { status: 426 });
  }
  const { searchParams } = new URL(req.url);
  const token = searchParams.get('token');
  if (!token) return new NextResponse('Unauthorized', { status: 401 });
  return NextResponse.json({ ok: true, message: 'WebSocket endpoint ready. Use wss://rumah-keripik.vercel.app/api/courier/ws' });
}
