import { nanoid } from 'nanoid'
import { getDB, initDB } from '../../utils/db'

export default defineEventHandler(async (event) => {
  await initDB(event)

  const body = await readBody(event)

  if (!body || !body.encryptedData || !body.iv || !body.salt) {
    throw createError({
      statusCode: 400,
      statusMessage: 'Missing required fields: encryptedData, iv, salt',
    })
  }

  // Size limit temporarily disabled for testing
  // const dataSize = JSON.stringify(body).length
  // if (dataSize > 1_000_000) { throw createError({ statusCode: 413, statusMessage: 'Content too large.' }) }

  // Expiration: default 2 days, max 30 days
  // GitHub Actions cron runs at JST 00:00 (UTC 15:00) — store at JST 23:59:59 (= UTC 14:59:59)
  const expiresInDays = Math.min(Math.max(Number(body.expiresInDays) || 3, 1), 30)
  const now = new Date()
  // Shift to JST (UTC+9) for date calculation
  const jstNow = new Date(now.getTime() + 9 * 3600_000)
  jstNow.setUTCDate(jstNow.getUTCDate() + expiresInDays)
  jstNow.setUTCHours(23, 59, 59, 999)
  // Convert back to UTC for storage
  const expiresAt = new Date(jstNow.getTime() - 9 * 3600_000)
  const expiresAtStr = expiresAt.toISOString()

  const id = nanoid(12)
  const db = getDB(event)

  const shareGroup = body.shareGroup || null
  const segmentIndex = body.segmentIndex ?? 0
  const totalSegments = body.totalSegments ?? 1
  const ownerToken = body.ownerToken || null

  await db
    .prepare(
      `INSERT INTO diffs (id, encrypted_data, iv, salt, file_count, expires_at, share_group, segment_index, total_segments, owner_token) VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, ?9, ?10)`
    )
    .bind(id, body.encryptedData, body.iv, body.salt, body.fileCount || 1, expiresAtStr, shareGroup, segmentIndex, totalSegments, ownerToken)
    .run()

  return {
    id,
    url: `/view/${id}`,
    expiresAt: expiresAtStr,
    shareGroup,
    segmentIndex,
    totalSegments,
  }
})
