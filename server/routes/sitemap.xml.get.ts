import { db } from '../utils/db'
import { readSiteUrl } from '../utils/public-site-settings'
export default defineEventHandler(async (event) => {
  const site = await readSiteUrl(getRequestURL(event).origin)
  const [posts, pages] = await Promise.all([
    db.post.findMany({
      where: { status: 'PUBLISHED', noindex: false, deletedAt: null, publishedAt: { lte: new Date() } },
      select: { slug: true, updatedAt: true },
    }),
    db.page.findMany({ where: { status: 'PUBLISHED', noindex: false, deletedAt: null, publishedAt: { lte: new Date() } }, select: { slug: true, updatedAt: true } }),
  ])
  setHeader(event, 'content-type', 'application/xml')
  return `<?xml version="1.0" encoding="UTF-8"?><urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9"><url><loc>${site}</loc></url>${posts.map((p) => `<url><loc>${site}/posts/${p.slug}</loc><lastmod>${p.updatedAt.toISOString()}</lastmod></url>`).join('')}${pages.map((p) => `<url><loc>${site}/${p.slug}</loc><lastmod>${p.updatedAt.toISOString()}</lastmod></url>`).join('')}</urlset>`
})
