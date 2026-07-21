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
  await db.exec(`CREATE TABLE IF NOT EXISTS diffs (id TEXT PRIMARY KEY, encrypted_data TEXT NOT NULL, iv TEXT NOT NULL, salt TEXT NOT NULL, file_count INTEGER NOT NULL DEFAULT 0, expires_at TEXT, created_at TEXT NOT NULL DEFAULT (datetime('now')))`)
  // Migration: add expires_at column for existing tables (safe to retry)
  await db.exec(`ALTER TABLE diffs ADD COLUMN expires_at TEXT`).catch(() => {})
  await db.exec(`CREATE INDEX IF NOT EXISTS idx_diffs_created_at ON diffs(created_at)`)
  await db.exec(`CREATE INDEX IF NOT EXISTS idx_diffs_expires_at ON diffs(expires_at)`)
  // Migration: add segmented sharing columns (safe to retry)
  await db.exec(`ALTER TABLE diffs ADD COLUMN share_group TEXT`).catch(() => {})
  await db.exec(`ALTER TABLE diffs ADD COLUMN segment_index INTEGER`).catch(() => {})
  await db.exec(`ALTER TABLE diffs ADD COLUMN total_segments INTEGER`).catch(() => {})
  await db.exec(`CREATE INDEX IF NOT EXISTS idx_diffs_share_group ON diffs(share_group)`)
  // Migration: add owner_token column (safe to retry)
  await db.exec(`ALTER TABLE diffs ADD COLUMN owner_token TEXT`).catch(() => {})
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
            async all() {
              if (sql.includes('share_group')) {
                const groupId = args[0]
                const all: any[] = []
                localStore.forEach((v) => {
                  if (v.share_group === groupId) all.push(v)
                })
                all.sort((a, b) => (a.segment_index || 0) - (b.segment_index || 0))
                return { results: all }
              }
              return { results: [] }
            },
            async run() {
              if (sql.includes('DELETE')) {
                if (sql.includes('share_group')) {
                  const groupId = args[0]
                  localStore.forEach((v, k) => {
                    if (v.share_group === groupId) localStore.delete(k)
                  })
                } else {
                  localStore.delete(args[0])
                }
                return { success: true }
              }
              if (sql.includes('INSERT')) {
                localStore.set(args[0], {
                  id: args[0],
                  encrypted_data: args[1],
                  iv: args[2],
                  salt: args[3],
                  file_count: args[4] || 1,
                  expires_at: args[5] || null,
                  share_group: args[6] || null,
                  segment_index: args[7] || 0,
                  total_segments: args[8] || 1,
                  owner_token: args[9] || null,
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
