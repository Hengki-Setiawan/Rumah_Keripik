import fs from 'fs';
import path from 'path';
import { spawnSync } from 'child_process';

function loadEnvLocal() {
  const envPath = path.join(process.cwd(), '.env.local');
  if (!fs.existsSync(envPath)) return;
  const content = fs.readFileSync(envPath, 'utf8');
  for (const line of content.split('\n')) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('#')) continue;
    const index = trimmed.indexOf('=');
    if (index <= 0) continue;
    process.env[trimmed.slice(0, index).trim()] = trimmed.slice(index + 1).trim();
  }
}

function main() {
  loadEnvLocal();
  const backupDir = path.join(process.cwd(), 'backups');
  fs.mkdirSync(backupDir, { recursive: true });
  const stamp = new Date().toISOString().replace(/[:.]/g, '-');
  const metadataPath = path.join(backupDir, `backup-${stamp}.json`);
  const dbUrl = process.env.TURSO_DATABASE_URL || '';
  const dbName = dbUrl.match(/libsql:\/\/([^.-]+)/)?.[1] || dbUrl.match(/https:\/\/([^.-]+)/)?.[1] || 'unknown';

  const metadata = {
    createdAt: new Date().toISOString(),
    databaseNameHint: dbName,
    note: 'Metadata created. Use Turso CLI dump command below for SQL backup if Turso CLI is available.',
    command: `turso db shell ${dbName} ".dump" > backups/backup-${stamp}.sql`,
  };
  fs.writeFileSync(metadataPath, JSON.stringify(metadata, null, 2));

  const hasTurso = spawnSync('turso', ['--version'], { shell: true, stdio: 'ignore' }).status === 0;
  if (!hasTurso || dbName === 'unknown') {
    console.log(`Backup metadata written: ${metadataPath}`);
    console.log('Turso CLI/database name not available. Run this manually when authenticated:');
    console.log(metadata.command);
    return;
  }

  const sqlPath = path.join(backupDir, `backup-${stamp}.sql`);
  const result = spawnSync('turso', ['db', 'shell', dbName, '.dump'], { shell: true, encoding: 'utf8' });
  if (result.status !== 0) {
    console.log(`Backup metadata written: ${metadataPath}`);
    console.log('Turso dump failed. Run manually:');
    console.log(metadata.command);
    return;
  }
  fs.writeFileSync(sqlPath, result.stdout);
  console.log(`Backup metadata written: ${metadataPath}`);
  console.log(`SQL backup written: ${sqlPath}`);
}

main();
