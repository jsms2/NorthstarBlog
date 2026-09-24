import { z } from 'zod'
import { db } from '../../../utils/db'
import { requireAdmin, requireCsrf } from '../../../utils/security'
import { safeNavUrl } from '../../../utils/validation'

const schema = z.object({ location: z.enum(['header', 'footer']), label: z.string().min(1).max(100),
  url: z.string().max(1000), icon: z.string().max(100).optional(), newWindow: z.boolean().default(false),
  position: z.number().int().default(0), parentId: z.string().nullable().optional() })

export default defineEventHandler(async (event) => {
  await requireAdmin(event)
  requireCsrf(event)
  const parsed = schema.safeParse(await readBody(event))
  if (!parsed.success) throw createError({ statusCode: 400, statusMessage: '导航数据无效' })
  const body = parsed.data
  if (!safeNavUrl(body.url)) throw createError({ statusCode: 400, statusMessage: 'URL 仅支持站内路径或 HTTPS' })
  if (body.parentId) {
    const parent = await db.navigation.findUnique({ where: { id: body.parentId } })
    if (!parent || parent.location !== body.location || parent.parentId) throw createError({ statusCode: 400, statusMessage: '父菜单无效' })
  }
  return db.navigation.create({ data: body })
})
