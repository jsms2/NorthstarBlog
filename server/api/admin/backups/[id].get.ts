import { createReadStream } from 'node:fs'
import { stat } from 'node:fs/promises'
import { basename, relative, resolve, sep, isAbsolute } from 'node:path'
import { sendStream, setHeader } from 'h3'
import { db } from '../../../utils/db'
import { requireAdmin } from '../../../utils/security'

export default defineEventHandler(async (event) => {
  await requireAdmin(event)
  const row = await db.backup.findUnique({ where: { id: getRouterParam(event, 'id')! } })
  if (!row || row.status !== 'READY' || basename(row.filename) !== row.filename)
    throw createError({ statusCode: 404 })
  const root = resolve(process.env.BACKUP_DIR || 'data/backups')
  const file = resolve(root, row.filename)
  const rel = relative(root, file)
  if (rel.startsWith(`..${sep}`) || rel === '..' || isAbsolute(rel))
    throw createError({ statusCode: 403 })
  try {
    await stat(file)
  } catch {
    throw createError({ statusCode: 404 })
  }
  setHeader(event, 'Content-Type', 'application/zip')
  setHeader(event, 'Content-Disposition', `attachment; filename="${row.filename}"`)
  setHeader(event, 'Cache-Control', 'private, no-store')
  return sendStream(event, createReadStream(file))
})
