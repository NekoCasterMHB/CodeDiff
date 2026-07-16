/**
 * Get D1 database — Cloudflare binding in production, in-memory fallback for local dev
 */

// In-memory store for local dev
const localStore = new Map<string, any>()

function getCloudflareDB(event: any) {
  return event.context?.cloudflare?.env?.DB ?? null
}

export function getDB(event: any) {
  const db = getCloudflareDB(event)
  if (db) return db
  // Local dev fallback: in-memory store with D1-like API
  return createLocalDB()
}

export async function initDB(event: any) {
  const db = getDB(event)
  if (db._local) return // Local store doesn't need init
  await db.exec(`CREATE TABLE IF NOT EXISTS diffs (id TEXT PRIMARY KEY, encrypted_data TEXT NOT NULL, iv TEXT NOT NULL, salt TEXT NOT NULL, file_count INTEGER NOT NULL DEFAULT 0, created_at TEXT NOT NULL DEFAULT (datetime('now')))`)
  await db.exec(`CREATE INDEX IF NOT EXISTS idx_diffs_created_at ON diffs(created_at)`)
}

function createLocalDB() {
  return {
    _local: true,
    prepare(sql: string) {
      return {
        bind(...args: any[]) {
          return {
            async first() {
              if (sql.includes('SELECT')) {
                return localStore.get(args[0]) ?? null
              }
              return null
            },
            async run() {
              if (sql.includes('INSERT')) {
                localStore.set(args[0], {
                  id: args[0],
                  encrypted_data: args[1],
                  iv: args[2],
                  salt: args[3],
                  file_count: args[4] || 1,
                  created_at: new Date().toISOString(),
                })
              }
              return { success: true }
            },
          }
        },
      }
    },
    async exec(_sql: string) {
      // No-op for local dev
    },
  }
}
