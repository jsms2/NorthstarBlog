import { z } from 'zod'
import type { Prisma } from '@prisma/client'
import { db } from '../../utils/db'
import { requireAdmin, requireCsrf } from '../../utils/security'
import { normalizeSiteUrl } from '../../../lib/public-site-settings'

const settingsSchema = z.record(z.string(), z.union([z.string(), z.number(), z.boolean(), z.record(z.string(), z.unknown())]))

export default defineEventHandler(async (event) => {
  await requireAdmin(event)
  requireCsrf(event)
  const body = settingsSchema.parse(await readBody(event))
  if ('siteName' in body && !z.string().trim().min(1).max(100).safeParse(body.siteName).success)
    throw createError({ statusCode: 400, statusMessage: '站点名称不能为空且不能超过 100 字符' })
  if ('accentColor' in body && (typeof body.accentColor !== 'string' || !/^#[0-9a-fA-F]{6}$/.test(body.accentColor)))
    throw createError({ statusCode: 400, statusMessage: '强调色无效' })
  if ('siteUrl' in body && (typeof body.siteUrl !== 'string' || (body.siteUrl.trim() && !normalizeSiteUrl(body.siteUrl))))
    throw createError({ statusCode: 400, statusMessage: '站点 URL 必须是有效的 HTTP 或 HTTPS 地址' })
  for (const key of ['headerHtml', 'footerHtml', 'customCss']) {
    if (key in body && (typeof body[key] !== 'string' || body[key].length > 50_000))
      throw createError({ statusCode: 400, statusMessage: `${key} 不能超过 50000 字符` })
  }
  await db.$transaction(Object.entries(body).map(([key, value]) => {
    const json = value as Prisma.InputJsonValue
    return db.setting.upsert({ where: { key }, update: { value: json }, create: { key, value: json, group: 'general' } })
  }))
  return { ok: true }
})
