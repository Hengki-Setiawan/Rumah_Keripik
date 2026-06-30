'use client';

interface QuickReplyProps {
  onSelect: (text: string) => void;
}

const QUICK_REPLIES = [
  {
    label: 'Konfirmasi Bayar',
    message: 'Pembayaran Anda sudah kami verifikasi! Pesanan sedang diproses ya kak 😊',
  },
  {
    label: 'Tolak Bayar',
    message: 'Maaf kak, bukti pembayaran yang dikirim tidak valid. Mohon kirim ulang foto yang lebih jelas ya.',
  },
  {
    label: 'Sedang Disiapkan',
    message: 'Pesanan Kakak sedang kami siapkan! Estimasi selesai 1-2 jam ya kak 🙏',
  },
  {
    label: 'Sedang Dikirim',
    message: 'Pesanan Kakak sudah dalam perjalanan! Mohon tunggu ya kak 😊',
  },
  {
    label: 'Sudah Sampai?',
    message: 'Halo Kak! Apakah pesanannya sudah sampai? Semoga keripiknya enak ya 😄',
  },
  {
    label: 'Promo',
    message: 'Halo Kak! Saat ini ada promo spesial untuk pembelian Keripik Balado — beli 3 gratis 1! Masih berlaku sampai akhir bulan ini loh kak 😊',
  },
];

export function QuickReplyBar({ onSelect }: QuickReplyProps) {
  return (
    <div className="flex gap-1.5 overflow-x-auto pb-2 scrollbar-none">
      {QUICK_REPLIES.map((qr, i) => (
        <button
          key={i}
          onClick={() => onSelect(qr.message)}
          className="shrink-0 text-xs px-3 py-1.5 rounded-full border border-neutral-200 hover:bg-primary hover:text-on-primary hover:border-primary transition-colors whitespace-nowrap"
        >
          {qr.label}
        </button>
      ))}
    </div>
  );
}
