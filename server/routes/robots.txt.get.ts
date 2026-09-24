import { setHeader } from 'h3'
export default defineEventHandler((event) => {
  setHeader(event, 'content-type', 'text/plain')
  const site = process.env.SITE_URL || getRequestURL(event).origin
  return `User-agent: *\nAllow: /\nDisallow: /admin\nDisallow: /api/admin\nSitemap: ${site}/sitemap.xml\n`
})
