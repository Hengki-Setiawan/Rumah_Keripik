import { NextResponse } from 'next/server';
import { z } from 'zod';
import { callGroqLLM } from '@/lib/groq';
import { checkRateLimit, getClientIp } from '@/lib/rate-limit';

const AssistantSchema = z.object({
  text: z.string().min(1).max(500),
});

export async function POST(req: Request) {
  const rate = await checkRateLimit(`public-assistant:${getClientIp(req)}`, 20, 60_000);
  if (!rate.ok) return NextResponse.json({ ok: false, error: 'Terlalu banyak pertanyaan. Coba lagi sebentar.' }, { status: 429 });
  const parsed = AssistantSchema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ ok: false, error: 'Pertanyaan tidak valid' }, { status: 400 });

  const deterministic = answerDeterministic(parsed.data.text);
  if (deterministic) return NextResponse.json({ ok: true, source: 'deterministic', answer: deterministic });

  if (!process.env.GROQ_API_KEY && !process.env.GEMINI_API_KEY) {
    return NextResponse.json({ ok: true, source: 'fallback', answer: 'Aku bisa bantu pilih produk, menjelaskan pembayaran, atau cek alur order. Untuk pertanyaan detail, pilih produk dulu atau hubungi admin Rumah Keripik.' });
  }

  try {
    const result = await callGroqLLM([
      { role: 'user', content: parsed.data.text },
    ], 220, 0.2, [
      'Kamu adalah asisten public ordering Rumah Keripik.',
      'Jawab singkat dalam Bahasa Indonesia.',
      'Boleh bantu rekomendasi umum, cara order, cara bayar manual, QRIS, COD, dan upload bukti.',
      'Jangan membuat order, jangan mengubah stok/harga, jangan klaim pembayaran valid, jangan meminta data sensitif.',
      'Arahkan user memakai tombol/form di halaman untuk tindakan transaksi.',
    ].join(' '));
    return NextResponse.json({ ok: true, source: result.provider, answer: result.text });
  } catch {
    return NextResponse.json({ ok: true, source: 'fallback', answer: 'Maaf, asisten sedang terbatas. Kamu tetap bisa pilih produk, isi alamat, pilih metode pembayaran, lalu upload bukti setelah bayar.' });
  }
}

function answerDeterministic(text: string) {
  const lower = text.toLowerCase();
  if (/bayar|transfer|qris|bukti/.test(lower)) return 'Pembayaran Rumah Keripik memakai transfer/QRIS/e-wallet manual. Setelah bayar sesuai nominal, upload screenshot bukti agar admin bisa verifikasi.';
  if (/cod|bayar di tempat/.test(lower)) return 'COD bisa dipilih jika aktif. Order COD akan menunggu persetujuan admin sebelum diproses.';
  if (/stok|harga|produk|varian|rasa/.test(lower)) return 'Stok dan harga yang tampil di kartu produk berasal dari dashboard. Pilih varian di kartu produk untuk melihat harga dan stoknya.';
  if (/alamat|kirim|ongkir|lokasi/.test(lower)) return 'Isi alamat lengkap dan patokan. Kamu juga bisa pakai tombol ambil titik lokasi jika browser mengizinkan.';
  return null;
}
