require('dotenv').config({ path: '.env.local' });
const postgres = require('postgres');

const sql = postgres(process.env.POSTGRES_URL_NON_POOLING, { ssl: 'require' });

(async () => {
  try {
    await sql`
      CREATE TABLE IF NOT EXISTS "personas" (
        "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
        "site_id" uuid NOT NULL REFERENCES "sites"("id"),
        "period" text NOT NULL,
        "data" jsonb NOT NULL,
        "generated_at" timestamp DEFAULT now() NOT NULL
      )
    `;
    console.log('Migration 0006: personas table created.');
  } finally {
    await sql.end();
  }
})();
