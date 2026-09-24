import { z } from 'zod'
import { db } from '../../../utils/db'
import { requireAdmin, requireCsrf } from '../../../utils/security'
import { validateRedirect } from '../../../utils/redirect-validation'

const schema = z.object({ source: z.string().min(1).max(500), destination: z.string().min(1).max(1000),
  statusCode: z.union([z.literal(301), z.literal(302)]), enabled: z.boolean().default(true) })

export default defineEventHandler(async (event) => {
  await requireAdmin(event)
  requireCsrf(event)
  const parsed = schema.safeParse(await readBody(event))
  if (!parsed.success) throw createError({ statusCode: 400, statusMessage: '跳转数据无效' })
  const normalized = await validateRedirect(parsed.data.source, parsed.data.destination)
  if (!normalized) throw createError({ statusCode: 400, statusMessage: '跳转路径无效、重复或会形成循环' })
  return db.redirect.create({ data: { ...parsed.data, ...normalized } })
})
