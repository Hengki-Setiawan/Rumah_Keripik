import dotenv from 'dotenv';
import path from 'path';
dotenv.config({ path: path.resolve(process.cwd(), '.env.local') });

async function run() {
  console.log('Adding pin column to customer_profile...');
  const { db } = require('../lib/db');
  const { sql } = require('drizzle-orm');
  try {
    await db.run(sql`ALTER TABLE customer_profile ADD COLUMN pin TEXT`);
    console.log('Column pin added successfully!');
  } catch (error) {
    console.error('Error adding column (it might already exist):', error);
  }
  process.exit(0);
}

run();
