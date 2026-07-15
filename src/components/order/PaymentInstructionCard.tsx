import { formatRupiah } from '@/lib/utils';
import { CopyTextButton } from './CopyTextButton';

type Props = {
  amount: number;
  instruction: {
    type?: string;
    label?: string;
    provider?: string;
    accountName?: string;
    accountNumber?: string;
    bankName?: string;
    qrisImageUrl?: string;
    paymentUrl?: string;
    qrCodeUrl?: string;
    reference?: string;
    unavailable?: boolean;
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
  const isDuitku = instruction.provider === 'duitku';
  const isMidtrans = instruction.provider === 'midtrans';
  const isGateway = isDuitku || isMidtrans;

  return (
    <section className="mt-6 rounded-[1.5rem] border border-[#e5e7eb] bg-[#f7f7f8] p-5 text-[#111827]">
      <p className="text-sm font-medium text-[#6b7280]">Instruksi pembayaran</p>
      <h2 className="mt-2 text-2xl font-semibold tracking-[-0.03em]">{instruction.label || 'Pembayaran Manual'}</h2>
      <p className="mt-2 text-sm text-[#6b7280]">
        {isCod
          ? 'Pesanan COD akan dicek admin sebelum diproses.'
          : isMidtrans
            ? 'Pembayaran online otomatis memakai Midtrans QRIS. Scan QR code di bawah menggunakan e-wallet atau e-banking Anda.'
            : isDuitku
              ? 'Pembayaran online memakai Duitku. Pilih channel transfer, QRIS, atau e-wallet di halaman checkout.'
              : 'Instruksi pembayaran sedang disiapkan.'}
      </p>
      <div className="mt-4 rounded-2xl bg-[#111827] p-4 text-white">
        <p className="text-sm text-white/70">Nominal yang harus dibayar</p>
        <p className="text-3xl font-semibold tracking-[-0.03em]">{formatRupiah(amount)}</p>
      </div>

      {isGateway && (
        <div className="mt-4 rounded-2xl bg-white p-4">
          {instruction.reference && <p className="text-sm text-[#6b7280]">Referensi Pembayaran: <span className="font-medium text-[#111827]">{instruction.reference}</span></p>}
          
          {isMidtrans && instruction.qrCodeUrl && (
            <div className="mt-4 text-center">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={instruction.qrCodeUrl} alt="QRIS Midtrans" className="mx-auto max-h-72 rounded-xl object-contain border border-[#e5e7eb] p-2" />
              <p className="mt-3 text-xs text-[#6b7280]">Pindai dengan GoPay, ShopeePay, DANA, OVO, LinkAja, atau Mobile Banking.</p>
            </div>
          )}

          {isDuitku && instruction.paymentUrl && !instruction.unavailable && (
            <a
              href={instruction.paymentUrl}
              className="mt-3 inline-flex rounded-2xl bg-[#111827] px-5 py-3 font-medium text-white transition hover:bg-[#374151]"
            >
              Lanjut bayar sekarang
            </a>
          )}
          {instruction.unavailable && (
            <p className="mt-3 rounded-2xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-800">
              Link pembayaran online belum siap. Coba refresh halaman ini beberapa saat lagi atau hubungi admin Rumah Keripik.
            </p>
          )}
        </div>
      )}

      {!isCod && !isGateway && (
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
          <p className="mt-3 text-sm text-[#6b7280]">Scan QRIS dan masukkan nominal sesuai total pesanan.</p>
        </div>
      )}

      <ul className="mt-4 space-y-2 text-sm text-[#6b7280]">
        <li>1. Pastikan nominal sesuai total di atas.</li>
        {!isCod && isMidtrans && <li>2. Pindai kode QRIS di atas untuk membayar langsung.</li>}
        {!isCod && isMidtrans && <li>3. Setelah berhasil dibayar, status pesanan akan terupdate otomatis.</li>}
        {!isCod && isDuitku && <li>2. Pilih channel pembayaran di halaman Duitku.</li>}
        {!isCod && isDuitku && <li>3. Setelah berhasil dibayar, status pesanan akan terupdate otomatis.</li>}
        {isCod && <li>2. COD menunggu persetujuan admin sebelum pesanan diproses.</li>}
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
