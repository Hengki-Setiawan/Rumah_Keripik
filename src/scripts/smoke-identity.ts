import fs from 'fs';
import path from 'path';

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
  const { normalizeAndValidatePhone, hashOtpCode, lookupCustomerByPhone, verifyOtp } = await import('../lib/identity/otp');

  console.log('=== normalizeAndValidatePhone ===');
  const cases: Array<[string, string]> = [
    ['081234567890', '6281234567890'],
    ['+62 812-3456-7890', '6281234567890'],
    ['6281234567890', '6281234567890'],
    ['0812 3456 789', '628123456789'],
  ];
  for (const [input, expected] of cases) {
    const result = normalizeAndValidatePhone(input);
    console.log(`${input} => ${result.ok ? result.phone : result.error} (expected ${expected})`);
  }
  console.log('Invalid:', JSON.stringify(normalizeAndValidatePhone('1234')));

  console.log('\n=== hashOtpCode ===');
  const hash = hashOtpCode('123456');
  console.log('sha256 len:', hash.length, 'first8:', hash.slice(0, 8));

  console.log('\n=== lookupCustomerByPhone (read-only, no SMS) ===');
  const found = await lookupCustomerByPhone('6281234567890');
  console.log('found:', JSON.stringify(found));

  console.log('\n=== verifyOtp dengan kode acak (tidak mengirim apa pun) ===');
  const verify = await verifyOtp({ phone: '6281234567890', code: '000000' });
  console.log('verify result:', JSON.stringify(verify));

  console.log('\nOK — identity lib smoke passed (no SMS sent)');
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});