import { readSiteUrl } from '../utils/public-site-settings'

export default defineEventHandler(async (event) => {
  setHeader(event, 'content-type', 'text/plain')
  const site = await readSiteUrl(getRequestURL(event).origin)
  return `User-agent: *\nAllow: /\nDisallow: /admin\nDisallow: /api/admin\nSitemap: ${site}/sitemap.xml\n`
})
