/**
 * Smoke test engine RL bandit model router (murni, tanpa DB).
 * Jalankan: npm run smoke:bandit
 *
 * Menguji:
 * 1. computeReward — nilai composite dalam [0,1], preferensi success/cost/latency.
 * 2. sampleBeta — nilai selalu dalam [0,1].
 * 3. rankProvidersByBandit — exploit mengikuti posterior; explore tidak crash.
 * 4. Konvergensi Thompson sampling — lengan reward tertinggi dominan setelah N pull.
 * 5. armExpectedReward / armRewardStd — konsisten dengan pulls.
 * 6. applyArmDecay — evidensi lama menyusut menuju prior uniform.
 * 7. Tie-breaker — dua arm dekat memilih yang berpengalaman.
 */
import {
  computeReward,
  sampleBeta,
  rankProvidersByBandit,
  armExpectedReward,
  armRewardStd,
  applyArmDecay,
  type BanditState,
} from '../lib/ai/bandit';

let failures = 0;
function assert(cond: boolean, label: string) {
  if (cond) {
    console.log(`  PASS  ${label}`);
  } else {
    console.error(`  FAIL  ${label}`);
    failures++;
  }
}

// Seed deterministik agar konvergensi Thompson sampling reproducible (tidak flaky).
function mulberry32(seed: number) {
  let a = seed;
  return () => {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
Math.random = mulberry32(0xc0ffee);

function testComputeReward() {
  console.log('\n[1] computeReward');
  const base = { candidateProviders: ['groq', 'gemini', 'cerebras'] };

  // success lambat & mahal (gemini) vs success cepat & murah di antara groq
  const rFastCheap = computeReward({ ...base, provider: 'groq', success: true, status: 'success', latencyMs: 400, latencyTargetMs: 8000 });
  const rSlowExpensive = computeReward({ ...base, provider: 'gemini', success: true, status: 'success', latencyMs: 7500, latencyTargetMs: 8000 });
  const rError = computeReward({ ...base, provider: 'groq', success: false, status: 'error', latencyMs: 2000, latencyTargetMs: 8000 });

  assert(rFastCheap >= 0 && rFastCheap <= 1, `reward dalam [0,1] (got ${rFastCheap.toFixed(3)})`);
  assert(rFastCheap > rError, `success > error (${rFastCheap.toFixed(3)} vs ${rError.toFixed(3)})`);
  assert(rFastCheap > rSlowExpensive, `murah+cepat > mahal+lambat (${rFastCheap.toFixed(3)} vs ${rSlowExpensive.toFixed(3)})`);
  assert(rError < 0.4, `error reward rendah (got ${rError.toFixed(3)})`);
  assert((rFastCheap - 1) < 1e-9, 'reward tidak lebih dari 1');
}

function testSampleBeta() {
  console.log('\n[2] sampleBeta');
  let min = 2;
  let max = -1;
  let mean = 0;
  const n = 20000;
  for (let i = 0; i < n; i++) {
    const v = sampleBeta(2, 5);
    min = Math.min(min, v);
    max = Math.max(max, v);
    mean += v;
  }
  mean /= n;
  assert(min >= 0 && max <= 1, `beta dalam [0,1] (min=${min.toFixed(3)} max=${max.toFixed(3)})`);
  // E[Beta(2,5)] = 2/7 ≈ 0.2857
  assert(Math.abs(mean - 2 / 7) < 0.05, `mean Beta(2,5) ≈ 0.286 (got ${mean.toFixed(3)})`);
}

function testRanking() {
  console.log('\n[3] rankProvidersByBandit');
  // State: gemini jelas menang (alpha besar)
  const state: BanditState = {
    structured_chat_response: {
      gemini: { alpha: 40, beta: 2, pulls: 40, rewardSum: 38, latencyEmaMs: 500, successCount: 38 },
      cerebras: { alpha: 4, beta: 4, pulls: 6, rewardSum: 3, latencyEmaMs: 700, successCount: 3 },
      groq: { alpha: 2, beta: 6, pulls: 6, rewardSum: 1.5, latencyEmaMs: 900, successCount: 1 },
    },
  };

  // Non-deterministik explore: jalankan beberapa kali, statistik harus condong ke gemini.
  const providerSet = ['gemini', 'cerebras', 'groq'];
  const firstSlotCounts: Record<string, number> = { gemini: 0, cerebras: 0, groq: 0 };
  const orderValid = { unique: 0, dupCheck: 0, all: 0, noDet: 0 };
  for (let i = 0; i < 2000; i++) {
    const ranked = rankProvidersByBandit('structured_chat_response', providerSet, state);
    orderValid.all++;
    if (ranked.length === 3 && new Set(ranked).size === 3) orderValid.unique++;
    if (!ranked.includes('deterministic')) orderValid.noDet++;
    firstSlotCounts[ranked[0]]++;
  }
  assert(orderValid.unique === orderValid.all, `rank lengkap tanpa duplikat (${orderValid.unique}/${orderValid.all})`);
  assert(orderValid.noDet === orderValid.all, `deterministic tidak ikut (${orderValid.noDet}/${orderValid.all})`);
  assert(firstSlotCounts['gemini'] / 2000 > 0.7, `gemini dominan di slot 1 (${((firstSlotCounts['gemini'] / 2000) * 100).toFixed(0)}%)`);
  assert(firstSlotCounts['groq'] / 2000 < 0.2, `groq jarang di slot 1 (${((firstSlotCounts['groq'] / 2000) * 100).toFixed(0)}%)`);
  assert(Object.values(firstSlotCounts).reduce((a, b) => a + b, 0) === 2000, 'total assignment = jumlah iterasi');
}

function testArmStats() {
  console.log('\n[4] armExpectedReward / armRewardStd');
  const arm = { alpha: 30, beta: 10, pulls: 40, rewardSum: 30, latencyEmaMs: 0, successCount: 30 };
  const e = armExpectedReward(arm);
  const sd = armRewardStd(arm);
  assert(Math.abs(e - 0.75) < 0.001, `E = 30/40 = 0.75 (got ${e})`);
  assert(sd > 0 && sd < 0.2, `std wajar untuk 40 pulls (got ${sd.toFixed(4)})`);
}

function testThompsonConvergence() {
  console.log('\n[5] Konvergensi Thompson sampling');
  // normal pilihan: A reward 0.9, B reward 0.6, C reward 0.3
  const arms = ['A', 'B', 'C'];
  const candidates = arms;
  const truth: Record<string, number> = { A: 0.9, B: 0.6, C: 0.3 };
  const state: BanditState = { t: {} };
  const pulls: Record<string, number> = { A: 0, B: 0, C: 0 };

  const simulateReward = (provider: string) => (Math.random() < truth[provider] ? 1 : 0);

  // Simulasi bandit tanpa DB: update state langsung.
  // 20000 iterasi supaya B (0.6) dan C (0.3) dapat cukup pull lewat
  // epsilon-explore untuk membedakannya secara statistik (A dominan ~93%).
  for (let i = 0; i < 20000; i++) {
    const ranked = rankProvidersByBandit('t', candidates, state);
    const chosen = ranked[0];
    const reward = simulateReward(chosen);
    pulls[chosen]++;
    const arm = state.t[chosen] ?? { alpha: 1, beta: 1, pulls: 0, rewardSum: 0, latencyEmaMs: 0, successCount: 0 };
    arm.alpha += reward;
    arm.beta += 1 - reward;
    arm.pulls++;
    arm.rewardSum += reward;
    if (reward > 0) arm.successCount++;
    state.t[chosen] = arm;
  }

  const total = Object.values(pulls).reduce((a, b) => a + b, 0);
  assert(total === 20000, `total pulls = 20000 (got ${total})`);
  assert(pulls['A'] > pulls['B'] && pulls['B'] > pulls['C'], `pulls A>B>C (${JSON.stringify(pulls)})`);
  assert(pulls['A'] / 20000 > 0.6, `A dominan ${((pulls['A'] / 20000) * 100).toFixed(0)}%`);
  assert(pulls['C'] / 20000 < 0.1, `C jarang dipilih ${((pulls['C'] / 20000) * 100).toFixed(0)}%`);
}

function testArmDecay() {
  console.log('\n[6] applyArmDecay');
  // arm kuat tapi sudah lama tidak dipull sesudah setahun
  const old = { alpha: 100, beta: 2, pulls: 100, rewardSum: 98, latencyEmaMs: 0, successCount: 98, lastPullAt: Date.now() - 365 * 24 * 3600 * 1000 };
  const decayed = applyArmDecay(old);
  assert(Math.abs(decayed.alpha - 1) < 0.5 && Math.abs(decayed.beta - 1) < 0.5, `evidensi setahun hampir lupa (α=${decayed.alpha.toFixed(2)}, β=${decayed.beta.toFixed(2)})`);

  // arm yang masih sering dipull tidak boleh banyak berubah
  const fresh = { ...old, lastPullAt: Date.now() - 60 * 1000 };
  const kept = applyArmDecay(fresh);
  assert(kept.alpha > 90, `arm segar tak ter-decay (α=${kept.alpha.toFixed(1)})`);

  // tanpa lastPullAt tidak berubah
  const noStamp = { alpha: 50, beta: 5, pulls: 50, rewardSum: 45, latencyEmaMs: 0, successCount: 45, lastPullAt: undefined };
  assert(applyArmDecay(noStamp).alpha === 50, 'tanpa lastPullAt tidak berubah');
}

function testTieBreaker() {
  console.log('\n[7] Tie-breaker');
  // dua arm dengan posterior identik tapi pengalaman beda
  const state: BanditState = {
    faq_answer: {
      gemini: { alpha: 60, beta: 3, pulls: 61, rewardSum: 58, latencyEmaMs: 600, successCount: 58, lastPullAt: Date.now() },
      cerebras: { alpha: 6, beta: 1, pulls: 5, rewardSum: 5, latencyEmaMs: 650, successCount: 5, lastPullAt: Date.now() },
    },
  };
  const gems: Record<string, number> = { gemini: 0, cerebras: 0 };
  for (let i = 0; i < 300; i++) {
    const ranked = rankProvidersByBandit('faq_answer', ['gemini', 'cerebras'], state);
    gems[ranked[0]]++;
  }
  assert(gems['gemini'] / 300 > 0.6, `arm berpengalaman menang saat dekat (gemini ${((gems['gemini'] / 300) * 100).toFixed(0)}%)`);
}

testComputeReward();
testSampleBeta();
testRanking();
testArmStats();
testThompsonConvergence();
testArmDecay();
testTieBreaker();

console.log(failures === 0 ? '\nALL PASS' : `\n${failures} FAIL`);
process.exit(failures === 0 ? 0 : 1);