import { db } from '../../utils/db'
import { requireAdmin } from '../../utils/security'
import { appearanceDefaults } from '../../utils/appearance'

export default defineEventHandler(async (event) => {
  await requireAdmin(event)
  const rows = await db.setting.findMany()
  const values = Object.fromEntries(rows.map(row => [row.key, row.value]))
  return {
    description: '一个关于技术、生活与创造的个人博客',
    ...values,
    siteName: typeof values.siteName === 'string' && values.siteName.trim()
      ? values.siteName
      : appearanceDefaults.siteName,
  }
})
