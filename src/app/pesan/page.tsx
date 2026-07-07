import { ChatShell } from '@/features/chat/ChatShell';

export const dynamic = 'force-dynamic';

export const metadata = {
  title: 'Chat Pesan Keripik | Rumah Keripik AI',
  description: 'Pesan keripik lewat chat AI Rumah Keripik: pilih produk, bangun keranjang, isi lokasi, pilih pembayaran, dan lacak pesanan.',
};

export default function PesanPage() {
  return <ChatShell />;
}
