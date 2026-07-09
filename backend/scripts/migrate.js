const { Pool } = require('pg');
const fs = require('fs');
const path = require('path');
require('dotenv').config();

// Applies database/schema.sql once as baseline version '001_init', then
// applies any not-yet-applied *.sql files in database/migrations/ in
// filename order, tracking progress in schema_migrations so re-running
// this script is safe/idempotent.
async function migrate() {
  const pool = new Pool({
    connectionString: process.env.DATABASE_URL,
    ssl: process.env.NODE_ENV === 'production' ? { rejectUnauthorized: true } : false
  });

  try {
    console.log('Running database migrations...');

    await pool.query(`
      CREATE TABLE IF NOT EXISTS schema_migrations (
        version VARCHAR(50) PRIMARY KEY,
        applied_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
      )
    `);

    const appliedResult = await pool.query('SELECT version FROM schema_migrations');
    const applied = new Set(appliedResult.rows.map((row) => row.version));

    if (!applied.has('001_init')) {
      console.log('Applying 001_init (database/schema.sql)...');
      const baselinePath = path.join(__dirname, '../../database/schema.sql');
      await pool.query(fs.readFileSync(baselinePath, 'utf8'));
      await pool.query('INSERT INTO schema_migrations (version) VALUES ($1)', ['001_init']);
      applied.add('001_init');
    }

    const migrationsDir = path.join(__dirname, '../../database/migrations');
    const files = fs.existsSync(migrationsDir)
      ? fs.readdirSync(migrationsDir).filter((f) => f.endsWith('.sql')).sort()
      : [];

    for (const file of files) {
      const version = file.replace(/\.sql$/, '');
      if (applied.has(version)) continue;

      console.log(`Applying ${version}...`);
      const sql = fs.readFileSync(path.join(migrationsDir, file), 'utf8');
      const client = await pool.connect();
      try {
        await client.query('BEGIN');
        await client.query(sql);
        await client.query('INSERT INTO schema_migrations (version) VALUES ($1)', [version]);
        await client.query('COMMIT');
      } catch (error) {
        await client.query('ROLLBACK');
        throw error;
      } finally {
        client.release();
      }
    }

    console.log('Database migrations completed successfully!');
  } catch (error) {
    console.error('Migration failed:', error);
    process.exit(1);
  } finally {
    await pool.end();
  }
}

migrate();
