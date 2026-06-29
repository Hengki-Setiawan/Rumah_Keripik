import { createClient } from '@libsql/client';

const client = createClient({
  url: process.env.TURSO_DATABASE_URL!,
  authToken: process.env.TURSO_AUTH_TOKEN!,
});

async function run() {
  try {
    await client.execute(`ALTER TABLE pelanggan_chatbot ADD COLUMN tags text DEFAULT '[]'`);
    console.log('tags column added');
  } catch (e: any) {
    if (e.message?.includes('duplicate')) console.log('tags already exists');
    else throw e;
  }

  try {
    await client.execute('ALTER TABLE pelanggan_chatbot ADD COLUMN diambil_oleh text');
    console.log('diambil_oleh column added');
  } catch (e: any) {
    if (e.message?.includes('duplicate')) console.log('diambil_oleh already exists');
    else throw e;
  }

  console.log('Migration complete');
}

run().catch(console.error);
