import { createClient } from '@libsql/client';
import 'dotenv/config';

const client = createClient({
  url: process.env.TURSO_DATABASE_URL,
  authToken: process.env.TURSO_AUTH_TOKEN,
});

try {
  await client.execute("ALTER TABLE pelanggan_chatbot ADD COLUMN tags text DEFAULT '[]'");
  console.log('tags column added');
} catch (e) {
  if (e.message.includes('duplicate column')) console.log('tags already exists');
  else throw e;
}

try {
  await client.execute('ALTER TABLE pelanggan_chatbot ADD COLUMN diambil_oleh text');
  console.log('diambil_oleh column added');
} catch (e) {
  if (e.message.includes('duplicate column')) console.log('diambil_oleh already exists');
  else throw e;
}

console.log('Migration complete');
