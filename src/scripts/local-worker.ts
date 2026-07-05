import fs from 'fs';
import os from 'os';
import path from 'path';

function loadEnvLocal() {
  const envPath = path.join(process.cwd(), '.env.local');
  if (!fs.existsSync(envPath)) return;

  const content = fs.readFileSync(envPath, 'utf8');
  for (const line of content.split('\n')) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('#')) continue;
    const index = trimmed.indexOf('=');
    if (index <= 0) continue;
    const key = trimmed.slice(0, index).trim();
    const value = trimmed.slice(index + 1).trim();
    process.env[key] = value;
  }
}

function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function main() {
  loadEnvLocal();

  const workerId = process.env.WORKER_ID || `local-${os.hostname()}-${process.pid}`;
  const pollMs = Number(process.env.WORKER_POLL_MS || 5000);

  const { claimNextJob, completeJob, failJob, heartbeat } = await import('../lib/worker-queue');
    const { learnFromInteraction } = await import('../lib/memory-engine');
    const { geocodeAddress } = await import('../lib/geocoding');
    const { analyzePaymentProof } = await import('../lib/payment-ocr');
    const { savePaymentOcrResult } = await import('../lib/payment-ocr-results');
    const { db } = await import('../lib/db');
    const { outboundMessageQueue } = await import('../lib/schema');

  console.log(`[worker] started: ${workerId}`);

  while (true) {
    await heartbeat(workerId, { pid: process.pid, host: os.hostname() });

    const job = await claimNextJob(workerId);
    if (!job) {
      await sleep(pollMs);
      continue;
    }

    console.log(`[worker] job #${job.id} ${job.type}`);

    try {
      const payload = JSON.parse(job.payload_json || '{}');

      if (job.type === 'ai_learn') {
        await learnFromInteraction(
          payload.trigger_pattern || payload.user_message || 'unknown',
          payload.response_template || payload.bot_response || '',
          payload.rating,
        );
        await completeJob(job.id, { learned: true });
        continue;
      }

      if (job.type === 'geocode_address') {
        const result = await geocodeAddress(payload.address || payload.query || '');
        await completeJob(job.id, { result });
        continue;
      }

      if (job.type === 'payment_proof_ocr_assist') {
        const result = await analyzePaymentProof(payload);
        await savePaymentOcrResult(result, job.id);
        await completeJob(job.id, result);
        continue;
      }

      if (job.type === 'send_outbound_message') {
        const recipientId = String(payload.recipientId || '');
        const messageText = String(payload.messageText || '');
        if (!recipientId || !messageText) throw new Error('recipientId dan messageText wajib ada');
        await db.insert(outboundMessageQueue).values({
          channel: payload.channel === 'telegram' ? 'telegram' : 'wa',
          recipient_id: recipientId,
          message_text: messageText,
          status: 'pending',
        });
        await completeJob(job.id, { queued: true, recipientId, channel: payload.channel || 'wa' });
        continue;
      }

      await completeJob(job.id, { skipped: true, reason: `Unknown job type: ${job.type}` });
    } catch (error) {
      console.error(`[worker] job #${job.id} failed:`, error);
      await failJob(job.id, error);
    }
  }
}

main().catch((error) => {
  console.error('[worker] fatal:', error);
  process.exit(1);
});
