import { db } from '../utils/db'
import { readSiteUrl } from '../utils/public-site-settings'
export default defineEventHandler(async (event) => {
  const site = await readSiteUrl(getRequestURL(event).origin)
  const posts = await db.post.findMany({
    where: { status: 'PUBLISHED', deletedAt: null, publishedAt: { lte: new Date() } },
    orderBy: { publishedAt: 'desc' },
    take: 50,
  })
  setHeader(event, 'content-type', 'application/atom+xml; charset=utf-8')
  return `<?xml version="1.0"?><feed xmlns="http://www.w3.org/2005/Atom"><title>Northstar</title><id>${site}</id><updated>${posts[0]?.updatedAt.toISOString() || new Date().toISOString()}</updated>${posts.map((p) => `<entry><title>${p.title.replaceAll('&', '&amp;')}</title><id>${site}/posts/${p.slug}</id><link href="${site}/posts/${p.slug}"/><updated>${p.updatedAt.toISOString()}</updated><content type="html"><![CDATA[${p.html}]]></content></entry>`).join('')}</feed>`
})
