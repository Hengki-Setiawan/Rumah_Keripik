import fs from 'node:fs';
import path from 'node:path';
import { execSync } from 'node:child_process';
import zlib from 'node:zlib';
import { fileURLToPath } from 'node:url';
import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);
const esbuild = require('esbuild');

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const rootDir = path.resolve(__dirname, '..');
const appDir = path.join(rootDir, 'src', 'app');
const stagingDir = path.join(rootDir, '.staging-storefront');

// Folders to isolate away from Admin to keep bundle lean (< 2.0 MiB)
const foldersToIsolate = [
  // Customer storefront
  { src: path.join(appDir, 'pesan'), dest: path.join(stagingDir, 'pesan') },
  { src: path.join(appDir, 'pembayaran'), dest: path.join(stagingDir, 'pembayaran') },
  { src: path.join(appDir, 'dokumen'), dest: path.join(stagingDir, 'dokumen') },
  { src: path.join(appDir, 'api', 'public'), dest: path.join(stagingDir, 'api', 'public') },
  { src: path.join(appDir, 'api', 'chat'), dest: path.join(stagingDir, 'api', 'chat') },
  { src: path.join(appDir, 'api', 'order'), dest: path.join(stagingDir, 'api', 'order') },
  { src: path.join(appDir, 'api', 'tracking'), dest: path.join(stagingDir, 'api', 'tracking') },
  { src: path.join(appDir, 'api', 'webhook'), dest: path.join(stagingDir, 'api', 'webhook') },
  { src: path.join(appDir, 'api', 'customer'), dest: path.join(stagingDir, 'api', 'customer') },
  // Auxiliary & test endpoints
  { src: path.join(appDir, 'api', 'debug'), dest: path.join(stagingDir, 'api', 'debug') },
  { src: path.join(appDir, 'api', 'rag'), dest: path.join(stagingDir, 'api', 'rag') },
  { src: path.join(appDir, 'api', 'mobile'), dest: path.join(stagingDir, 'api', 'mobile') },
  { src: path.join(appDir, 'api', 'identity'), dest: path.join(stagingDir, 'api', 'identity') },
  // Heavy AI playground & ops routes (reduces bundle size by ~800 KB)
  { src: path.join(appDir, '(dashboard)', 'ai-workspace'), dest: path.join(stagingDir, 'ai-workspace') },
  { src: path.join(appDir, '(dashboard)', 'ai-ops'), dest: path.join(stagingDir, 'ai-ops') },
  { src: path.join(appDir, '(dashboard)', 'ai-monitor'), dest: path.join(stagingDir, 'ai-monitor') },
  { src: path.join(appDir, '(dashboard)', 'ai-skills'), dest: path.join(stagingDir, 'ai-skills') },
  { src: path.join(appDir, '(dashboard)', 'failed-conversations'), dest: path.join(stagingDir, 'failed-conversations') },
  { src: path.join(appDir, '(dashboard)', 'feedback-learning'), dest: path.join(stagingDir, 'feedback-learning') },
  { src: path.join(appDir, '(dashboard)', 'ops-smoke'), dest: path.join(stagingDir, 'ops-smoke') },
  { src: path.join(appDir, '(dashboard)', 'slo-dashboard'), dest: path.join(stagingDir, 'slo-dashboard') },
  // Auxiliary bot/AI admin tools to keep core Admin bundle ultra-lean (< 1.8 MiB)
  { src: path.join(appDir, '(dashboard)', 'audit-ai'), dest: path.join(stagingDir, 'audit-ai') },
  { src: path.join(appDir, '(dashboard)', 'bot-config'), dest: path.join(stagingDir, 'bot-config') },
  { src: path.join(appDir, '(dashboard)', 'hub-komunikasi'), dest: path.join(stagingDir, 'hub-komunikasi') },
  { src: path.join(appDir, '(dashboard)', 'knowledge-base'), dest: path.join(stagingDir, 'knowledge-base') },
  { src: path.join(appDir, '(dashboard)', 'model-router'), dest: path.join(stagingDir, 'model-router') },
  { src: path.join(appDir, '(dashboard)', 'ops-health'), dest: path.join(stagingDir, 'ops-health') },
  { src: path.join(appDir, '(dashboard)', 'telegram-bot'), dest: path.join(stagingDir, 'telegram-bot') },
  { src: path.join(appDir, '(dashboard)', 'web-sessions'), dest: path.join(stagingDir, 'web-sessions') },
  { src: path.join(appDir, '(dashboard)', 'analitik'), dest: path.join(stagingDir, 'analitik') },
  { src: path.join(appDir, 'api', 'analytics'), dest: path.join(stagingDir, 'api_analytics') },
  { src: path.join(appDir, 'api', 'cron'), dest: path.join(stagingDir, 'api_cron') },
  { src: path.join(appDir, 'api', 'dashboard'), dest: path.join(stagingDir, 'api_dashboard') },
];

