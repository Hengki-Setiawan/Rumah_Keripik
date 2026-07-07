const groups = [
  { title: 'Admin Setup', items: ['Login admin', 'Buat kategori produk', 'Buat produk dengan gambar', 'Buat varian dengan gambar', 'Buat metode bank/QRIS/e-wallet/COD'] },
  { title: 'Public Order', items: ['Buka /pesan tanpa login', 'Pilih kategori/produk/varian', 'Pastikan payment min/max bekerja', 'Checkout dan pastikan URL sukses punya token', 'Upload bukti bayar'] },
  { title: 'Worker & Verification', items: ['Panggil /api/cron/worker dengan secret', 'Buka queue verifikasi', 'Cek OCR/duplicate panel', 'Reject dan cek alasan di status customer', 'Reupload lalu approve'] },
  { title: 'Documents & Ops', items: ['Buka proforma', 'Buka receipt setelah approve', 'Buka packing label', 'Print dan cek nomor dokumen', 'Cek /web-sessions dan /failed-conversations'] },
  { title: 'Deployment', items: ['Cek /api/admin/deployment-health', 'Pastikan CRON_SECRET ada', 'Run npx tsc --noEmit', 'Run npm run build', 'Backup Turso sebelum deploy'] },
];

export default function OpsSmokePage() {
  return (
    <div className="space-y-6">
      <div><h1 className="font-headline-lg text-headline-lg text-on-surface">Operational Smoke Checklist</h1><p className="text-on-surface-variant">Checklist ringkas sebelum staging/production. Dokumen lengkap ada di SMOKE_TEST.md.</p></div>
      <div className="grid gap-4 md:grid-cols-2">
        {groups.map((group) => (
          <section key={group.title} className="rounded-2xl border border-outline-variant bg-white p-5">
            <h2 className="text-xl font-semibold tracking-[-0.02em]">{group.title}</h2>
            <div className="mt-4 space-y-2">
              {group.items.map((item) => <label key={item} className="flex items-center gap-3 rounded-xl bg-neutral-50 p-3 text-sm font-medium"><input type="checkbox" className="h-4 w-4" /> {item}</label>)}
            </div>
          </section>
        ))}
      </div>
    </div>
  );
}
