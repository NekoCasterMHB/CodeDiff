import { getDB, initDB } from '../../utils/db'

export default defineEventHandler(async (event) => {
  await initDB(event)

  const id = getRouterParam(event, 'id')

  if (!id) {
    throw createError({
      statusCode: 400,
      statusMessage: 'Missing diff ID',
    })
  }

  const db = getDB(event)
  const result = await db
    .prepare(`SELECT * FROM diffs WHERE id = ?1`)
    .bind(id)
    .first()

  if (!result) {
    throw createError({
      statusCode: 404,
      statusMessage: 'Diff not found',
    })
  }

  return {
    id: result.id as string,
    encryptedData: result.encrypted_data as string,
    iv: result.iv as string,
    salt: result.salt as string,
    fileCount: result.file_count as number,
    createdAt: result.created_at as string,
    expiresAt: result.expires_at as string,
    shareGroup: result.share_group as string | null,
    segmentIndex: (result.segment_index as number) ?? 0,
    totalSegments: (result.total_segments as number) ?? 1,
  }
})
