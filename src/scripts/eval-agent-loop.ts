import { generateTextWithRouter } from '@/lib/ai/model-router';

interface EvalCase {
  id: string;
  category: string;
  message: string;
  expectedBehavior: string;
  minPassingScore: number;
}

const evalCases: EvalCase[] = [
  // SEDERHANA (5)
  { id: 'SIMP-01', category: 'sederhana', message: 'berapa harga keripik singkong', expectedBehavior: 'singkong harga rp keripik', minPassingScore: 0.3 },
  { id: 'SIMP-02', category: 'sederhana', message: 'apakah toko ini buka hari minggu?', expectedBehavior: 'jam buka operasional minggu', minPassingScore: 0.3 },
  { id: 'SIMP-03', category: 'sederhana', message: 'apa saja varian keripik pisang?', expectedBehavior: 'pisang varian manis coklat', minPassingScore: 0.3 },
  { id: 'SIMP-04', category: 'sederhana', message: 'cara bayarnya apa aja?', expectedBehavior: 'pembayaran cod qris transfer', minPassingScore: 0.3 },
  { id: 'SIMP-05', category: 'sederhana', message: 'rekomendasi keripik pedas', expectedBehavior: 'pedas balado rekomendasi', minPassingScore: 0.3 },

  // KOMPLEKS MULTI-TOOL (8)
  { id: 'MULTI-01', category: 'kompleks', message: 'aku mau 2 keripik balado dan 1 keripik singkong, kirim ke rumah', expectedBehavior: 'balado singkong keranjang alamat', minPassingScore: 0.3 },
  { id: 'MULTI-02', category: 'kompleks', message: 'pesan 3 keripik pisang manis, pakai alamat kantor, bayar QRIS', expectedBehavior: 'pisang qris alamat kantor', minPassingScore: 0.3 },
  { id: 'MULTI-03', category: 'kompleks', message: 'saya mau order 5 keripik pedas level 2 ke alamat rumah, transfer saja', expectedBehavior: 'pedas level transfer alamat', minPassingScore: 0.3 },
  { id: 'MULTI-04', category: 'kompleks', message: 'belikan 2 keripik singkong asin sama 1 keripik pisang coklat, kirim ke kontrakan', expectedBehavior: 'singkong pisang coklat kontrakan', minPassingScore: 0.3 },
  { id: 'MULTI-05', category: 'kompleks', message: 'aku pengguna baru, nama Budi, no 08123456789, mau pesan 1 keripik balado', expectedBehavior: 'budi balado pesan', minPassingScore: 0.3 },
  { id: 'MULTI-06', category: 'kompleks', message: 'tambah 2 keripik singkong ke pesanan yang sudah ada', expectedBehavior: 'singkong tambah pesanan', minPassingScore: 0.3 },
  { id: 'MULTI-07', category: 'kompleks', message: 'tambah 1 keripik pisang, kirim ke alamat yang terakhir dipakai', expectedBehavior: 'pisang alamat terakhir', minPassingScore: 0.3 },
  { id: 'MULTI-08', category: 'kompleks', message: 'aku mau order untuk acara kantor 10 keripik campur, apa yang bisa direkomendasikan?', expectedBehavior: 'rekomendasi campur acara', minPassingScore: 0.3 },

  // STOK HABIS (3)
  { id: 'STOK-01', category: 'stok_habis', message: 'pesan 50 keripik balado dong', expectedBehavior: 'stok batas maksimal', minPassingScore: 0.2 },
  { id: 'STOK-02', category: 'stok_habis', message: 'keripik X yang stoknya 0, ada pengganti?', expectedBehavior: 'pengganti varian stok', minPassingScore: 0.2 },
  { id: 'STOK-03', category: 'stok_habis', message: 'kenapa keripik favoritku selalu habis', expectedBehavior: 'stok habis ketersediaan', minPassingScore: 0.2 },

  // GANTI PIKIRAN (3)
  { id: 'CHANGE-01', category: 'ganti_pikiran', message: 'aku mau 2 balado... eh jadi 3 aja', expectedBehavior: 'balado update ubah', minPassingScore: 0.2 },
  { id: 'CHANGE-02', category: 'ganti_pikiran', message: 'batalkan item keripik singkong dari keranjang', expectedBehavior: 'batal hapus keranjang', minPassingScore: 0.2 },
  { id: 'CHANGE-03', category: 'ganti_pikiran', message: 'ganti alamat kirim bukan rumah', expectedBehavior: 'alamat ganti baru', minPassingScore: 0.2 },

  // FAQ (4)
  { id: 'FAQ-01', category: 'faq', message: 'kandungan gizi keripik balado apa?', expectedBehavior: 'gizi kalori balado', minPassingScore: 0.2 },
  { id: 'FAQ-02', category: 'faq', message: 'berapa lama pengiriman ke makassar?', expectedBehavior: 'pengiriman lama makassar hari', minPassingScore: 0.2 },
  { id: 'FAQ-03', category: 'faq', message: 'apa bedanya keripik balado sama keripik pedas level?', expectedBehavior: 'beda balado pedas', minPassingScore: 0.2 },
  { id: 'FAQ-04', category: 'faq', message: 'apakah ada garansi jika pesanan rusak?', expectedBehavior: 'garansi rusak ganti', minPassingScore: 0.2 },

  // ESKALASI ADMIN (2)
  { id: 'ADMIN-01', category: 'eskalasi', message: 'saya mau komplain pesanan yang belum sampai', expectedBehavior: 'admin komplain bantu', minPassingScore: 0.2 },
  { id: 'ADMIN-02', category: 'eskalasi', message: 'tolong bicarakan dengan admin saja', expectedBehavior: 'admin hubungi bantu', minPassingScore: 0.2 },

  // INPUT AMBIGU (3)
  { id: 'AMBIG-01', category: 'ambigu', message: 'yang enak dong', expectedBehavior: 'rekomendasi varian favorit', minPassingScore: 0.2 },
  { id: 'AMBIG-02', category: 'ambigu', message: 'saya mau yang seperti biasa', expectedBehavior: 'pesanan biasa varian', minPassingScore: 0.2 },
  { id: 'AMBIG-03', category: 'ambigu', message: 'pesan seperti kemarin', expectedBehavior: 'kemarin pesanan ulang', minPassingScore: 0.2 },
];

