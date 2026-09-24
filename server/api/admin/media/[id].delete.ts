import { db } from '../../../utils/db'
import { requireAdmin, requireCsrf } from '../../../utils/security'
import { storage } from '../../../utils/storage'

export default defineEventHandler(async (event) => {
  await requireAdmin(event)
  requireCsrf(event)
  const item = await db.media.findUnique({ where: { id: getRouterParam(event, 'id')! } })
  if (!item) throw createError({ statusCode: 404 })
  const [posts, pages, categories, series, links] = await Promise.all([
    db.post.count({
      where: {
        OR: [
          { coverUrl: item.url },
          { ogImage: item.url },
          { markdown: { contains: item.url } },
          { html: { contains: item.url } },
        ],
      },
    }),
    db.page.count({
      where: { OR: [{ markdown: { contains: item.url } }, { html: { contains: item.url } }] },
    }),
    db.category.count({ where: { coverUrl: item.url } }),
    db.series.count({ where: { coverUrl: item.url } }),
    db.link.count({ where: { logo: item.url } }),
  ])
  if (posts + pages + categories + series + links > 0)
    throw createError({ statusCode: 409, statusMessage: '该媒体仍被站点内容引用，请先移除引用' })
  if (await storage.exists(item.storageKey)) await storage.delete(item.storageKey)
  await db.media.delete({ where: { id: item.id } })
  return { ok: true }
})
