import { rm } from 'node:fs/promises'
import { basename, relative, resolve, sep, isAbsolute } from 'node:path'
import { db } from '../../../utils/db'
import { requireAdmin, requireCsrf } from '../../../utils/security'

export default defineEventHandler(async (event) => {
  await requireAdmin(event)
  requireCsrf(event)
  const row = await db.backup.findUnique({ where: { id: getRouterParam(event, 'id')! } })
  if (!row) throw createError({ statusCode: 404 })
  if (basename(row.filename) !== row.filename) throw createError({ statusCode: 400 })
  const root = resolve(process.env.BACKUP_DIR || 'data/backups')
  const file = resolve(root, row.filename)
  const rel = relative(root, file)
  if (rel.startsWith(`..${sep}`) || rel === '..' || isAbsolute(rel))
    throw createError({ statusCode: 403 })
  await rm(file, { force: true })
  await db.backup.delete({ where: { id: row.id } })
  return { ok: true }
})