function moveFolder(from, to) {
  if (fs.existsSync(from)) {
    fs.mkdirSync(path.dirname(to), { recursive: true });
    fs.renameSync(from, to);
  }
}

function restoreFolder(from, to) {
  if (fs.existsSync(to)) {
    fs.mkdirSync(path.dirname(from), { recursive: true });
    fs.renameSync(to, from);
  }
}

console.log("=========================================");
console.log("    BUILDING LEAN ADMIN & COURIER OPS    ");
console.log("=========================================");

try {
  if (fs.existsSync(stagingDir)) {
    fs.rmSync(stagingDir, { recursive: true, force: true });
  }
  fs.mkdirSync(stagingDir, { recursive: true });

  console.log("1. Isolating non-essential routes to staging...");
  for (const f of foldersToIsolate) {
    moveFolder(f.src, f.dest);
  }

  console.log("2. Cleaning old build artifacts...");
  if (fs.existsSync(path.join(rootDir, '.next'))) {
    fs.rmSync(path.join(rootDir, '.next'), { recursive: true, force: true });
  }

  console.log("3. Running OpenNext build for Admin...");
  execSync('npx @opennextjs/cloudflare build', {
    cwd: rootDir,
    stdio: 'inherit',
    env: { ...process.env, DISABLE_SENTRY: 'true' },
  });

  const handlerPath = path.join(rootDir, '.open-next', 'server-functions', 'default', 'handler.mjs');
  if (fs.existsSync(handlerPath)) {
    console.log("⚡ Minifying Admin handler.mjs with esbuild...");
    const raw = fs.readFileSync(handlerPath, 'utf8');
    const min = await esbuild.transform(raw, {
      minify: true,
      target: 'es2022',
      format: 'esm',
    });
    fs.writeFileSync(handlerPath, min.code);

    const gz = zlib.gzipSync(Buffer.from(min.code));
    console.log(`\n🎉 Lean Admin Server Function Size: ${(min.code.length / 1024 / 1024).toFixed(2)} MB uncompressed | ${(gz.length / 1024 / 1024).toFixed(2)} MB gzip`);
    if (gz.length < 2.5 * 1024 * 1024) {
      console.log(`✅ EXCELLENT! Admin is ${(gz.length / 1024).toFixed(0)} KiB gzip (SAFELY UNDER 3.0 MiB limit)!`);
    } else {
      console.log(`ℹ️ Admin gzip size: ${(gz.length / 1024).toFixed(0)} KiB`);
    }
  }

} catch (err) {
  console.error("❌ Error during Admin build:", err.message);
} finally {
  console.log("\n4. Restoring isolated routes from staging...");
  for (const f of foldersToIsolate) {
    restoreFolder(f.src, f.dest);
  }
  if (fs.existsSync(stagingDir)) {
    fs.rmSync(stagingDir, { recursive: true, force: true });
  }
  console.log("✅ All routes restored successfully!");
}
