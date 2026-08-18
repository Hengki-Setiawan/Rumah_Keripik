import { NextRequest, NextResponse } from 'next/server';
import { adminAuthErrorResponse, requireAdminRole } from '@/lib/admin-actor';

export async function POST(req: NextRequest) {
  try {
    await requireAdminRole('order:update');

    const { id_transaksi } = await req.json();

    if (!id_transaksi) {
      return NextResponse.json(
        { error: 'ID transaksi wajib diisi' },
        { status: 400 }
      );
    }

    const { generateAndSaveInvoice } = await import('@/lib/invoice-generator');
    const secureUrl = await generateAndSaveInvoice(id_transaksi);

    return NextResponse.json({
      success: true,
      invoice_url: secureUrl,
    });
  } catch (error) {
    const authResponse = adminAuthErrorResponse(error);
    if (authResponse) return authResponse;
    console.error('[API/GenerateInvoice] Error:', error);
    return NextResponse.json(
      { error: (error as Error)?.message || 'Internal server error' },
      { status: 500 }
    );
  }
}
