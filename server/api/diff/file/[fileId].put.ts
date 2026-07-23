import { getDB, initDB } from '../../../utils/db'

/**
 * Update a diff record by fileId + ownerToken.
 * Used for precise single-file updates without changing the URL.
 */
export default defineEventHandler(async (event) => {
  await initDB(event)

  const fileId = getRouterParam(event, 'fileId')
  if (!fileId) {
    throw createError({ statusCode: 400, statusMessage: 'Missing fileId' })
  }

  const body = await readBody(event)

  if (!body || !body.encryptedData || !body.iv || !body.salt || !body.ownerToken) {
    throw createError({
      statusCode: 400,
      statusMessage: 'Missing required fields: encryptedData, iv, salt, ownerToken',
    })
  }

  const db = getDB(event)

  let record = await db
    .prepare(`SELECT id FROM diffs WHERE file_id = ?1 AND owner_token = ?2`)
    .bind(fileId, body.ownerToken)
    .first()

  // Fallback: old records without file_id — match by share_group
  if (!record && body.shareGroup) {
    record = await db
      .prepare(`SELECT id FROM diffs WHERE share_group = ?1 AND owner_token = ?2 LIMIT 1`)
      .bind(body.shareGroup, body.ownerToken)
      .first()
    // If found, fill in the file_id for future lookups
    if (record) {
      await db
        .prepare(`UPDATE diffs SET file_id = ?1 WHERE id = ?2`)
        .bind(fileId, (record as any).id)
        .run()
    }
  }

  if (!record) {
    throw createError({ statusCode: 404, statusMessage: 'Diff not found' })
  }

  await db
    .prepare(`UPDATE diffs SET encrypted_data = ?1, iv = ?2, salt = ?3 WHERE file_id = ?4 AND owner_token = ?5`)
    .bind(body.encryptedData, body.iv, body.salt, fileId, body.ownerToken)
    .run()

  return { success: true, id: (record as any).id }
})
