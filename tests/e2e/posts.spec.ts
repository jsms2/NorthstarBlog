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

test('post metadata, taxonomy, series and publish transitions reach the public HTML', async ({ request }) => {
  const headers = await adminHeaders(request)
  const suffix = Date.now()
  const slug = `e2e-post-matrix-${suffix}`
  const changedSlug = `${slug}-renamed`
  const categorySlug = `e2e-post-category-${suffix}`
  const tagSlug = `e2e-post-tag-${suffix}`
  const seriesSlug = `e2e-post-series-${suffix}`
  let postId: string | undefined
  let categoryId: string | undefined
  let tagId: string | undefined
  let seriesId: string | undefined
  try {
    const category = await request.post(`${base}/api/admin/categories`, { headers, data: { name: 'E2E Category', slug: categorySlug, description: 'Category description', position: 0 } })
    expect(category.ok(), await category.text()).toBeTruthy()
    categoryId = (await category.json()).id
    const tag = await request.post(`${base}/api/admin/tags`, { headers, data: { name: 'E2E Tag', slug: tagSlug, color: '#123456' } })
    expect(tag.ok(), await tag.text()).toBeTruthy()
    tagId = (await tag.json()).id
    const created = await request.post(`${base}/api/admin/posts`, {
      headers,
      data: {
        title: 'Post matrix draft', slug, markdown: 'Draft text', status: 'DRAFT', categoryId, tagIds: [tagId],
        featured: true, pinned: true, coverUrl: 'https://example.com/e2e-cover.webp', allowComments: false,
        showToc: false, seoTitle: 'E2E SEO title', seoDescription: 'E2E SEO description',
        canonicalUrl: `https://example.com/posts/${slug}`, noindex: true, nofollow: true,
        ogImage: 'https://example.com/e2e-og.webp',
      },
    })
    expect(created.ok(), `${created.status()} ${await created.text()}`).toBeTruthy()
    postId = (await created.json()).id
    expect((await request.get(`${base}/posts/${slug}`)).status()).toBe(404)
    const stored = await db.post.findUniqueOrThrow({ where: { id: postId }, include: { tags: true } })
    expect(stored).toMatchObject({ status: 'DRAFT', featured: true, pinned: true, showToc: false, allowComments: false, categoryId, coverUrl: 'https://example.com/e2e-cover.webp', noindex: true, nofollow: true })
    expect(stored.tags.map(tag => tag.tagId)).toEqual([tagId])
    const series = await request.post(`${base}/api/admin/series`, { headers, data: { name: 'E2E Series', slug: seriesSlug, description: 'Series description', postIds: [postId] } })
    expect(series.ok(), await series.text()).toBeTruthy()
    seriesId = (await series.json()).id
    const update = (status: string, markdown: string, nextSlug = slug) => request.put(`${base}/api/admin/posts/${postId}`, {
      headers,
      data: { title: 'Post matrix published', slug: nextSlug, markdown, status, categoryId, tagIds: [tagId], featured: true, pinned: true,
        coverUrl: 'https://example.com/e2e-cover.webp', allowComments: false, showToc: false,
        seoTitle: 'E2E SEO title', seoDescription: 'E2E SEO description', canonicalUrl: `https://example.com/posts/${nextSlug}`,
        noindex: true, nofollow: true, ogImage: 'https://example.com/e2e-og.webp' },
    })
    expect((await update('PUBLISHED', 'First published body')).ok()).toBeTruthy()
    const publicPage = await request.get(`${base}/posts/${slug}`)
    expect(publicPage.status()).toBe(200)
    expect(await publicPage.text()).toContain('First published body')
    expect((await request.get(`${base}/api/public/series/${seriesSlug}`)).ok()).toBeTruthy()
    expect((await update('PUBLISHED', 'Edited published body')).ok()).toBeTruthy()
    expect(await (await request.get(`${base}/posts/${slug}`)).text()).toContain('Edited published body')
    expect((await update('DRAFT', 'Edited published body')).ok()).toBeTruthy()
    expect((await request.get(`${base}/posts/${slug}`)).status()).toBe(404)
    expect((await update('PUBLISHED', 'Edited published body', changedSlug)).ok()).toBeTruthy()
    const oldUrl = await request.get(`${base}/posts/${slug}`, { maxRedirects: 0 })
    expect(oldUrl.status()).toBe(301)
    expect(oldUrl.headers().location).toBe(`/posts/${changedSlug}`)
    expect((await request.get(`${base}/posts/${changedSlug}`)).status()).toBe(200)
    expect((await db.post.findUniqueOrThrow({ where: { id: postId } })).status).toBe('PUBLISHED')
  } finally {
    if (postId) await db.post.deleteMany({ where: { id: postId } })
    if (seriesId) await db.series.deleteMany({ where: { id: seriesId } })
    if (tagId) await db.tag.deleteMany({ where: { id: tagId } })
    if (categoryId) await db.category.deleteMany({ where: { id: categoryId } })
    await db.redirect.deleteMany({ where: { source: `/posts/${slug}` } })
  }
})

test('scheduled posts require a publication time', async ({ request }) => {
  const headers = await adminHeaders(request)
  const slug = `e2e-invalid-schedule-${Date.now()}`
  const response = await request.post(`${base}/api/admin/posts`, { headers, data: { title: 'Invalid schedule', slug, markdown: 'body', status: 'SCHEDULED' } })
  expect(response.status()).toBe(400)
  expect(await db.post.findUnique({ where: { slug } })).toBeNull()
})

test('the admin editor autosaves a changed draft after its debounce', async ({ request, page }) => {
  test.setTimeout(60_000)
  const headers = await adminHeaders(request)
  const slug = `e2e-autosave-${Date.now()}`
  const created = await request.post(`${base}/api/admin/posts`, {
    headers,
    data: { title: 'Before autosave', slug, markdown: 'Initial body', status: 'DRAFT' },
  })
  expect(created.ok(), await created.text()).toBeTruthy()
  const postId = (await created.json()).id as string
  try {
    const session = /northstar_session=([^;]+)/.exec(headers.Cookie)?.[1]
    const csrf = /northstar_csrf=([^;]+)/.exec(headers.Cookie)?.[1]
    expect(session && csrf).toBeTruthy()
    await page.context().addCookies([
      { name: 'northstar_session', value: session!, url: base, httpOnly: true },
      { name: 'northstar_csrf', value: csrf!, url: base },
    ])
    expect((await page.request.get(`${base}/api/auth/me`)).status()).toBe(200)
    await page.goto(`${base}/admin/posts/${postId}`)
    const title = page.getByPlaceholder('文章标题')
    await expect(title).toHaveValue('Before autosave')
    await title.fill('Saved automatically')
    await expect.poll(async () => (await db.post.findUnique({ where: { id: postId }, select: { title: true } }))?.title,
      { timeout: 40_000, intervals: [1000] }).toBe('Saved automatically')
    expect(await db.postRevision.count({ where: { postId } })).toBeGreaterThan(1)
  } finally {
    await db.post.deleteMany({ where: { id: postId } })
  }
})
