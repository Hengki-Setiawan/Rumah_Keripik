import { notFound } from 'next/navigation';
import { OrderDocument } from '@/components/documents/OrderDocument';
import { getOrderDocumentData } from '@/lib/order-documents';

export const dynamic = 'force-dynamic';

type PageProps = {
  params: Promise<{ id: string }>;
};

export default async function ProformaPage({ params }: PageProps) {
  const { id } = await params;
  const data = await getOrderDocumentData(decodeURIComponent(id), 'proforma');
  if (!data) notFound();

  return <OrderDocument data={data} type="proforma" />;
}
