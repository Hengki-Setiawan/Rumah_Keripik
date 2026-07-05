import { config } from 'dotenv';

config({ path: '.env.local' });

async function main() {
  const { processWorkerBatch } = await import('@/lib/worker-runner');
  const result = await processWorkerBatch(`smoke-worker-${Date.now()}`, 3);
  console.log(JSON.stringify({ ok: true, ...result }, null, 2));
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
