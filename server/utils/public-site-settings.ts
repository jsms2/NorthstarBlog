import { db } from './db'
import { resolvePublicSiteSettings, resolveSiteUrl } from '../../lib/public-site-settings'

export async function readPublicSiteSettings(requestOrigin: string) {
  const rows = await db.setting.findMany({
    where: { key: { in: ['headerHtml', 'footerHtml', 'customCss', 'siteUrl'] } },
    select: { key: true, value: true },
  })
  const values = Object.fromEntries(rows.map(row => [row.key, row.value]))
  return resolvePublicSiteSettings(values, process.env.SITE_URL, requestOrigin)
}

export async function readSiteUrl(requestOrigin: string) {
  const setting = await db.setting.findUnique({ where: { key: 'siteUrl' }, select: { value: true } })
  return resolveSiteUrl(setting?.value, process.env.SITE_URL, requestOrigin)
}
