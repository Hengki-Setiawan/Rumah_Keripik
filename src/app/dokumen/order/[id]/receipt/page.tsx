import { notFound } from 'next/navigation';
import { OrderDocument } from '@/components/documents/OrderDocument';
import { getOrderDocumentData } from '@/lib/order-documents';
import { canIssueReceipt } from '@/lib/order-status-policy';

export const dynamic = 'force-dynamic';

type PageProps = {
  params: Promise<{ id: string }>;
};

export default async function ReceiptPage({ params }: PageProps) {
  const { id } = await params;
  const data = await getOrderDocumentData(decodeURIComponent(id), 'receipt');
  if (!data) notFound();
  if (!canIssueReceipt(data.order)) notFound();

  return <OrderDocument data={data} type="receipt" />;
}
