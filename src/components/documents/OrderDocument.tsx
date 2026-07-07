import Link from 'next/link';
import type { OrderDocumentData } from '@/lib/order-documents';
import { formatOrderDate, getOrderCode, getPaymentMethodLabel, getReceiptStatus, renderMoney } from '@/lib/order-documents';
import { PrintDocumentButton } from './PrintDocumentButton';

type DocumentType = 'proforma' | 'receipt' | 'packing-label';

type Props = {
  data: NonNullable<OrderDocumentData>;
  type: DocumentType;
};

const TITLES: Record<DocumentType, string> = {
  proforma: 'Proforma Invoice',
  receipt: 'Invoice / Receipt',
  'packing-label': 'Packing Label',
};

export function OrderDocument({ data, type }: Props) {
  const { order, items } = data;
  const orderCode = getOrderCode(order);
  const isPackingLabel = type === 'packing-label';
  const canShowReceipt = type !== 'receipt' || order.payment_status === 'verified' || order.status_pembayaran === 'Lunas';

  return (
    <main className="min-h-screen bg-neutral-100 p-4 text-neutral-950 print:bg-white print:p-0">
      <style>{`
        @page { size: A4; margin: 14mm; }
        @media print {
          .no-print { display: none !important; }
          .print-card { box-shadow: none !important; border: 0 !important; padding: 0 !important; }
          body { background: white !important; }
        }
      `}</style>

      <div className="no-print mx-auto mb-4 flex max-w-4xl items-center justify-between gap-3">
        <Link href="/pembayaran/verifikasi" className="rounded-xl border border-neutral-200 bg-white px-4 py-2 text-sm font-medium">
          Kembali
        </Link>
        <PrintDocumentButton orderId={order.id_transaksi} documentType={type} />
      </div>

      <section className={`print-card mx-auto max-w-4xl rounded-3xl bg-white p-8 shadow-[0_18px_60px_rgba(15,23,42,0.10)] ${isPackingLabel ? 'max-w-2xl' : ''}`}>
        <header className="flex items-start justify-between gap-6 border-b border-neutral-200 pb-5">
          <div>
            <p className="text-sm font-semibold tracking-[0.08em] text-neutral-500">Rumah Keripik</p>
            <h1 className="mt-2 text-3xl font-semibold tracking-tight">{TITLES[type]}</h1>
            <p className="mt-1 text-sm text-neutral-600">UMKM keripik rumahan - operasional order</p>
          </div>
          <div className="text-right">
            <p className="text-xs font-bold uppercase text-neutral-500">Kode</p>
            <p className="text-xl font-semibold">{orderCode}</p>
            {data.document && (
              <>
                <p className="mt-2 text-xs font-bold uppercase text-neutral-500">No Dokumen</p>
                <p className="text-sm font-semibold">{data.document.document_number}</p>
              </>
            )}
            <p className="mt-2 text-xs text-neutral-500">{formatOrderDate(order.waktu_simpan)}</p>
          </div>
        </header>

        {!canShowReceipt && (
          <div className="mt-6 rounded-2xl border border-orange-100 bg-orange-50/70 p-4 text-sm font-medium text-orange-800">
            Receipt final belum bisa diterbitkan karena pembayaran belum diverifikasi admin. Gunakan proforma untuk dokumen pra-bayar.
          </div>
        )}

        <section className="mt-6 grid gap-4 sm:grid-cols-2">
          <div className="rounded-2xl border p-4">
            <p className="text-xs font-medium tracking-wide text-neutral-500">Penerima</p>
            <p className="mt-2 text-lg font-semibold">{order.nama_penerima || '-'}</p>
            <p className="mt-1 text-sm">{order.no_hp_penerima || order.no_wa_pelanggan || '-'}</p>
            <p className="mt-2 whitespace-pre-wrap text-sm text-neutral-700">{order.alamat_penerima || order.shipping_address_snapshot || '-'}</p>
          </div>
          {!isPackingLabel && (
            <div className="rounded-2xl border p-4">
              <p className="text-xs font-medium tracking-wide text-neutral-500">Pembayaran</p>
              <p className="mt-2 text-lg font-semibold">{getPaymentMethodLabel(data)}</p>
              <p className="mt-1 text-sm">Status: {getReceiptStatus(data)}</p>
              <p className="mt-1 text-sm">Diverifikasi: {formatOrderDate(order.verified_at)}</p>
            </div>
          )}
        </section>

        {isPackingLabel && (
          <section className="mt-6 rounded-2xl border-2 border-dashed border-neutral-900 p-5">
            <p className="text-xs font-medium tracking-wide text-neutral-500">Instruksi Packing</p>
            <p className="mt-2 text-sm">Catatan order: {order.catatan || order.admin_note || '-'}</p>
            <p className="mt-1 text-sm">Status order: {order.order_status}</p>
          </section>
        )}

        <section className="mt-6 overflow-hidden rounded-2xl border">
          <table className="w-full border-collapse text-left text-sm">
            <thead className="bg-neutral-50 text-neutral-600">
              <tr>
                <th className="p-3">Item</th>
                <th className="p-3 text-center">Qty</th>
                {!isPackingLabel && <th className="p-3 text-right">Harga</th>}
                {!isPackingLabel && <th className="p-3 text-right">Subtotal</th>}
              </tr>
            </thead>
            <tbody>
              {items.map((item) => (
                <tr key={item.id} className="border-b last:border-b-0">
                  <td className="p-3">
                    <p className="font-semibold">{item.nama_produk_snapshot || item.id_produk}</p>
                    {item.nama_varian_snapshot && <p className="text-xs text-neutral-500">{item.nama_varian_snapshot}</p>}
                    {item.berat_gram_snapshot && <p className="text-xs text-neutral-500">{item.berat_gram_snapshot} gram</p>}
                  </td>
                  <td className="p-3 text-center font-semibold">{item.qty_terjual}</td>
                  {!isPackingLabel && <td className="p-3 text-right">{renderMoney(item.harga_snapshot)}</td>}
                  {!isPackingLabel && <td className="p-3 text-right font-semibold">{renderMoney(item.subtotal)}</td>}
                </tr>
              ))}
            </tbody>
          </table>
        </section>

        {!isPackingLabel && (
          <section className="mt-6 flex justify-end">
            <div className="w-full max-w-sm rounded-2xl border border-neutral-200 bg-neutral-50 p-5 text-neutral-950">
              <div className="flex justify-between gap-4 text-sm">
                <span>Total Bayar</span>
                <span className="text-2xl font-semibold tracking-[-0.03em]">{renderMoney(order.total_bayar)}</span>
              </div>
            </div>
          </section>
        )}

        <footer className="mt-8 border-t pt-4 text-xs text-neutral-500">
          {type === 'proforma' && 'Dokumen ini adalah proforma pra-verifikasi dan bukan bukti pembayaran final.'}
          {type === 'receipt' && 'Receipt/invoice ini diterbitkan setelah admin memverifikasi pembayaran.'}
          {type === 'packing-label' && 'Tempelkan label ini pada paket atau gunakan sebagai panduan packing.'}
        </footer>
      </section>
    </main>
  );
}
