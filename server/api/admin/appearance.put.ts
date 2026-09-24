import { db } from '../../utils/db'
import { appearanceSchema } from '../../utils/appearance'
import { requireAdmin, requireCsrf } from '../../utils/security'
import type { Prisma } from '@prisma/client'

export default defineEventHandler(async (event) => {
  await requireAdmin(event)
  requireCsrf(event)
  const parsed = appearanceSchema.safeParse(await readBody(event))
  if (!parsed.success) throw createError({ statusCode: 400, statusMessage: '外观数据无效' })
  await db.$transaction(Object.entries(parsed.data).map(([key, value]) => db.setting.upsert({ where: { key },
    update: { value: value as Prisma.InputJsonValue }, create: { key, group: 'appearance', value: value as Prisma.InputJsonValue } })))
  return parsed.data
})
