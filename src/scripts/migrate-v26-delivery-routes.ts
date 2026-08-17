import fs from 'fs';
import path from 'path';
import { createClient } from '@libsql/client/web';

function loadEnvLocal() {
  const envPath = path.join(process.cwd(), '.env.local');
  if (!fs.existsSync(envPath)) return;
  for (const line of fs.readFileSync(envPath, 'utf8').split('\n')) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('#')) continue;
    const index = trimmed.indexOf('=');
    if (index > 0) process.env[trimmed.slice(0, index).trim()] = trimmed.slice(index + 1).trim();
  }
}

async function tableExists(client: Awaited<ReturnType<typeof createClient>>, name: string): Promise<boolean> {
  const res = await client.execute(`SELECT 1 FROM sqlite_master WHERE type='table' AND name='${name}'`);
  return res.rows.length > 0;
}

async function columnExists(
  client: Awaited<ReturnType<typeof createClient>>,
  table: string,
  column: string
): Promise<boolean> {
  const res = await client.execute(`PRAGMA table_info(${table})`);
  return res.rows.some((r) => r.name === column);
}

async function indexExists(client: Awaited<ReturnType<typeof createClient>>, name: string): Promise<boolean> {
  const res = await client.execute(`SELECT 1 FROM sqlite_master WHERE type='index' AND name='${name}'`);
  return res.rows.length > 0;
}

