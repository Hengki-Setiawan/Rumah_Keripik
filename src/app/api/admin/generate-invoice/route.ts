import { NextRequest, NextResponse } from 'next/server';

export async function POST(req: NextRequest) {
  try {
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
  } catch (err: any) {
    console.error('[API/GenerateInvoice] Error:', err);
    return NextResponse.json(
      { error: err.message || 'Internal server error' },
      { status: 500 }
    );
  }
}
