import fs from 'fs';
import path from 'path';
import { createClient } from '@libsql/client';
import bcrypt from 'bcryptjs';

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

const courierData = [
  { name: 'Budi Santoso', phone: '628123456001', pin: '123456', vehicle: 'motor', plat_no: 'DD 1234 AB', employee_code: 'KRR-001' },
  { name: 'Siti Nurhaliza', phone: '628123456002', pin: '123456', vehicle: 'motor', plat_no: 'DD 5678 CD', employee_code: 'KRR-002' },
  { name: 'Ahmad Rizki', phone: '628123456003', pin: '123456', vehicle: 'mobil', plat_no: 'DD 9012 EF', employee_code: 'KRR-003' },
  { name: 'Dewi Lestari', phone: '628123456004', pin: '123456', vehicle: 'motor', plat_no: 'DD 3456 GH', employee_code: 'KRR-004' },
  { name: 'Rudi Hartono', phone: '628123456005', pin: '123456', vehicle: 'motor', plat_no: 'DD 7890 IJ', employee_code: 'KRR-005' },
];

async function main() {
  loadEnvLocal();
  const url = process.env.TURSO_DATABASE_URL?.replace(/^libsql:\/\//, 'https://');
  const authToken = process.env.TURSO_AUTH_TOKEN;
  if (!url || !authToken) throw new Error('TURSO_DATABASE_URL dan TURSO_AUTH_TOKEN wajib ada.');
  const client = createClient({ url, authToken });

  for (const c of courierData) {
    const pinHash = await bcrypt.hash(c.pin, 10);
    const existing = await client.execute({
      sql: 'SELECT id FROM couriers WHERE phone = $phone',
      args: { $phone: c.phone },
    });
    if (existing.rows.length > 0) {
      console.log(`[SKIP] ${c.name} (${c.phone}) already exists`);
      continue;
    }
    await client.execute({
      sql: `INSERT INTO couriers (name, phone, pin_hash, vehicle, plat_no, employee_code, is_active)
        VALUES ($name, $phone, $pin, $vehicle, $plat, $code, 1)`,
      args: { $name: c.name, $phone: c.phone, $pin: pinHash, $vehicle: c.vehicle, $plat: c.plat_no, $code: c.employee_code },
    });
    console.log(`[CREATE] ${c.name} (${c.phone}) — PIN: ${c.pin}`);
  }

  console.log(`Seed selesai: ${courierData.length} kurir dibuat.`);
  process.exit(0);
}

main().catch((err) => { console.error(err); process.exit(1); });