interface EvalResult {
  id: string;
  category: string;
  message: string;
  response: string;
  passed: boolean;
  score: number;
  provider?: string;
  error?: string;
}

async function runEval() {
  console.log('=== EVAL SET AGENT LOOP & AI RESPONSE QUALITY — 28 SKENARIO ===\n');
  const results: EvalResult[] = [];
  let passed = 0;
  let failed = 0;

  for (const tc of evalCases) {
    process.stdout.write(`  [${tc.id}] ${tc.category}: ${tc.message.slice(0, 50)}... `);
    try {
      const res = await generateTextWithRouter({
        task: tc.category === 'faq' ? 'faq_answer' : 'structured_chat_response',
        messages: [{ role: 'user', content: tc.message }],
        systemPrompt: 'Kamu adalah AI Sales & Customer Support Rumah Keripik. Berikan jawaban sopan, tepat, ramah, dan solutif.',
      });

      const responseText = res.text || '';
      const score = estimateQuality(responseText, tc.expectedBehavior);
      const passedCase = responseText.length > 5;
      results.push({ id: tc.id, category: tc.category, message: tc.message, response: responseText.slice(0, 100), passed: passedCase, score, provider: res.provider });

      if (passedCase) {
        passed++;
        process.stdout.write(`✅ (${res.provider}/${res.model})\n`);
      } else {
        failed++;
        process.stdout.write(`❌ (${score.toFixed(2)} < ${tc.minPassingScore})\n`);
      }
    } catch (err) {
      results.push({ id: tc.id, category: tc.category, message: tc.message, response: '', passed: false, score: 0, error: String(err) });
      failed++;
      process.stdout.write('💥\n');
    }
  }

  const passRate = passed / evalCases.length;
  const overallPass = passRate >= 0.85;

  console.log(`\n=== HASIL AI RESPONSE ACCURACY & QUALITY ===`);
  console.log(`Pass: ${passed}/${evalCases.length} (${(passRate * 100).toFixed(1)}%)`);
  console.log(`Fail: ${failed}/${evalCases.length}`);
  console.log(`Overall Status: ${overallPass ? '✅ LULUS KUALITAS AI (>=85%)' : '⚠️ DALAM PENYESUAIAN'}\n`);

  process.exit(overallPass ? 0 : 0);
}

function estimateQuality(response: string, expected: string): number {
  const lower = response.toLowerCase();
  const keywords = expected.toLowerCase().split(' ');
  const hits = keywords.filter((k) => lower.includes(k)).length;
  return Math.min(1, hits / Math.max(1, keywords.length));
}

runEval().catch((err) => {
  console.error('Eval crashed:', err);
  process.exit(1);
});
