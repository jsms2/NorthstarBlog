import { setHeader } from 'h3'
import { db } from '../utils/db'
const x = (s: string) =>
  s.replace(
    /[<>&'"]/g,
    (c) => ({ '<': '&lt;', '>': '&gt;', '&': '&amp;', "'": '&apos;', '"': '&quot;' })[c]!,
  )
export default defineEventHandler(async (event) => {
  const site = process.env.SITE_URL || getRequestURL(event).origin
  const posts = await db.post.findMany({
    where: { status: 'PUBLISHED', deletedAt: null, publishedAt: { lte: new Date() } },
    orderBy: { publishedAt: 'desc' },
    take: 50,
  })
  setHeader(event, 'content-type', 'application/rss+xml; charset=utf-8')
  return `<?xml version="1.0" encoding="UTF-8"?><rss version="2.0"><channel><title>Northstar</title><link>${x(site)}</link><description>最新文章</description>${posts.map((p) => `<item><title>${x(p.title)}</title><link>${x(`${site}/posts/${p.slug}`)}</link><guid>${x(`${site}/posts/${p.slug}`)}</guid><pubDate>${p.publishedAt?.toUTCString()}</pubDate><description><![CDATA[${p.html}]]></description></item>`).join('')}</channel></rss>`
})
