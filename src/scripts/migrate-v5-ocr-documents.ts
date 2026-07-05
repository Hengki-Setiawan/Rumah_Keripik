import fs from 'fs';
import path from 'path';
import { createClient } from '@libsql/client';

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

async function main() {
  loadEnvLocal();
  const url = process.env.TURSO_DATABASE_URL?.replace(/^libsql:\/\//, 'https://');
  const authToken = process.env.TURSO_AUTH_TOKEN;
  if (!url || !authToken) throw new Error('TURSO_DATABASE_URL dan TURSO_AUTH_TOKEN wajib ada.');
  const client = createClient({ url, authToken });

  const statements = [
    `CREATE TABLE IF NOT EXISTS payment_ocr_result (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      id_payment_proof TEXT NOT NULL REFERENCES payment_proof(id_payment_proof) ON DELETE CASCADE,
      id_transaksi TEXT NOT NULL REFERENCES transaksi(id_transaksi) ON DELETE CASCADE,
      worker_job_id INTEGER,
      engine TEXT NOT NULL DEFAULT 'rule_based_mvp',
      extracted_text TEXT,
      extracted_amount INTEGER,
      reference_number TEXT,
      status_keywords_json TEXT NOT NULL DEFAULT '[]',
      score INTEGER NOT NULL DEFAULT 0,
      warnings_json TEXT NOT NULL DEFAULT '[]',
      summary TEXT,
      raw_json TEXT,
      created_at TEXT NOT NULL DEFAULT (datetime('now', 'utc')),
      updated_at TEXT NOT NULL DEFAULT (datetime('now', 'utc'))
    )`,
    `CREATE INDEX IF NOT EXISTS idx_payment_ocr_result_proof ON payment_ocr_result(id_payment_proof)`,
    `CREATE INDEX IF NOT EXISTS idx_payment_ocr_result_transaksi ON payment_ocr_result(id_transaksi)`,
    `CREATE INDEX IF NOT EXISTS idx_payment_ocr_result_score ON payment_ocr_result(score)`,
    `CREATE INDEX IF NOT EXISTS idx_payment_ocr_result_reference ON payment_ocr_result(reference_number)`,
    `CREATE TABLE IF NOT EXISTS order_document (
      id_document TEXT PRIMARY KEY,
      id_transaksi TEXT NOT NULL REFERENCES transaksi(id_transaksi) ON DELETE CASCADE,
      document_type TEXT NOT NULL CHECK (document_type IN ('proforma','receipt','packing-label')),
      document_number TEXT NOT NULL UNIQUE,
      status TEXT NOT NULL DEFAULT 'issued' CHECK (status IN ('draft','issued','void')),
      issued_by TEXT NOT NULL DEFAULT 'system',
      issued_at TEXT NOT NULL DEFAULT (datetime('now', 'utc')),
      print_count INTEGER NOT NULL DEFAULT 0,
      last_printed_at TEXT,
      metadata_json TEXT
    )`,
    `CREATE INDEX IF NOT EXISTS idx_order_document_tx_type ON order_document(id_transaksi, document_type)`,
    `CREATE INDEX IF NOT EXISTS idx_order_document_number ON order_document(document_number)`,
  ];

  console.log('Running v5 OCR/document migration...');
  for (const statement of statements) await client.execute(statement);
  console.log('v5 migration completed.');
}

main().catch((error) => {
  console.error('v5 migration failed:', error);
  process.exit(1);
});
