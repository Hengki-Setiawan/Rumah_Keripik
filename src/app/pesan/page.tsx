import { ChatShell } from '@/features/chat/ChatShell';

export const dynamic = 'force-dynamic';

export const metadata = {
  title: 'Chat Pesan Keripik | Rumah Keripik',
  description: 'Pesan keripik lewat chat Rumah Keripik: pilih produk, bangun keranjang, isi lokasi, lanjut bayar online, dan cek Pesanan Saya.',
};

export default async function PesanPage({ searchParams }: { searchParams: Promise<{ verify?: string }> }) {
  const params = await searchParams;
  return <ChatShell verify={params.verify} />;
}
