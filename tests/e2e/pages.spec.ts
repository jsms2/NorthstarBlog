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

test('page draft, publish, edit, slug redirect, SEO, trash and post slug coexistence', async ({ request }) => {
  const headers = await adminHeaders(request)
  const slug = `e2e-page-${Date.now()}`
  const newSlug = `${slug}-new`
  let pageId: string | undefined
  let postId: string | undefined
  try {
    const post = await request.post(`${base}/api/admin/posts`, { headers, data: { title: 'Post with shared slug', slug, markdown: 'Post content', status: 'PUBLISHED' } })
    expect(post.ok(), await post.text()).toBeTruthy()
    postId = (await post.json()).id
    const created = await request.post(`${base}/api/admin/pages`, {
      headers,
      data: { title: 'Page draft', slug, markdown: 'Draft page body', status: 'DRAFT', seoTitle: 'Page SEO Title',
        seoDescription: 'Page SEO description', noindex: true, nofollow: true, allowComments: false,
        canonicalUrl: `https://example.com/${slug}`, customCss: 'body { --e2e-page-color: rgb(1, 2, 3) }',
        customJs: 'window.__CUSTOM_JS_TEST__ = true' },
    })
    expect(created.ok(), await created.text()).toBeTruthy()
    pageId = (await created.json()).id
    expect((await request.get(`${base}/${slug}`)).status()).toBe(404)
    expect(await (await request.get(`${base}/posts/${slug}`)).text()).toContain('Post with shared slug')
    const update = (nextSlug: string, status: string, markdown: string) => request.put(`${base}/api/admin/pages/${pageId}`, {
      headers,
      data: { title: 'Page published', slug: nextSlug, markdown, status, seoTitle: 'Page SEO Title',
        seoDescription: 'Page SEO description', noindex: true, nofollow: true, allowComments: false,
        canonicalUrl: `https://example.com/${nextSlug}`, customCss: 'body { --e2e-page-color: rgb(1, 2, 3) }',
        customJs: 'window.__CUSTOM_JS_TEST__ = true' },
    })
    expect((await update(slug, 'PUBLISHED', 'First page body')).ok()).toBeTruthy()
    const publicPage = await request.get(`${base}/${slug}`)
    expect(publicPage.status()).toBe(200)
    const html = await publicPage.text()
    expect(html).toContain('First page body')
    expect(html).toContain('Page SEO Title')
    expect(html).toContain('Page SEO description')
    expect((await request.get(`${base}/posts/${slug}`)).status()).toBe(200)
    expect((await update(newSlug, 'PUBLISHED', 'Updated page body')).ok()).toBeTruthy()
    const oldPage = await request.get(`${base}/${slug}`, { maxRedirects: 0 })
    expect(oldPage.status()).toBe(301)
    expect(oldPage.headers().location).toBe(`/${newSlug}`)
    expect(await (await request.get(`${base}/${newSlug}`)).text()).toContain('Updated page body')
    expect((await request.delete(`${base}/api/admin/pages/${pageId}`, { headers })).ok()).toBeTruthy()
    expect((await request.get(`${base}/${newSlug}`)).status()).toBe(404)
    expect((await request.delete(`${base}/api/admin/pages/${pageId}?permanent=true`, { headers })).ok()).toBeTruthy()
    expect(await db.page.findUnique({ where: { id: pageId } })).toBeNull()
  } finally {
    if (pageId) await db.page.deleteMany({ where: { id: pageId } })
    if (postId) await db.post.deleteMany({ where: { id: postId } })
    await db.redirect.deleteMany({ where: { source: `/${slug}` } })
  }
})

test('page comment toggle gates submissions and public responses hide private fields', async ({ request }) => {
  const headers = await adminHeaders(request)
  const slug = `e2e-page-comments-${Date.now()}`
  let pageId: string | undefined
  try {
    const created = await request.post(`${base}/api/admin/pages`, { headers,
      data: { title: 'Page comments', slug, markdown: 'Page body', status: 'PUBLISHED', allowComments: false } })
    expect(created.ok(), await created.text()).toBeTruthy()
    pageId = (await created.json()).id
    const comment = { authorName: 'Guest', email: 'private@example.com', content: 'A page comment' }
    expect((await request.post(`${base}/api/public/pages/${pageId}/comments`, { data: comment })).status()).toBe(404)
    const enabled = await request.put(`${base}/api/admin/pages/${pageId}`, { headers,
      data: { title: 'Page comments', slug, markdown: 'Page body', status: 'PUBLISHED', allowComments: true } })
    expect(enabled.ok(), await enabled.text()).toBeTruthy()
    const submitted = await request.post(`${base}/api/public/pages/${pageId}/comments`, { data: comment })
    expect(submitted.ok(), await submitted.text()).toBeTruthy()
    const pending = await db.comment.findFirstOrThrow({ where: { pageId }, select: { id: true, status: true } })
    expect(pending.status).toBe('PENDING')
    expect((await request.get(`${base}/api/public/pages/${slug}`)).ok()).toBeTruthy()
    const approved = await request.patch(`${base}/api/admin/comments/${pending.id}`, { headers, data: { status: 'APPROVED' } })
    expect(approved.ok(), await approved.text()).toBeTruthy()
    const publicPage = await request.get(`${base}/api/public/pages/${slug}`)
    const content = await publicPage.text()
    expect(content).toContain('A page comment')
    expect(content).not.toContain('private@example.com')
    expect(content).not.toContain('ipHash')
    expect(await (await request.get(`${base}/${slug}`)).text()).toContain('A page comment')
    const disabled = await request.put(`${base}/api/admin/pages/${pageId}`, { headers,
      data: { title: 'Page comments', slug, markdown: 'Page body', status: 'PUBLISHED', allowComments: false } })
    expect(disabled.ok(), await disabled.text()).toBeTruthy()
    expect((await request.post(`${base}/api/public/pages/${pageId}/comments`, { data: comment })).status()).toBe(404)
  } finally {
    if (pageId) await db.page.deleteMany({ where: { id: pageId } })
  }
})

test('page custom CSS and JS execute publicly but not in the admin', async ({ request, page }) => {
  const headers = await adminHeaders(request)
  const slug = `e2e-page-script-${Date.now()}`
  let pageId: string | undefined
  try {
    const created = await request.post(`${base}/api/admin/pages`, { headers,
      data: { title: 'Page scripts', slug, markdown: 'Page body', status: 'PUBLISHED',
        customCss: 'body { --e2e-page-color: rgb(1, 2, 3) }', customJs: 'window.__CUSTOM_JS_TEST__ = true' } })
    expect(created.ok(), await created.text()).toBeTruthy()
    pageId = (await created.json()).id
    await page.goto(`${base}/${slug}`)
    await expect.poll(() => page.evaluate(() => (window as Window & { __CUSTOM_JS_TEST__?: boolean }).__CUSTOM_JS_TEST__)).toBe(true)
    expect(await page.evaluate(() => getComputedStyle(document.body).getPropertyValue('--e2e-page-color').trim())).toBe('rgb(1, 2, 3)')
    await page.goto(`${base}/admin/login`)
    expect(await page.evaluate(() => (window as Window & { __CUSTOM_JS_TEST__?: boolean }).__CUSTOM_JS_TEST__)).toBeUndefined()
  } finally {
    if (pageId) await db.page.deleteMany({ where: { id: pageId } })
  }
})
