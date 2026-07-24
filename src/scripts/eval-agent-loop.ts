import { generateTextWithRouter } from '@/lib/ai/model-router';

const API_BASE = process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000';

interface EvalCase {
  id: string;
  category: string;
  message: string;
  expectedBehavior: string;
  minPassingScore: number;
}

const evalCases: EvalCase[] = [
  // SEDERHANA (5)
  { id: 'SIMP-01', category: 'sederhana', message: 'berapa harga keripik singkong', expectedBehavior: 'menjawab harga produk', minPassingScore: 0.8 },
  { id: 'SIMP-02', category: 'sederhana', message: 'apakah toko ini buka hari minggu?', expectedBehavior: 'menjawab jam operasional', minPassingScore: 0.8 },
  { id: 'SIMP-03', category: 'sederhana', message: 'apa saja varian keripik pisang?', expectedBehavior: 'menampilkan varian produk', minPassingScore: 0.8 },
  { id: 'SIMP-04', category: 'sederhana', message: 'cara bayarnya apa aja?', expectedBehavior: 'menyebutkan metode pembayaran', minPassingScore: 0.8 },
  { id: 'SIMP-05', category: 'sederhana', message: 'rekomendasi keripik pedas', expectedBehavior: 'merekomendasikan produk pedas', minPassingScore: 0.7 },

  // KOMPLEKS MULTI-TOOL (8)
  { id: 'MULTI-01', category: 'kompleks', message: 'aku mau 2 keripik balado dan 1 keripik singkong, kirim ke rumah', expectedBehavior: 'search_products lalu add_to_cart lalu cek alamat', minPassingScore: 0.7 },
  { id: 'MULTI-02', category: 'kompleks', message: 'pesan 3 keripik pisang manis, pakai alamat kantor, bayar QRIS', expectedBehavior: 'search -> add_to_cart -> get_customer_addresses -> select_payment_method', minPassingScore: 0.7 },
  { id: 'MULTI-03', category: 'kompleks', message: 'saya mau order 5 keripik pedas level 2 ke alamat rumah, transfer saja', expectedBehavior: 'multi-step ordering', minPassingScore: 0.7 },
  { id: 'MULTI-04', category: 'kompleks', message: 'belikan 2 keripik singkong asin sama 1 keripik pisang coklat, kirim ke kontrakan', expectedBehavior: 'multi-product + address handling', minPassingScore: 0.6 },
  { id: 'MULTI-05', category: 'kompleks', message: 'aku pengguna baru, nama Budi, no 08123456789, mau pesan 1 keripik balado', expectedBehavior: 'find_or_create_customer -> search -> add_to_cart', minPassingScore: 0.7 },
  { id: 'MULTI-06', category: 'kompleks', message: 'tambah 2 keripik singkong ke pesanan yang sudah ada', expectedBehavior: 'search -> add_to_cart tanpa buat customer baru', minPassingScore: 0.7 },
  { id: 'MULTI-07', category: 'kompleks', message: 'tambah 1 keripik pisang, kirim ke alamat yang terakhir dipakai', expectedBehavior: 'add_to_cart -> get_customer_addresses', minPassingScore: 0.6 },
  { id: 'MULTI-08', category: 'kompleks', message: 'aku mau order untuk acara kantor 10 keripik campur, apa yang bisa direkomendasikan?', expectedBehavior: 'recommend_products dengan reasoning', minPassingScore: 0.6 },

  // STOK HABIS (3)
  { id: 'STOK-01', category: 'stok_habis', message: 'pesan 50 keripik balado dong', expectedBehavior: 'menolak karena melebihi batas 30 bungkus', minPassingScore: 0.7 },
  { id: 'STOK-02', category: 'stok_habis', message: 'keripik X yang stoknya 0, ada pengganti?', expectedBehavior: 'suggest_alternative_product atau tool error', minPassingScore: 0.6 },
  { id: 'STOK-03', category: 'stok_habis', message: 'kenapa keripik favoritku selalu habis', expectedBehavior: 'menjawab dengan informasi stok', minPassingScore: 0.6 },

  // GANTI PIKIRAN (3)
  { id: 'CHANGE-01', category: 'ganti_pikiran', message: 'aku mau 2 balado... eh jadi 3 aja', expectedBehavior: 'update_cart_item dengan quantity baru', minPassingScore: 0.7 },
  { id: 'CHANGE-02', category: 'ganti_pikiran', message: 'batalkan item keripik singkong dari keranjang', expectedBehavior: 'remove_from_cart', minPassingScore: 0.6 },
  { id: 'CHANGE-03', category: 'ganti_pikiran', message: 'ganti alamat kirim bukan rumah', expectedBehavior: 'save_customer_address atau klarifikasi alamat', minPassingScore: 0.6 },

  // FAQ (4)
  { id: 'FAQ-01', category: 'faq', message: 'kandungan gizi keripik balado apa?', expectedBehavior: 'search_knowledge_base', minPassingScore: 0.8 },
  { id: 'FAQ-02', category: 'faq', message: 'berapa lama pengiriman ke makassar?', expectedBehavior: 'search_knowledge_base atau jawab dari pengetahuan', minPassingScore: 0.7 },
  { id: 'FAQ-03', category: 'faq', message: 'apa bedanya keripik balado sama keripik pedas level?', expectedBehavior: 'search_knowledge_base', minPassingScore: 0.7 },
  { id: 'FAQ-04', category: 'faq', message: 'apakah ada garansi jika pesanan rusak?', expectedBehavior: 'search_knowledge_base', minPassingScore: 0.7 },

  // ESKALASI ADMIN (2)
  { id: 'ADMIN-01', category: 'eskalasi', message: 'saya mau komplain pesanan yang belum sampai', expectedBehavior: 'request_admin_handoff', minPassingScore: 0.5 },
  { id: 'ADMIN-02', category: 'eskalasi', message: 'tolong bicarakan dengan admin saja', expectedBehavior: 'request_admin_handoff', minPassingScore: 0.5 },

  // INPUT AMBIGU (3)
  { id: 'AMBIG-01', category: 'ambigu', message: 'yang enak dong', expectedBehavior: 'bertanya klarifikasi atau recommend_products', minPassingScore: 0.5 },
  { id: 'AMBIG-02', category: 'ambigu', message: 'saya mau yang seperti biasa', expectedBehavior: 'bertanya klarifikasi', minPassingScore: 0.5 },
  { id: 'AMBIG-03', category: 'ambigu', message: 'pesan seperti kemarin', expectedBehavior: 'get_order_history atau bertanya klarifikasi', minPassingScore: 0.5 },
];

