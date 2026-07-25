import fs from 'fs';
import path from 'path';

const SCHEMA_SOURCE = path.join(process.cwd(), 'src', 'lib', 'schema.ts');
const SNAPSHOT_FILE = path.join(process.cwd(), 'drizzle', 'schema-snapshot.json');
const MIGRATIONS_DIR = path.join(process.cwd(), 'drizzle');

function extractTableNames(content: string): string[] {
  const tables: string[] = [];
  const regex = /export const (\w+) = sqliteTable\(/g;
  let match;
  while ((match = regex.exec(content)) !== null) {
    tables.push(match[1]);
  }
  return tables;
}

function validate() {
  const content = fs.readFileSync(SCHEMA_SOURCE, 'utf8');
  const tables = extractTableNames(content);

  console.log(`Found ${tables.length} tables in schema:`);
  tables.forEach((t) => console.log(`  - ${t}`));

  if (fs.existsSync(SNAPSHOT_FILE)) {
    const snapshot = JSON.parse(fs.readFileSync(SNAPSHOT_FILE, 'utf8'));
    const snapshotTables = Object.keys(snapshot.tables || {});
    const missing = snapshotTables.filter((st) => !tables.some((t) => snapshot.tables[st]?.tableName === t));
    const extra = tables.filter((t) => !snapshotTables.includes(t));

    if (missing.length > 0) {
      console.warn(`\n⚠️  Tables in snapshot but missing from schema: ${missing.join(', ')}`);
    }
    if (extra.length > 0) {
      console.log(`\n📝 New tables not in snapshot: ${extra.join(', ')}`);
    }
    if (missing.length === 0 && extra.length === 0) {
      console.log('\n✅ Schema matches snapshot.');
    }
  } else {
    console.log('\n⚠️  No snapshot file found. Run `npm run db:schema-snapshot` to create one.');
  }

  const migrationFiles = fs.readdirSync(MIGRATIONS_DIR).filter((f) => f.endsWith('.sql'));
  console.log(`\nFound ${migrationFiles.length} migration files.`);
}

validate();