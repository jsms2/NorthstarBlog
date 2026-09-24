import { db } from '../../../utils/db'
import { requireAdmin } from '../../../utils/security'

export default defineEventHandler(async (event) => {
  await requireAdmin(event)
  const backups = await db.backup.findMany({
    orderBy: { createdAt: 'desc' },
    select: { id: true, filename: true, size: true, status: true, createdAt: true },
  })
  return backups.map(backup => ({ ...backup, size: backup.size.toString() }))
})
