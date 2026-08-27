import fs from 'node:fs';
import path from 'node:path';
import { execSync } from 'node:child_process';
import zlib from 'node:zlib';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const rootDir = path.resolve(__dirname, '..');
const appDir = path.join(rootDir, 'src', 'app');
const stagingDir = path.join(rootDir, '.staging-admin');

// Folders to isolate away from Storefront
const adminFolders = [
  { src: path.join(appDir, '(dashboard)'), dest: path.join(stagingDir, '(dashboard)') },
  { src: path.join(appDir, '(auth)'), dest: path.join(stagingDir, '(auth)') },
  { src: path.join(appDir, 'api', 'admin'), dest: path.join(stagingDir, 'api', 'admin') },
  { src: path.join(appDir, 'api', 'courier'), dest: path.join(stagingDir, 'api', 'courier') },
  { src: path.join(appDir, 'api', 'analytics'), dest: path.join(stagingDir, 'api', 'analytics') },
  { src: path.join(appDir, 'api', 'cron'), dest: path.join(stagingDir, 'api', 'cron') },
  { src: path.join(appDir, 'api', 'auth'), dest: path.join(stagingDir, 'api', 'auth') },
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
console.log("  BUILDING STOREFRONT (TOKO PELANGGAN)   ");
console.log("=========================================");

try {
  // Clean staging
  if (fs.existsSync(stagingDir)) {
    fs.rmSync(stagingDir, { recursive: true, force: true });
  }
  fs.mkdirSync(stagingDir, { recursive: true });

  console.log("1. Isolating admin routes to staging...");
  for (const f of adminFolders) {
    moveFolder(f.src, f.dest);
  }

  console.log("2. Cleaning old build artifacts...");
  if (fs.existsSync(path.join(rootDir, '.next'))) {
    fs.rmSync(path.join(rootDir, '.next'), { recursive: true, force: true });
  }

  console.log("3. Running OpenNext build for Storefront...");
  execSync('npx @opennextjs/cloudflare build', {
    cwd: rootDir,
    stdio: 'inherit',
    env: { ...process.env, DISABLE_SENTRY: 'true' },
  });

  const handlerPath = path.join(rootDir, '.open-next', 'server-functions', 'default', 'handler.mjs');
  if (fs.existsSync(handlerPath)) {
    const code = fs.readFileSync(handlerPath);
    const gz = zlib.gzipSync(code);
    console.log(`\n🎉 Storefront Server Function Size: ${(code.length / 1024 / 1024).toFixed(2)} MB uncompressed | ${(gz.length / 1024 / 1024).toFixed(2)} MB gzip`);
    if (gz.length < 3 * 1024 * 1024) {
      console.log(`✅ EXCELLENT! Storefront is UNDER 3.0 MiB limit (${(gz.length / 1024).toFixed(0)} KiB gzip) and READY for Cloudflare Free!`);
    } else {
      console.log(`⚠️ Warning: Gzip size is ${(gz.length / 1024).toFixed(0)} KiB`);
    }
  }

} catch (err) {
  console.error("❌ Error during Storefront build:", err.message);
} finally {
  console.log("\n4. Restoring admin routes from staging...");
  for (const f of adminFolders) {
    restoreFolder(f.src, f.dest);
  }
  if (fs.existsSync(stagingDir)) {
    fs.rmSync(stagingDir, { recursive: true, force: true });
  }
  console.log("✅ Admin routes restored successfully!");
}
