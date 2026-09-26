import { db } from '../utils/db'
import { readSiteUrl } from '../utils/public-site-settings'

export default defineEventHandler(async (event) => {
  const site = await readSiteUrl(getRequestURL(event).origin)
  const posts = await db.post.findMany({ where: { status: 'PUBLISHED', deletedAt: null, publishedAt: { lte: new Date() } }, orderBy: { publishedAt: 'desc' }, take: 50 })
  return { version: 'https://jsonfeed.org/version/1.1', title: 'Northstar', home_page_url: site, feed_url: `${site}/feed.json`, items: posts.map(p => ({ id: `${site}/posts/${p.slug}`, url: `${site}/posts/${p.slug}`, title: p.title, content_html: p.html, summary: p.excerpt, date_published: p.publishedAt?.toISOString() })) }
})
