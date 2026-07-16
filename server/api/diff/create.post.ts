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

  const id = nanoid(12)
  const db = getDB(event)

  await db
    .prepare(
      `INSERT INTO diffs (id, encrypted_data, iv, salt, file_count) VALUES (?1, ?2, ?3, ?4, ?5)`
    )
    .bind(id, body.encryptedData, body.iv, body.salt, body.fileCount || 1)
    .run()

  return {
    id,
    url: `/view/${id}`,
  }
})
