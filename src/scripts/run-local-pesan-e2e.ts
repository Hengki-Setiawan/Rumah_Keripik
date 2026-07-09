import fs from 'node:fs';
import path from 'node:path';
import { spawn, spawnSync } from 'node:child_process';
import { config } from 'dotenv';

config({ path: '.env.local' });

const repoRoot = process.cwd();
const tempDir = path.join(repoRoot, 'tmp');
const dbFile = path.join(tempDir, 'pesan-e2e.db');
const dbUrl = 'file:./tmp/pesan-e2e.db';
const baseUrl = 'http://127.0.0.1:3000';

function drizzleKitCmd() {
  return path.join(repoRoot, 'node_modules', 'drizzle-kit', 'bin.cjs');
}

function npmCliCmd() {
  if (process.platform === 'win32') {
    return path.join(path.dirname(process.execPath), 'node_modules', 'npm', 'bin', 'npm-cli.js');
  }
  return path.join(path.dirname(process.execPath), '..', 'lib', 'node_modules', 'npm', 'bin', 'npm-cli.js');
}

function runStep(command: string, args: string[], env: NodeJS.ProcessEnv) {
  console.log(`\n> ${command} ${args.join(' ')}`);
  const result = spawnSync(command, args, {
    cwd: repoRoot,
    env,
    encoding: 'utf8',
    stdio: 'pipe',
  });
  if (result.status !== 0) {
    if (result.stdout) process.stdout.write(result.stdout);
    if (result.stderr) process.stderr.write(result.stderr);
    throw new Error(`Command failed: ${command} ${args.join(' ')}`);
  }
  if (result.stdout) process.stdout.write(result.stdout);
  if (result.stderr) process.stderr.write(result.stderr);
}

async function waitForServer(url: string, timeoutMs: number) {
  const started = Date.now();
  while (Date.now() - started < timeoutMs) {
    try {
      const res = await fetch(url);
      if (res.ok) return;
    } catch {
      // keep waiting
    }
    await new Promise((resolve) => setTimeout(resolve, 1_500));
  }
  throw new Error(`Server did not become ready: ${url}`);
}

async function main() {
  fs.mkdirSync(tempDir, { recursive: true });
  for (const suffix of ['', '-shm', '-wal']) {
    const file = `${dbFile}${suffix}`;
    if (fs.existsSync(file)) fs.rmSync(file, { force: true });
  }

  const env: NodeJS.ProcessEnv = {
    ...process.env,
    TURSO_DATABASE_URL: dbUrl,
    TURSO_AUTH_TOKEN: '',
    NEXTAUTH_URL: baseUrl,
    AUTH_URL: baseUrl,
    PLAYWRIGHT_BASE_URL: baseUrl,
    SMOKE_BASE_URL: baseUrl,
    PORT: '3000',
    NODE_ENV: 'production',
  };

  runStep(process.execPath, [drizzleKitCmd(), 'push', '--dialect', 'sqlite', '--schema', './src/lib/schema.ts', '--url', dbUrl], env);
  runStep(process.execPath, [npmCliCmd(), 'run', 'db:seed:smoke'], env);
  runStep(process.execPath, [npmCliCmd(), 'run', 'build'], env);

  const server = spawn(process.execPath, [npmCliCmd(), 'run', 'start'], {
    cwd: repoRoot,
    env,
    stdio: 'inherit',
  });

  try {
    await waitForServer(`${baseUrl}/pesan`, 120_000);
    runStep(process.execPath, [npmCliCmd(), 'run', 'smoke:chat-v3'], env);
    runStep(process.execPath, [npmCliCmd(), 'run', 'smoke:public-order'], env);
    runStep(process.execPath, [npmCliCmd(), 'run', 'e2e:pesan'], env);
  } finally {
    server.kill('SIGTERM');
  }
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
