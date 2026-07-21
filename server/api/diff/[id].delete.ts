import { getDB, initDB } from '../../utils/db'

export default defineEventHandler(async (event) => {
  await initDB(event)

  const id = getRouterParam(event, 'id')

  if (!id) {
    throw createError({ statusCode: 400, statusMessage: 'Missing diff ID' })
  }

  const db = getDB(event)

  // If it's part of a share group, delete all segments
  // Verify owner token — only the creator can delete
  const token = getQuery(event).token
  if (!token) {
    throw createError({ statusCode: 401, statusMessage: 'Missing owner token' })
  }

  const record = await db
    .prepare(`SELECT share_group, owner_token FROM diffs WHERE id = ?1`)
    .bind(id)
    .first()

  if (!record) {
    throw createError({ statusCode: 404, statusMessage: 'Diff not found' })
  }

  if ((record as any).owner_token !== token) {
    throw createError({ statusCode: 403, statusMessage: 'Forbidden' })
  }

  if ((record as any).share_group) {
    await db
      .prepare(`DELETE FROM diffs WHERE share_group = ?1`)
      .bind((record as any).share_group)
      .run()
  } else {
    await db
      .prepare(`DELETE FROM diffs WHERE id = ?1`)
      .bind(id)
      .run()
  }

  return { success: true }
})
