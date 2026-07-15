/**
 * Get the D1 database instance via NuxtHub (auto-imported in server context)
 */
export function getDB() {
  return hubDatabase()
}

/**
 * Initialize database tables on first run
 */
export async function initDB() {
  const db = getDB()
  await db.exec(`
    CREATE TABLE IF NOT EXISTS diffs (
      id TEXT PRIMARY KEY,
      encrypted_data TEXT NOT NULL,
      iv TEXT NOT NULL,
      salt TEXT NOT NULL,
      file_count INTEGER NOT NULL DEFAULT 0,
      created_at TEXT NOT NULL DEFAULT (datetime('now'))
    )
  `)
  await db.exec(`
    CREATE INDEX IF NOT EXISTS idx_diffs_created_at ON diffs(created_at)
  `)
}
