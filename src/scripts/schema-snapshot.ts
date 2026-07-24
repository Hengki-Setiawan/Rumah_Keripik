import fs from 'fs';
import path from 'path';
import { spawnSync } from 'child_process';

function main() {
  const result = spawnSync('npx', ['drizzle-kit', 'studio', '--port', '4999'], {
    shell: true,
    encoding: 'utf8',
    timeout: 5000,
    stdio: 'pipe',
  });

  const outPath = path.join(process.cwd(), '00_SCHEMA_SNAPSHOT.md');
  const lines = [
    '# Schema Snapshot — Rumah Keripik',
    `> Auto-generated: ${new Date().toISOString()}`,
    '> Generate with: `npm run db:schema-snapshot`',
    '',
    'Tabel yang terdaftar di schema.ts:',
    '',
  ];

  const schemaPath = path.join(process.cwd(), 'src', 'lib', 'schema.ts');
  if (fs.existsSync(schemaPath)) {
    const content = fs.readFileSync(schemaPath, 'utf8');
    const tableRegex = /export\s+const\s+(\w+)\s*=\s*sqliteTable\s*\(\s*['"](\w+)['"]/g;
    let match: RegExpExecArray | null;
    let count = 0;
    while ((match = tableRegex.exec(content)) !== null) {
      count++;
      lines.push(`- \`${match[1]}\` → tabel \`${match[2]}\``);
    }
    lines.push('', `Total: ${count} tabel`);
  } else {
    lines.push('schema.ts tidak ditemukan.');
  }

  fs.writeFileSync(outPath, lines.join('\n'));
  console.log(`Schema snapshot written: ${outPath}`);
}

main();
