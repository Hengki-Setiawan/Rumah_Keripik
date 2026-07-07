import { formatRupiah } from '@/lib/utils';
import { CopyTextButton } from './CopyTextButton';

type Props = {
  amount: number;
  instruction: {
    type?: string;
    label?: string;
    accountName?: string;
    accountNumber?: string;
    bankName?: string;
    qrisImageUrl?: string;
    note?: string;
  } | null;
};

export function PaymentInstructionCard({ amount, instruction }: Props) {
  if (!instruction) {
    return (
      <section className="mt-6 rounded-[1.5rem] border border-outline-variant bg-white p-5 text-[#111827]">
        <p className="font-semibold">Instruksi pembayaran sedang disiapkan.</p>
        <p className="mt-1 text-sm">Admin Rumah Keripik akan membantu konfirmasi pembayaran.</p>
      </section>
    );
  }

  const isCod = instruction.type === 'cod';
  const isQris = instruction.type === 'qris';

  return (
    <section className="mt-6 rounded-[1.5rem] border border-[#e5e7eb] bg-[#f7f7f8] p-5 text-[#111827]">
      <p className="text-sm font-medium text-[#6b7280]">Instruksi pembayaran</p>
      <h2 className="mt-2 text-2xl font-semibold tracking-[-0.03em]">{instruction.label || 'Pembayaran Manual'}</h2>
      <p className="mt-2 text-sm text-[#6b7280]">Pembayaran akan dicek manual oleh admin sebelum pesanan diproses.</p>
      <div className="mt-4 rounded-2xl bg-[#111827] p-4 text-white">
        <p className="text-sm text-white/70">Nominal yang harus dibayar</p>
        <p className="text-3xl font-semibold tracking-[-0.03em]">{formatRupiah(amount)}</p>
      </div>

      {!isCod && (
        <div className="mt-4 grid gap-3 md:grid-cols-2">
          {instruction.bankName && <Info label="Bank" value={instruction.bankName} />}
          {instruction.accountName && <Info label="Nama" value={instruction.accountName} />}
          {instruction.accountNumber && <Info label="Nomor" value={instruction.accountNumber} copy />}
        </div>
      )}

      {isQris && instruction.qrisImageUrl && (
        <div className="mt-4 rounded-2xl bg-white p-4 text-center">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={instruction.qrisImageUrl} alt="QRIS Rumah Keripik" className="mx-auto max-h-72 rounded-xl object-contain" />
          <p className="mt-3 text-sm text-[#6b7280]">Scan QRIS, masukkan nominal sesuai total, lalu upload bukti pembayaran.</p>
        </div>
      )}

      <ul className="mt-4 space-y-2 text-sm text-[#6b7280]">
        <li>1. Pastikan nominal sesuai total di atas.</li>
        <li>2. Simpan screenshot bukti pembayaran.</li>
        <li>3. Upload bukti agar admin bisa cek pembayaran.</li>
        {isCod && <li>4. COD menunggu persetujuan admin sebelum pesanan diproses.</li>}
      </ul>
      {instruction.note && <p className="mt-4 rounded-2xl bg-white p-3 text-sm text-[#6b7280]">{instruction.note}</p>}
    </section>
  );
}

function Info({ label, value, copy = false }: { label: string; value: string; copy?: boolean }) {
  return (
    <div className="rounded-2xl bg-white p-4">
      <p className="text-xs font-medium text-[#6b7280]">{label}</p>
      <div className="mt-1 flex items-center justify-between gap-2">
        <p className="break-all text-lg font-semibold">{value}</p>
        {copy && <CopyTextButton value={value} />}
      </div>
    </div>
  );
}
