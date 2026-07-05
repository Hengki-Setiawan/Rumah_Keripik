import { notFound } from 'next/navigation';
import { OrderDocument } from '@/components/documents/OrderDocument';
import { getOrderDocumentData } from '@/lib/order-documents';
import { canPrintPackingLabel } from '@/lib/order-status-policy';

export const dynamic = 'force-dynamic';

type PageProps = {
  params: Promise<{ id: string }>;
};

export default async function PackingLabelPage({ params }: PageProps) {
  const { id } = await params;
  const data = await getOrderDocumentData(decodeURIComponent(id), 'packing-label');
  if (!data) notFound();
  if (!canPrintPackingLabel(data.order)) notFound();

  return <OrderDocument data={data} type="packing-label" />;
}
