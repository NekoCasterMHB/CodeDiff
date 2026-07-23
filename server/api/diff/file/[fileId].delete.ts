import { getDB, initDB } from '../../../utils/db'

/**
 * Delete a single diff record by fileId + ownerToken.
 * Used when a file is removed from the editor and the share needs updating.
 */
export default defineEventHandler(async (event) => {
  await initDB(event)

  const fileId = getRouterParam(event, 'fileId')
  if (!fileId) {
    throw createError({ statusCode: 400, statusMessage: 'Missing fileId' })
  }

  const token = getQuery(event).token
  if (!token) {
    throw createError({ statusCode: 401, statusMessage: 'Missing owner token' })
  }

  const db = getDB(event)

  const record = await db
    .prepare(`SELECT id FROM diffs WHERE file_id = ?1 AND owner_token = ?2`)
    .bind(fileId, token)
    .first()

  if (!record) {
    throw createError({ statusCode: 404, statusMessage: 'Diff not found' })
  }

  await db
    .prepare(`DELETE FROM diffs WHERE file_id = ?1 AND owner_token = ?2`)
    .bind(fileId, token)
    .run()

  return { success: true }
})
