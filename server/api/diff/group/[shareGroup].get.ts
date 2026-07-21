import { getDB, initDB } from '../../../utils/db'

export default defineEventHandler(async (event) => {
  await initDB(event)

  const shareGroup = getRouterParam(event, 'shareGroup')

  if (!shareGroup) {
    throw createError({ statusCode: 400, statusMessage: 'Missing shareGroup' })
  }

  const db = getDB(event)

  const results = await db
    .prepare(`SELECT id, encrypted_data, iv, salt, segment_index, total_segments FROM diffs WHERE share_group = ?1 ORDER BY segment_index ASC`)
    .bind(shareGroup)
    .all()

  const rows = results.results || results || []

  return rows.map((r: any) => ({
    id: r.id as string,
    encryptedData: r.encrypted_data as string,
    iv: r.iv as string,
    salt: r.salt as string,
    segmentIndex: (r.segment_index as number) ?? 0,
    totalSegments: (r.total_segments as number) ?? 1,
  }))
})
