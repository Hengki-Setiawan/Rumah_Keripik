import { and, eq, like, sql } from 'drizzle-orm';
import { db } from '@/lib/db';
import { detailTransaksi, orderDocument, paymentIntent, paymentMethod, paymentProof, transaksi } from '@/lib/schema';
import { formatRupiah } from '@/lib/utils';
import { randomUUID } from 'crypto';
import { canIssueReceipt, canPrintPackingLabel } from '@/lib/order-status-policy';

export type DocumentType = 'proforma' | 'receipt' | 'packing-label';

export type OrderDocumentData = Awaited<ReturnType<typeof getOrderDocumentData>>;

export async function getOrderDocumentData(id_transaksi: string, documentType?: DocumentType) {
  const [order] = await db
    .select()
    .from(transaksi)
    .where(eq(transaksi.id_transaksi, id_transaksi))
    .limit(1);

  if (!order) return null;

  const items = await db
    .select()
    .from(detailTransaksi)
    .where(eq(detailTransaksi.id_transaksi, id_transaksi));

  const [intent] = await db
    .select({ intent: paymentIntent, method: paymentMethod })
    .from(paymentIntent)
    .leftJoin(paymentMethod, eq(paymentIntent.id_payment_method, paymentMethod.id_payment_method))
    .where(eq(paymentIntent.id_transaksi, id_transaksi))
    .limit(1);

  const proofs = await db
    .select()
    .from(paymentProof)
    .where(eq(paymentProof.id_transaksi, id_transaksi));

  const document = documentType ? await getOrCreateOrderDocument(id_transaksi, documentType, order) : null;

  return { order, items, paymentIntent: intent?.intent ?? null, paymentMethod: intent?.method ?? null, proofs, document };
}

export async function getOrCreateOrderDocument(id_transaksi: string, documentType: DocumentType, order?: { payment_status: string; status_pembayaran: string; order_status: string; payment_method: string | null }) {
  if (documentType === 'receipt' && order && !canIssueReceipt(order)) return null;
  if (documentType === 'packing-label' && order && !canPrintPackingLabel(order)) return null;
  const [existing] = await db
    .select()
    .from(orderDocument)
    .where(and(eq(orderDocument.id_transaksi, id_transaksi), eq(orderDocument.document_type, documentType)))
    .limit(1);
  if (existing) return existing;

  const prefix = documentType === 'proforma' ? 'PRO' : documentType === 'receipt' ? 'INV' : 'PKG';
  const date = new Date().toISOString().slice(0, 10).replace(/-/g, '');
  const [countRow] = await db
    .select({ total: sql<number>`count(*)` })
    .from(orderDocument)
    .where(like(orderDocument.document_number, `${prefix}-${date}-%`));
  const sequence = String(Number(countRow?.total || 0) + 1).padStart(3, '0');
  const document_number = `${prefix}-${date}-${sequence}`;
  const [inserted] = await db.insert(orderDocument).values({
    id_document: `DOC-${randomUUID()}`,
    id_transaksi,
    document_type: documentType,
    document_number,
    status: 'issued',
    issued_by: 'system',
  }).returning();
  return inserted;
}

export function formatOrderDate(value: string | null | undefined) {
  if (!value) return '-';
  return new Date(value).toLocaleString('id-ID', {
    dateStyle: 'medium',
    timeStyle: 'short',
  });
}

export function getOrderCode(order: NonNullable<OrderDocumentData>['order']) {
  return order.kode_pesanan || order.id_transaksi;
}

export function getPaymentMethodLabel(data: NonNullable<OrderDocumentData>) {
  if (data.paymentMethod?.label) return data.paymentMethod.label;
  if (data.order.payment_method) return data.order.payment_method.replace(/_/g, ' ');
  if (data.paymentIntent?.method_type) return data.paymentIntent.method_type.replace(/_/g, ' ');
  return '-';
}

export function getReceiptStatus(data: NonNullable<OrderDocumentData>) {
  if (data.order.payment_status === 'verified') return 'Pembayaran terverifikasi';
  if (data.order.status_pembayaran === 'Lunas') return 'Lunas';
  return 'Belum final';
}

export function renderMoney(value: number | null | undefined) {
  return formatRupiah(value ?? 0);
}
