import { config } from 'dotenv';

config({ path: '.env.local' });

async function main() {
  process.env.CRON_SECRET = process.env.CRON_SECRET || 'smoke-cron-secret-local-only';
  const { GET } = await import('@/app/api/cron/worker/route');

  const unauth = await GET(new Request('http://localhost/api/cron/worker?limit=1'));
  const auth = await GET(new Request('http://localhost/api/cron/worker?limit=1', {
    headers: { Authorization: `Bearer ${process.env.CRON_SECRET}` },
  }));

  const authBody = await auth.json();
  const result = {
    ok: unauth.status === 401 && auth.status === 200 && authBody.ok === true,
    unauthorizedStatus: unauth.status,
    authorizedStatus: auth.status,
    authorizedBody: authBody,
  };
  console.log(JSON.stringify(result, null, 2));
  if (!result.ok) process.exit(1);
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
