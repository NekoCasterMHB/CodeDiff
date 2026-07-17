/**
 * Cron endpoint: delete shared diffs older than 30 days.
 *
 * Called by Cloudflare Cron Trigger (configured in Cloudflare Dashboard or wrangler.toml).
 * Protected by CRON_SECRET env var — only Cloudflare's Cron service knows this secret.
 *
 * Cloudflare Dashboard → Workers & Pages → [your-project] → Settings → Cron Triggers
 *   Path: /api/cleanup?secret=YOUR_CRON_SECRET
 *   Schedule: e.g., `0 * * * *` (every hour)
 */

import { getDB, initDB } from '../utils/db'

export default defineEventHandler(async (event) => {
  // Init DB schema (idempotent — safe to call every time)
  await initDB(event)

  // Auth: Cloudflare env binding (production), fallback to process.env (local dev)
  const envSecret = event.context.cloudflare?.env?.CRON_SECRET || process.env.CRON_SECRET
  const querySecret = getQuery(event).secret

  if (!envSecret || querySecret !== envSecret) {
    throw createError({ statusCode: 401, statusMessage: 'Unauthorized' })
  }

  const db = event.context.cloudflare?.env?.DB
  if (!db) {
    return { result: 'skipped', reason: 'No D1 binding (local dev)' }
  }

  // Delete diffs whose expires_at has passed
  const now = new Date().toISOString()

  const result = await db
    .prepare(`DELETE FROM diffs WHERE expires_at IS NOT NULL AND expires_at < ?1`)
    .bind(now)
    .run()

  const deleted = (result as any).meta?.changes_written ?? 0

  console.log(`[cron/cleanup] Deleted ${deleted} expired diffs (now: ${now})`)

  return { result: 'ok', deleted, now }
})
