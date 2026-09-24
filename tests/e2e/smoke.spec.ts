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
  expect(session).toBeTruthy()
  return { Cookie: `northstar_session=${session}; northstar_csrf=${body.csrf}`, 'x-csrf-token': body.csrf as string, Origin: base }
}

test('production SSR renders a newly published article and preserves its Markdown URL', async ({ request }) => {
  const headers = await adminHeaders(request)
  const slug = `e2e-ssr-published-${Date.now()}`
  const title = `Production SSR ${slug}`
  const bodyText = `Article body ${slug}`
  try {
    const created = await request.post(`${base}/api/admin/posts`, {
      headers,
      data: { title, slug, markdown: bodyText, status: 'PUBLISHED' },
    })
    expect(created.ok(), `${created.status()} ${await created.text()}`).toBeTruthy()
    expect((await created.json()).slug).toBe(slug)
    const page = await request.get(`${base}/posts/${slug}`)
    expect(page.status(), await page.text()).toBe(200)
    const html = await page.text()
    expect(html).toContain(title)
    expect(html).toContain(bodyText)
    const markdown = await request.get(`${base}/posts/${slug}.md`)
    expect(markdown.status()).toBe(200)
    expect(markdown.headers()['content-type']).toContain('text/markdown')
    expect(await markdown.text()).toContain(bodyText)
  } finally {
    await db.post.deleteMany({ where: { slug } })
  }
})

test('production SSR hides draft, scheduled, private and trashed articles', async ({ request }) => {
  const headers = await adminHeaders(request)
  const unique = Date.now()
  const cases = ['DRAFT', 'SCHEDULED', 'PRIVATE'] as const
  const slugs = cases.map(status => `e2e-ssr-${status.toLowerCase()}-${unique}`)
  const trashSlug = `e2e-ssr-trash-${unique}`
  try {
    for (const [index, status] of cases.entries()) {
      const created = await request.post(`${base}/api/admin/posts`, {
        headers,
        data: { title: `Hidden ${status}`, slug: slugs[index], markdown: `Hidden ${status}`, status,
          ...(status === 'SCHEDULED' ? { scheduledAt: new Date(Date.now() + 3600000).toISOString() } : {}) },
      })
      expect(created.ok(), await created.text()).toBeTruthy()
    }
    const trash = await request.post(`${base}/api/admin/posts`, {
      headers,
      data: { title: 'Hidden trash', slug: trashSlug, markdown: 'Hidden trash', status: 'DRAFT' },
    })
    expect(trash.ok(), await trash.text()).toBeTruthy()
    const trashId = (await trash.json()).id as string
    expect((await request.delete(`${base}/api/admin/posts/${trashId}`, { headers })).ok()).toBeTruthy()
    for (const slug of [...slugs, trashSlug]) {
      expect((await request.get(`${base}/posts/${slug}`)).status()).toBe(404)
      expect((await request.get(`${base}/posts/${slug}.md`)).status()).toBe(404)
    }
  } finally {
    await db.post.deleteMany({ where: { slug: { in: [...slugs, trashSlug] } } })
  }
})
