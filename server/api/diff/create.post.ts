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

  // Validate size limits (max ~500KB total)
  const dataSize = JSON.stringify(body).length
  if (dataSize > 600_000) {
    throw createError({
      statusCode: 413,
      statusMessage: 'Content too large. Maximum size is ~500KB.',
    })
  }

  // Expiration: default 48 hours, max 999 hours
  const expiresInHours = Math.min(Math.max(Number(body.expiresInHours) || 48, 1), 999)
  const expiresAt = new Date(Date.now() + expiresInHours * 3600_000).toISOString()

  const id = nanoid(12)
  const db = getDB(event)

  await db
    .prepare(
      `INSERT INTO diffs (id, encrypted_data, iv, salt, file_count, expires_at) VALUES (?1, ?2, ?3, ?4, ?5, ?6)`
    )
    .bind(id, body.encryptedData, body.iv, body.salt, body.fileCount || 1, expiresAt)
    .run()

  return {
    id,
    url: `/view/${id}`,
    expiresAt,
  }
})
