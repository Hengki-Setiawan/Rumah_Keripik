import { db } from '@/lib/db';
import { analyzePaymentProof } from '@/lib/payment-ocr';
import { geocodeAddress } from '@/lib/geocoding';
import { learnFromInteraction } from '@/lib/memory-engine';
import { completeJob, failJob, claimNextJob, heartbeat } from '@/lib/worker-queue';
import { outboundMessageQueue } from '@/lib/schema';
import { savePaymentOcrResult } from '@/lib/payment-ocr-results';

export async function processWorkerBatch(workerId: string, limit = 5) {
  await heartbeat(workerId, { mode: 'cron-batch', limit });
  const results: Array<{ id: number; type: string; status: 'completed' | 'failed' | 'skipped'; error?: string }> = [];

  for (let i = 0; i < limit; i += 1) {
    const job = await claimNextJob(workerId, 60);
    if (!job) break;

    try {
      const payload = JSON.parse(job.payload_json || '{}');
      if (job.type === 'payment_proof_ocr_assist') {
        const result = await analyzePaymentProof(payload);
        await savePaymentOcrResult(result, job.id);
        await completeJob(job.id, result);
        results.push({ id: job.id, type: job.type, status: 'completed' });
        continue;
      }
      if (job.type === 'geocode_address') {
        const result = await geocodeAddress(payload.address || payload.query || '');
        await completeJob(job.id, { result });
        results.push({ id: job.id, type: job.type, status: 'completed' });
        continue;
      }
      if (job.type === 'ai_learn') {
        await learnFromInteraction(payload.trigger_pattern || payload.user_message || 'unknown', payload.response_template || payload.bot_response || '', payload.rating);
        await completeJob(job.id, { learned: true });
        results.push({ id: job.id, type: job.type, status: 'completed' });
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
        await completeJob(job.id, { queued: true, recipientId });
        results.push({ id: job.id, type: job.type, status: 'completed' });
        continue;
      }

      await completeJob(job.id, { skipped: true, reason: `Unknown job type: ${job.type}` });
      results.push({ id: job.id, type: job.type, status: 'skipped' });
    } catch (error) {
      await failJob(job.id, error);
      results.push({ id: job.id, type: job.type, status: 'failed', error: error instanceof Error ? error.message : String(error) });
    }
  }

  return { processed: results.length, results };
}
