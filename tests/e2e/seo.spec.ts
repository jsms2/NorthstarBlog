import { expect, test, type APIRequestContext } from '@playwright/test'
import { e2eAdminPassword } from './support/credentials'
import { db } from '../../server/utils/db'

const base = 'http://127.0.0.1:3000'
async function adminHeaders(request: APIRequestContext) {
  const response = await request.post(`${base}/api/auth/login`, {
    data: { login: 'admin@example.com', password: e2eAdminPassword() },
    headers: { 'x-forwarded-for': `198.51.100.${Math.floor(Math.random() * 200) + 1}` },
  })
  expect(response.ok(), await response.text()).toBeTruthy()
  const body = await response.json()
  const session = response.headers()['set-cookie']?.match(/northstar_session=([^;]+)/)?.[1]
  return { Cookie: `northstar_session=${session}; northstar_csrf=${body.csrf}`, 'x-csrf-token': body.csrf as string, Origin: base }
}

test('production SSR post/page metadata responds to admin edits', async ({ request }) => {
  const auth = await adminHeaders(request)
  const slug = `e2e-seo-${Date.now()}`
  const pageSlug = `${slug}-page`
  let postId: string | undefined
  let pageId: string | undefined
  try {
    const post = await request.post(`${base}/api/admin/posts`, { headers: auth,
      data: { title: 'Original SEO Post', slug, markdown: 'SEO body', status: 'PUBLISHED',
        excerpt: 'Original excerpt', seoTitle: 'Custom Search Title', seoDescription: 'Custom search description',
        ogTitle: 'Custom OG Title', ogDescription: 'Custom OG Description',
        ogImage: 'https://example.com/social.jpg', canonicalUrl: 'https://example.com/canonical',
        noindex: true, nofollow: true } })
    expect(post.ok(), await post.text()).toBeTruthy()
    postId = (await post.json()).id
    const html = await (await request.get(`${base}/posts/${slug}`)).text()
    expect(html).toContain('<title>Custom Search Title')
    expect(html).toContain('name="description" content="Custom search description"')
    expect(html).toContain('rel="canonical" href="https://example.com/canonical"')
    expect(html).toContain('property="og:title" content="Custom OG Title"')
    expect(html).toContain('property="og:description" content="Custom OG Description"')
    expect(html).toContain('property="og:image" content="https://example.com/social.jpg"')
    expect(html).toContain('name="twitter:card" content="summary_large_image"')
    expect(html).toContain('name="twitter:title" content="Custom OG Title"')
    expect(html).toContain('name="twitter:description" content="Custom OG Description"')
    expect(html).toContain('name="robots" content="noindex,nofollow"')
    expect(html).toContain('application/ld+json')
    expect(html).toContain('BlogPosting')
    await db.post.update({ where: { id: postId }, data: { seoTitle: 'Edited Search Title', ogTitle: 'Edited OG Title', noindex: false } })
    const edited = await (await request.get(`${base}/posts/${slug}`)).text()
    expect(edited).toContain('Edited Search Title')
    expect(edited).toContain('Edited OG Title')
    expect(edited).toContain('name="robots" content="index,nofollow"')

    const page = await request.post(`${base}/api/admin/pages`, { headers: auth,
      data: { title: 'Original SEO Page', slug: pageSlug, markdown: 'Page body', status: 'PUBLISHED',
        seoTitle: 'Page Search Title', seoDescription: 'Page search description', ogTitle: 'Page OG Title',
        ogDescription: 'Page OG Description', ogImage: 'https://example.com/page-social.jpg',
        canonicalUrl: 'https://example.com/page-canonical', noindex: true, nofollow: true } })
    expect(page.ok(), await page.text()).toBeTruthy()
    pageId = (await page.json()).id
    const pageHtml = await (await request.get(`${base}/${pageSlug}`)).text()
    expect(pageHtml).toContain('Page Search Title')
    expect(pageHtml).toContain('Page search description')
    expect(pageHtml).toContain('Page OG Title')
    expect(pageHtml).toContain('Page OG Description')
    expect(pageHtml).toContain('https://example.com/page-social.jpg')
    expect(pageHtml).toContain('https://example.com/page-canonical')
    expect(pageHtml).toContain('twitter:card')
    expect(pageHtml).toContain('noindex,nofollow')
    expect(pageHtml).toContain('WebPage')
  } finally {
    if (postId) await db.post.deleteMany({ where: { id: postId } })
    if (pageId) await db.page.deleteMany({ where: { id: pageId } })
  }
})

test('sitemap, all feeds and llms expose only currently public content', async ({ request }) => {
  const admin = await db.admin.findFirstOrThrow()
  const stamp = Date.now()
  const prefix = `e2e-seo-filter-${stamp}`
  const ids: string[] = []
  const pageIds: string[] = []
  try {
    for (const [suffix, status, publishedAt, deletedAt, noindex] of [
      ['public', 'PUBLISHED', new Date(), null, false],
      ['draft', 'DRAFT', null, null, false],
      ['private', 'PRIVATE', null, null, false],
      ['scheduled', 'SCHEDULED', null, null, false],
      ['future', 'PUBLISHED', new Date(Date.now() + 86_400_000), null, false],
      ['trash', 'TRASH', new Date(), new Date(), false],
      ['noindex', 'PUBLISHED', new Date(), null, true],
    ] as const) {
      const post = await db.post.create({ data: { title: `${prefix}-${suffix}`, slug: `${prefix}-${suffix}`,
        markdown: 'Body', html: '<p>Body</p>', searchText: 'Body', authorId: admin.id,
        status, publishedAt, deletedAt, noindex } })
      ids.push(post.id)
    }
    for (const [suffix, noindex] of [['public', false], ['noindex', true]] as const) {
      const page = await db.page.create({ data: { title: `${prefix}-page-${suffix}`, slug: `${prefix}-page-${suffix}`,
        markdown: 'Body', html: '<p>Body</p>', status: 'PUBLISHED', publishedAt: new Date(),
        authorId: admin.id, noindex } })
      pageIds.push(page.id)
    }
    const sitemap = await (await request.get(`${base}/sitemap.xml`)).text()
    expect(sitemap).toContain(`${prefix}-public`)
    expect(sitemap).toContain(`${prefix}-page-public`)
    for (const suffix of ['draft', 'private', 'scheduled', 'future', 'trash', 'noindex', 'page-noindex'])
      expect(sitemap).not.toContain(`${prefix}-${suffix}`)
    for (const path of ['/rss.xml', '/atom.xml', '/feed.json', '/llms.txt']) {
      const response = await request.get(`${base}${path}`)
      expect(response.ok(), path).toBeTruthy()
      const body = await response.text()
      expect(body, path).toContain(`${prefix}-public`)
      for (const suffix of ['draft', 'private', 'scheduled', 'future', 'trash'])
        expect(body, path).not.toContain(`${prefix}-${suffix}`)
    }
  } finally {
    await db.post.deleteMany({ where: { id: { in: ids } } })
    await db.page.deleteMany({ where: { id: { in: pageIds } } })
  }
})