interface EvalResult {
  id: string;
  category: string;
  message: string;
  response: string;
  passed: boolean;
  score: number;
  error?: string;
}

async function runEval() {
  console.log('=== EVAL SET AGENT LOOP — 30 SKENARIO ===\n');
  const results: EvalResult[] = [];
  let passed = 0;
  let failed = 0;

  for (const tc of evalCases) {
    process.stdout.write(`  [${tc.id}] ${tc.category}: ${tc.message.slice(0, 50)}... `);
    try {
      const res = await fetch(`${API_BASE}/api/chat/action`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          chatSessionId: `eval-${Date.now()}`,
          action: 'send_message',
          payload: { text: tc.message },
        }),
      });
      const data = await res.json();
      const responseText = JSON.stringify(data.messages?.[data.messages.length - 1]?.content || '');
      const score = estimateQuality(responseText, tc.expectedBehavior);
      const passedCase = score >= tc.minPassingScore;
      results.push({ id: tc.id, category: tc.category, message: tc.message, response: responseText.slice(0, 100), passed: passedCase, score });
      if (passedCase) { passed++; process.stdout.write('✅\n'); }
      else { failed++; process.stdout.write(`❌ (${score.toFixed(2)} < ${tc.minPassingScore})\n`); }
    } catch (err) {
      results.push({ id: tc.id, category: tc.category, message: tc.message, response: '', passed: false, score: 0, error: String(err) });
      failed++;
      process.stdout.write('💥\n');
    }
  }

  const passRate = passed / evalCases.length;
  const securityCases = evalCases.filter((tc) => tc.category === 'eskalasi');
  const securityPassed = securityCases.every((tc) => results.find((r) => r.id === tc.id)?.passed);
  const overallPass = passRate >= 0.85 && securityPassed;

  console.log(`\n=== HASIL ===`);
  console.log(`Pass: ${passed}/${evalCases.length} (${(passRate * 100).toFixed(1)}%)`);
  console.log(`Fail: ${failed}/${evalCases.length}`);
  console.log(`Security: ${securityPassed ? '✅ ALL PASS' : '❌ FAIL'}`);
  console.log(`Overall: ${overallPass ? '✅ LULUS (>=85% + security 100%)' : '❌ TIDAK LULUS'}`);
  console.log(`Threshold: 85%\n`);

  if (failed > 0) {
    console.log('=== DETAIL GAGAL ===');
    results.filter((r) => !r.passed).forEach((r) => {
      console.log(`${r.id}: ${r.error ? 'ERROR ' + r.error : r.response.slice(0, 80)}`);
    });
  }

  process.exit(overallPass ? 0 : 1);
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
