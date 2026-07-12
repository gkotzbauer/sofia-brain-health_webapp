const { Pool } = require('pg');
require('dotenv').config();

// Data retention purge. Intended to run on a schedule (e.g. a daily Render
// Cron Job service, or any external scheduler invoking
// `npm run purge-retention`) -- see backend/DEPLOYMENT.md.
//
// This intentionally does NOT delete active user accounts or their PHI --
// that's the user's own choice via DELETE /api/users/me (see routes/users.js).
// What it does purge:
//
//   1. audit_log rows older than AUDIT_LOG_RETENTION_DAYS (default 365).
//      Audit logs exist for accountability, not indefinite storage; most
//      compliance frameworks expect a bounded retention window, not
//      "forever." Rows for already-deleted users (user_id IS NULL, per the
//      ON DELETE SET NULL on audit_log.user_id) are purged the same way.
//
//   2. conversation_turn_logs rows older than the same
//      AUDIT_LOG_RETENTION_DAYS window (see
//      database/migrations/008_conversation_turn_logs.sql) -- it's a
//      per-turn diagnostic/audit trail, not a clinical record, so it
//      follows the audit_log retention policy rather than a separate one.
//
//   3. Accounts that have been deactivated (is_active = false) for longer
//      than INACTIVE_ACCOUNT_PURGE_DAYS, if that env var is explicitly
//      set. Unset by default -- this script will never delete a user's PHI
//      without an explicit opt-in retention window, since "is_active =
//      false" today just means deactivated, not "abandoned," and turning
//      that into automatic deletion is a real policy decision that
//      shouldn't happen silently. When enabled, this deletes the user row,
//      which cascades to their PHI exactly like DELETE /api/users/me does.
const AUDIT_LOG_RETENTION_DAYS = parseInt(process.env.AUDIT_LOG_RETENTION_DAYS, 10) || 365;
const INACTIVE_ACCOUNT_PURGE_DAYS = process.env.INACTIVE_ACCOUNT_PURGE_DAYS
  ? parseInt(process.env.INACTIVE_ACCOUNT_PURGE_DAYS, 10)
  : null;

async function purgeRetention() {
  const pool = new Pool({
    connectionString: process.env.DATABASE_URL,
    // See the matching comment in server.js -- defaults to false because
    // Render's managed Postgres presents a self-signed cert internally.
    ssl: process.env.NODE_ENV === 'production' ? { rejectUnauthorized: process.env.DB_SSL_REJECT_UNAUTHORIZED === 'true' } : false
  });

  try {
    console.log(`Purging audit_log rows older than ${AUDIT_LOG_RETENTION_DAYS} days...`);
    const auditResult = await pool.query(
      `DELETE FROM audit_log WHERE created_at < NOW() - ($1 || ' days')::interval`,
      [AUDIT_LOG_RETENTION_DAYS]
    );
    console.log(`  Deleted ${auditResult.rowCount} audit_log row(s).`);

    console.log(`Purging conversation_turn_logs rows older than ${AUDIT_LOG_RETENTION_DAYS} days...`);
    const turnLogResult = await pool.query(
      `DELETE FROM conversation_turn_logs WHERE created_at < NOW() - ($1 || ' days')::interval`,
      [AUDIT_LOG_RETENTION_DAYS]
    );
    console.log(`  Deleted ${turnLogResult.rowCount} conversation_turn_logs row(s).`);

    if (INACTIVE_ACCOUNT_PURGE_DAYS !== null) {
      console.log(`Purging accounts deactivated more than ${INACTIVE_ACCOUNT_PURGE_DAYS} days ago...`);
      const usersResult = await pool.query(
        `SELECT id FROM users WHERE is_active = false AND updated_at < NOW() - ($1 || ' days')::interval`,
        [INACTIVE_ACCOUNT_PURGE_DAYS]
      );
      for (const row of usersResult.rows) {
        await pool.query(
          `INSERT INTO audit_log (user_id, action, resource_type, resource_id, metadata)
           VALUES ($1, 'ACCOUNT_PURGED_RETENTION_POLICY', 'users', $1, $2)`,
          [row.id, JSON.stringify({ purgedAfterDays: INACTIVE_ACCOUNT_PURGE_DAYS, timestamp: new Date().toISOString() })]
        );
        await pool.query('DELETE FROM users WHERE id = $1', [row.id]);
      }
      console.log(`  Purged ${usersResult.rows.length} inactive account(s).`);
    } else {
      console.log('INACTIVE_ACCOUNT_PURGE_DAYS not set -- skipping inactive-account purge (opt-in only).');
    }

    console.log('Retention purge complete.');
  } catch (error) {
    console.error('Retention purge failed:', error);
    process.exitCode = 1;
  } finally {
    await pool.end();
  }
}

purgeRetention();
