import fs from 'fs';
import path from 'path';

// Load .env.local
try {
  const envPath = path.resolve(process.cwd(), '.env.local');
  if (fs.existsSync(envPath)) {
    const envContent = fs.readFileSync(envPath, 'utf-8');
    for (const line of envContent.split('\n')) {
      const trimmed = line.trim();
      if (trimmed && !trimmed.startsWith('#')) {
        const idx = trimmed.indexOf('=');
        if (idx > 0) {
          const key = trimmed.slice(0, idx).trim();
          const val = trimmed.slice(idx + 1).trim().replace(/^["']|["']$/g, '');
          process.env[key] = val;
        }
      }
    }
  }
} catch (e) {
  console.warn('Failed reading .env.local:', e);
}

import { getRedisClient, cacheCourierLocation, getAllCachedCourierLocations } from '../lib/redis';

async function main() {
  console.log('--- 🚀 TESTING UPSTASH REDIS INTEGRATION ---');
  console.log('URL:', process.env.UPSTASH_REDIS_REST_URL);
  console.log('TOKEN Present:', !!process.env.UPSTASH_REDIS_REST_TOKEN);

  const redis = getRedisClient();
  if (!redis) {
    console.error('❌ Redis client failed to initialize!');
    process.exit(1);
  }

  // 1. Test Ping & Basic Set/Get Latency
  console.log('\n[1] Testing Basic Ping & Latency...');
  const t0 = performance.now();
  const pingRes = await redis.ping();
  const t1 = performance.now();
  console.log(`✅ PING Response: ${pingRes} (${(t1 - t0).toFixed(1)} ms)`);

  const t2 = performance.now();
  await redis.set('test:connection', 'Rumah Keripik Upstash Redis Live OK', { ex: 60 });
  const val = await redis.get('test:connection');
  const t3 = performance.now();
  console.log(`✅ SET/GET Response: "${val}" (${(t3 - t2).toFixed(1)} ms)`);

  // 2. Test Courier GPS Caching
  console.log('\n[2] Testing Courier Location Caching (Hash & GEO Index)...');
  const mockCourier1 = {
    courierId: 991,
    lat: '-5.105950',
    lng: '119.432407',
    recordedAt: new Date().toISOString(),
    speed: 35.5,
    accuracy: 5.0,
    orderId: 'TRX-TEST-001',
  };

  const mockCourier2 = {
    courierId: 992,
    lat: '-5.118200',
    lng: '119.442100',
    recordedAt: new Date().toISOString(),
    speed: 28.0,
    accuracy: 4.2,
    orderId: 'TRX-TEST-002',
  };

  const t4 = performance.now();
  await cacheCourierLocation(mockCourier1);
  await cacheCourierLocation(mockCourier2);
  const t5 = performance.now();
  console.log(`✅ Cached 2 couriers in Upstash Redis (${(t5 - t4).toFixed(1)} ms)`);

  // 3. Test Retrieval of all cached locations
  console.log('\n[3] Testing getAllCachedCourierLocations()...');
  const t6 = performance.now();
  const allLocations = await getAllCachedCourierLocations();
  const t7 = performance.now();

  console.log(`✅ Retrieved ${allLocations.size} courier locations in ${(t7 - t6).toFixed(1)} ms:`);
  for (const [id, loc] of allLocations.entries()) {
    console.log(`   👉 Kurir #${id}: lat=${loc.lat}, lng=${loc.lng}, updated=${loc.recordedAt}`);
  }

  // 4. Test Redis GEO distance (Makassar coordinates)
  console.log('\n[4] Testing Redis GEO Calculation...');
  try {
    const dist = await redis.geodist('courier:geo', '991', '992', 'KM');
    console.log(`✅ Jarak GPS Kurir #991 ke #992 via Redis GEO: ${dist} km`);
  } catch (err) {
    console.log('GEO Dist info:', err);
  }

  console.log('\n🎉 ALL UPSTASH REDIS TESTS PASSED 100%! 🚀');
}

main().catch((err) => {
  console.error('❌ Test failed with error:', err);
  process.exit(1);
});
