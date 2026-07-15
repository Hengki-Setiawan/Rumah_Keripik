'use client';

import Link from 'next/link';
import { CreditCard } from 'lucide-react';

type Props = {
  orderId: string;
  statusToken: string;
  onUploaded?: () => void;
};

export function PaymentProofUploader({ orderId, statusToken, onUploaded }: Props) {
  void orderId;
  void statusToken;
  void onUploaded;

  return (
    <div className="mt-6 rounded-[1.5rem] border border-[#e5e7eb] bg-[#f7f7f8] p-5">
      <div className="flex items-center gap-3">
        <div className="grid h-11 w-11 place-items-center rounded-2xl bg-[#111827] text-white">
          <CreditCard size={22} />
        </div>
        <div>
          <p className="font-semibold">Pembayaran online otomatis</p>
          <p className="text-sm text-[#6b7280]">Upload bukti bayar manual sudah dimatikan. Lanjutkan pembayaran dari checkout Duitku agar status pesanan terupdate otomatis.</p>
        </div>
      </div>
      <div className="mt-4 flex flex-col gap-3 sm:flex-row">
        <Link href="/pesan/saya" className="rounded-2xl bg-[#111827] px-5 py-3 text-center font-medium text-white transition hover:bg-[#374151]">
          Buka Pesanan Saya
        </Link>
        <Link href="/pesan" className="rounded-2xl border border-[#d1d5db] bg-white px-5 py-3 text-center font-medium text-[#111827] transition hover:bg-[#f3f4f6]">
          Kembali ke chat
        </Link>
      </div>
    </div>
  );
}
