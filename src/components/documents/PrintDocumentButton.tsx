'use client';

type Props = {
  orderId: string;
  documentType: 'proforma' | 'receipt' | 'packing-label';
};

export function PrintDocumentButton({ orderId, documentType }: Props) {
  async function handlePrint() {
    await fetch('/api/admin/document-print-log', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ orderId, documentType }),
    }).catch(() => undefined);
    window.print();
  }

  return (
    <button type="button" onClick={handlePrint} className="rounded-xl bg-neutral-950 px-4 py-2 text-sm font-bold text-white shadow-sm">
      Cetak / Simpan PDF
    </button>
  );
}
