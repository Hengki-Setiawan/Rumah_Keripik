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

async function main() {
  loadEnvLocal();
  const url = process.env.TURSO_DATABASE_URL?.replace(/^libsql:\/\//, 'https://');
  const authToken = process.env.TURSO_AUTH_TOKEN;
  if (!url || !authToken) throw new Error('TURSO_DATABASE_URL dan TURSO_AUTH_TOKEN wajib ada.');
  const client = createClient({ url, authToken });

  const NAME = 'Rumah Produksi Kaluku Bodoa';
  const ADDRESS = 'Kaluku Bodoa, Kec. Tallo, Kota Makassar, Sulawesi Selatan';
  const LAT = '-5.105950';
  const LNG = '119.432407';

  await client.execute({
    sql: `UPDATE warehouses SET name = ?, address = ?, lat = ?, lng = ?, updated_at = datetime('now', 'utc') WHERE id = 1`,
    args: [NAME, ADDRESS, LAT, LNG],
  });
  console.log('warehouses.id=1 diupdate →', NAME, `(${LAT}, ${LNG})`);

  const zones = await client.execute(`SELECT id, name, zone_type FROM geofence_zones WHERE warehouse_id = 1`);
  for (const z of zones.rows) {
    await client.execute({
      sql: `UPDATE geofence_zones SET center_lat = ?, center_lng = ?, name = CASE WHEN zone_type = 'attendance_radius' THEN 'Radius Absensi Rumah Produksi' ELSE name END WHERE id = ?`,
      args: [LAT, LNG, Number(z.id)],
    });
    console.log(`  geofence_zones.id=${z.id} (${z.zone_type}) center diupdate`);
  }

  const warehouse = await client.execute(`SELECT id, name, lat, lng, address FROM warehouses WHERE id = 1`);
  console.log('Hasil:', JSON.stringify(warehouse.rows[0]));
  process.exit(0);
}

main().catch((err) => { console.error(err); process.exit(1); });