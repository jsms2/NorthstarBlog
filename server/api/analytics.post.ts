import { createHash } from 'node:crypto'
import { UAParser } from 'ua-parser-js'
import { z } from 'zod'
import { db } from '../utils/db'
import { rateLimit } from '../utils/security'
const schema = z.object({
  path: z.string().min(1).max(500),
  utmSource: z.string().max(191).optional(),
  utmMedium: z.string().max(191).optional(),
  utmCampaign: z.string().max(191).optional(),
})
export default defineEventHandler(async (event) => {
  const enabled = await db.setting.findUnique({ where: { key: 'analyticsEnabled' }, select: { value: true } })
  if (enabled?.value === false) return { ok: true, tracked: false }
  if (getCookie(event, 'northstar_session')) return { ok: true, tracked: false }
  rateLimit(event, 'analytics', 120, 60_000)
  const ua = getHeader(event, 'user-agent') || ''
  if (/bot|crawl|spider|slurp|preview|headless/i.test(ua)) return { ok: true, tracked: false }
  const b = schema.parse(await readBody(event))
  if (!b.path.startsWith('/') || b.path.startsWith('//')) throw createError({ statusCode: 400 })
  const path = b.path.split('?')[0]!.slice(0, 500)
  const ip = getRequestIP(event, { xForwardedFor: process.env.TRUST_PROXY === 'true' }) || 'unknown'
  const privacyIp = ip.includes('.')
    ? ip.split('.').slice(0, 3).join('.')
    : ip.split(':').slice(0, 4).join(':')
  const day = new Date()
  const date = new Date(Date.UTC(day.getUTCFullYear(), day.getUTCMonth(), day.getUTCDate()))
  const secret = process.env.ENCRYPTION_SECRET || 'development-only'
  const visitorHash = createHash('sha256')
    .update(`${secret}:${date.toISOString()}:${privacyIp}:${ua.slice(0, 180)}`)
    .digest('hex')
  const ref = getHeader(event, 'referer')
  let referrer = 'Direct'
  if (ref) {
    try {
      const u = new URL(ref)
      const site = new URL(process.env.SITE_URL || getRequestURL(event).origin)
      if (u.host !== site.host) referrer = u.origin.slice(0, 500)
    } catch {
      referrer = 'Direct'
    }
  }
  const parsed = new UAParser(ua).getResult()
  const browser = parsed.browser.name || 'Unknown'
  const os = parsed.os.name || 'Unknown'
  const device = parsed.device.type || 'desktop'
  let postId: string | null = null
  const match = path.match(/^\/posts\/([^/]+)$/)
  if (match) {
    const p = await db.post.findFirst({
      where: { slug: match[1], status: 'PUBLISHED' },
      select: { id: true },
    })
    postId = p?.id || null
  }
  const dimensions = [
    ['site', 'all'],
    ['path', path],
    ['referrer', referrer],
    ['browser', browser],
    ['os', os],
    ['device', device],
  ] as const
  await db.$transaction(async (tx) => {
    const result = await tx.analyticsVisitorDay.createMany({
      data: { date, visitorHash },
      skipDuplicates: true,
    })
    await tx.analyticsEvent.create({
      data: {
        path,
        postId,
        visitorHash,
        referrer: referrer === 'Direct' ? null : referrer,
        utmSource: b.utmSource,
        utmMedium: b.utmMedium,
        utmCampaign: b.utmCampaign,
        browser,
        os,
        device,
      },
    })
    for (const [dimension, value] of dimensions) {
      await tx.analyticsAggregate.upsert({
        where: { date_dimension_value: { date, dimension, value } },
        create: { date, path, dimension, value, views: 1, visitors: result.count ? 1 : 0 },
        update: {
          views: { increment: 1 },
          ...(result.count ? { visitors: { increment: 1 } } : {}),
        },
      })
    }
  })
  return { ok: true, tracked: true }
})
