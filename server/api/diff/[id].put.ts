import { getDB, initDB } from '../../utils/db'

export default defineEventHandler(async (event) => {
  await initDB(event)

  const id = getRouterParam(event, 'id')

  if (!id) {
    throw createError({ statusCode: 400, statusMessage: 'Missing diff ID' })
  }

  const body = await readBody(event)

  if (!body || !body.encryptedData || !body.iv || !body.salt || !body.ownerToken) {
    throw createError({
      statusCode: 400,
      statusMessage: 'Missing required fields: encryptedData, iv, salt, ownerToken',
    })
  }

  const db = getDB(event)

  // Verify ownership
  const record = await db
    .prepare(`SELECT owner_token FROM diffs WHERE id = ?1`)
    .bind(id)
    .first()

  if (!record) {
    throw createError({ statusCode: 404, statusMessage: 'Diff not found' })
  }

  if ((record as any).owner_token !== body.ownerToken) {
    throw createError({ statusCode: 403, statusMessage: 'Forbidden' })
  }

  // Recalculate expiration
  const expiresInDays = Math.min(Math.max(Number(body.expiresInDays) || 3, 1), 30)
  const now = new Date()
  const jstNow = new Date(now.getTime() + 9 * 3600_000)
  jstNow.setUTCDate(jstNow.getUTCDate() + expiresInDays)
  jstNow.setUTCHours(23, 59, 59, 999)
  const expiresAt = new Date(jstNow.getTime() - 9 * 3600_000)
  const expiresAtStr = expiresAt.toISOString()

  await db
    .prepare(
      `UPDATE diffs SET encrypted_data = ?1, iv = ?2, salt = ?3, file_count = ?4, expires_at = ?5 WHERE id = ?6`
    )
    .bind(body.encryptedData, body.iv, body.salt, body.fileCount || 1, expiresAtStr, id)
    .run()

  return { success: true, id, expiresAt: expiresAtStr }
})