async function main() {
  loadEnvLocal();
  const url = process.env.TURSO_DATABASE_URL?.replace(/^libsql:\/\//, 'https://');
  const authToken = process.env.TURSO_AUTH_TOKEN;
  if (!url || !authToken) throw new Error('TURSO_DATABASE_URL dan TURSO_AUTH_TOKEN wajib ada.');
  const client = createClient({ url, authToken });

  // ── 1. CREATE TABLE delivery_routes ────────────────────────────────────────
  if (!(await tableExists(client, 'delivery_routes'))) {
    await client.execute(`
      CREATE TABLE delivery_routes (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        route_date TEXT NOT NULL,
        route_name TEXT NOT NULL,
        warehouse_id INTEGER NOT NULL DEFAULT 1 REFERENCES warehouses(id),
        courier_id INTEGER REFERENCES couriers(id),
        status TEXT NOT NULL DEFAULT 'open'
          CHECK(status IN ('open','claimed','in_progress','completed','cancelled')),
        capacity_kg REAL,
        estimated_distance_km TEXT,
        estimated_duration_minutes INTEGER,
        stop_count INTEGER NOT NULL DEFAULT 0,
        created_by_type TEXT NOT NULL DEFAULT 'system'
          CHECK(created_by_type IN ('admin','system')),
        created_by TEXT,
        created_at TEXT NOT NULL DEFAULT (datetime('now', 'utc')),
        updated_at TEXT NOT NULL DEFAULT (datetime('now', 'utc')),
        completed_at TEXT
      )
    `);
    await client.execute(`CREATE INDEX idx_routes_date_status ON delivery_routes(route_date, status)`);
    await client.execute(`CREATE INDEX idx_routes_courier ON delivery_routes(courier_id, route_date)`);
    console.log('Tabel delivery_routes dibuat.');
  } else {
    console.log('delivery_routes sudah ada — dilewati.');
  }

  // ── 2. ALTER delivery_route_point: kolom route_id ──────────────────────────
  if (!(await columnExists(client, 'delivery_route_point', 'route_id'))) {
    await client.execute(`ALTER TABLE delivery_route_point ADD COLUMN route_id INTEGER REFERENCES delivery_routes(id)`);
    console.log('Kolom delivery_route_point.route_id ditambahkan.');
  } else {
    console.log('delivery_route_point.route_id sudah ada — dilewati.');
  }

  // ── 3. Unique index (route_date, id_transaksi) ─────────────────────────────
  if (!(await indexExists(client, 'uniq_route_point_date_tx'))) {
    // Kalau data lama sudah punya duplikat (route_date, id_transaksi), unique
    // index gagal dibuat. Bersihkan dulu — pertahankan baris dengan id terkecil.
    const dup = await client.execute(`
      SELECT route_date, id_transaksi, COUNT(*) AS cnt
      FROM delivery_route_point
      GROUP BY route_date, id_transaksi
      HAVING COUNT(*) > 1
    `);
    if (dup.rows.length > 0) {
      console.log(`Menemukan ${dup.rows.length} duplikat (route_date, id_transaksi) — membersihkan...`);
      for (const row of dup.rows) {
        await client.execute({
          sql: `DELETE FROM delivery_route_point
           WHERE route_date = ? AND id_transaksi = ? AND id NOT IN (
             SELECT MIN(id) FROM delivery_route_point WHERE route_date = ? AND id_transaksi = ?
           )`,
          args: [
            String(row.route_date),
            String(row.id_transaksi),
            String(row.route_date),
            String(row.id_transaksi),
          ],
        });
      }
    }
    await client.execute(`
      CREATE UNIQUE INDEX uniq_route_point_date_tx
      ON delivery_route_point(route_date, id_transaksi)
    `);
    console.log('Unique index uniq_route_point_date_tx dibuat.');
  } else {
    console.log('uniq_route_point_date_tx sudah ada — dilewati.');
  }

  // ── 4. ALTER delivery_assignment: kolom route_id ───────────────────────────
  if (!(await columnExists(client, 'delivery_assignment', 'route_id'))) {
    await client.execute(`ALTER TABLE delivery_assignment ADD COLUMN route_id INTEGER REFERENCES delivery_routes(id)`);
    console.log('Kolom delivery_assignment.route_id ditambahkan.');
  } else {
    console.log('delivery_assignment.route_id sudah ada — dilewati.');
  }

  // ── 5. Backfill: grup deliveryRoutePoint per (route_date, kurir) → jalur ──
  const legacyPoints = await client.execute(`
    SELECT p.route_date, p.id_transaksi, p.id AS point_id, a.kurir_id
    FROM delivery_route_point p
    LEFT JOIN delivery_assignment a ON a.id_transaksi = p.id_transaksi
    WHERE p.route_id IS NULL
    ORDER BY p.route_date
  `);
  const groups = new Map<string, { kurirId: number | null; points: Array<{ pointId: number; idTransaksi: string }> }>();
  for (const row of legacyPoints.rows) {
    const routeDate = String(row.route_date);
    const kurirId = row.kurir_id != null ? Number(row.kurir_id) : null;
    const key = `${routeDate}|${kurirId ?? 'none'}`;
    if (!groups.has(key)) groups.set(key, { kurirId, points: [] });
    groups.get(key)!.points.push({ pointId: Number(row.point_id), idTransaksi: String(row.id_transaksi) });
  }

  let createdRoutes = 0;
  for (const [key, group] of groups) {
    const [routeDate, kurirPart] = key.split('|');
    const kurirId = kurirPart === 'none' ? null : Number(kurirPart);
    const n = group.points.length;
    const status = kurirId == null ? 'open' : 'claimed';

    const insert = await client.execute({
      sql: `INSERT INTO delivery_routes
         (route_date, route_name, warehouse_id, courier_id, status, stop_count, created_by_type, created_by)
       VALUES (?, ?, 1, ?, ?, ?, 'system', 'migrate-v26-backfill')
       RETURNING id`,
      args: [routeDate, `Jalur ${routeDate} #${createdRoutes + 1}`, kurirId, status, n],
    });
    const routeId = Number(insert.rows[0].id);

    // urutan sequence_no sesuai nilai existing
    const placeholders = group.points.map(() => '?').join(',');
    const ordered = await client.execute({
      sql: `SELECT id FROM delivery_route_point
       WHERE route_id IS NULL AND route_date = ? AND id_transaksi IN (${placeholders})
       ORDER BY sequence_no`,
      args: [routeDate, ...group.points.map((p) => p.idTransaksi)],
    });
    for (const point of ordered.rows) {
      await client.execute({ sql: `UPDATE delivery_route_point SET route_id = ? WHERE id = ?`, args: [routeId, Number(point.id)] });
    }
    await client.execute({
      sql: `UPDATE delivery_assignment SET route_id = ? WHERE id_transaksi IN (${placeholders})`,
      args: [routeId, ...group.points.map((p) => p.idTransaksi)],
    });
    createdRoutes++;
    console.log(`  → Jalur #${createdRoutes} (${routeDate}, kurir=${kurirId ?? 'none'}, ${n} stop)`);
  }
  if (legacyPoints.rows.length === 0) {
    console.log('Tidak ada delivery_route_point legacy untuk di-backfill.');
  }

  console.log(`Migrasi v26 (sistem jalur) selesai. Jalur dibuat: ${createdRoutes}.`);
  process.exit(0);
}

main().catch((err) => { console.error(err); process.exit(1); });