import { z } from 'zod'
import { db } from '../../../utils/db'
import { requireAdmin, requireCsrf } from '../../../utils/security'
import { safeNavUrl } from '../../../utils/validation'

const schema = z.object({ location: z.enum(['header', 'footer']), label: z.string().min(1).max(100),
  url: z.string().max(1000), icon: z.string().max(100).nullable().optional(), newWindow: z.boolean(),
  position: z.number().int(), parentId: z.string().nullable() })

export default defineEventHandler(async (event) => {
  await requireAdmin(event)
  requireCsrf(event)
  const parsed = schema.safeParse(await readBody(event))
  if (!parsed.success) throw createError({ statusCode: 400, statusMessage: '导航数据无效' })
  const body = parsed.data
  const id = getRouterParam(event, 'id')!
  if (!safeNavUrl(body.url) || body.parentId === id) throw createError({ statusCode: 400, statusMessage: '无效 URL 或父级' })
  if (body.parentId) {
    const parent = await db.navigation.findUnique({ where: { id: body.parentId } })
    if (!parent || parent.location !== body.location || parent.parentId) throw createError({ statusCode: 400, statusMessage: '父菜单无效' })
  }
  if (await db.navigation.count({ where: { parentId: id } }) && body.parentId)
    throw createError({ statusCode: 400, statusMessage: '含子项的菜单不能成为子项' })
  return db.navigation.update({ where: { id }, data: body })
})
