import { expect, test, type APIRequestContext, type Page } from '@playwright/test'
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
function monitor(page: Page) {
  const errors: string[] = []
  page.on('pageerror', error => errors.push(`pageerror: ${error.message}`))
  page.on('console', message => {
    if (message.type() === 'error' && /hydration|uncaught|unhandled|fatal/i.test(message.text())) errors.push(`console ${page.url()}: ${message.text()}`)
    if (message.type() === 'warning' && /hydration|mismatch/i.test(message.text())) errors.push(`warning: ${message.text()}`)
  })
  page.on('response', response => { if (response.url().includes('/api/') && response.status() >= 500) errors.push(`${response.status()} ${response.url()}`) })
  return errors
}

test('all existing admin screens render without fatal errors or API 500', async ({ request, page }) => {
  test.setTimeout(90_000)
  const auth = await adminHeaders(request)
  const session = /northstar_session=([^;]+)/.exec(auth.Cookie)?.[1]
  const csrf = /northstar_csrf=([^;]+)/.exec(auth.Cookie)?.[1]
  await page.context().addCookies([
    { name: 'northstar_session', value: session!, url: base, httpOnly: true },
    { name: 'northstar_csrf', value: csrf!, url: base },
  ])
  const errors = monitor(page)
  for (const path of ['/admin', '/admin/posts', '/admin/pages', '/admin/categories', '/admin/tags',
    '/admin/series', '/admin/comments', '/admin/media', '/admin/navigation', '/admin/links',
    '/admin/redirects', '/admin/analytics', '/admin/appearance', '/admin/backups', '/admin/settings']) {
    const response = await page.goto(`${base}${path}`)
    expect(response?.status(), path).toBe(200)
    expect(page.url(), path).toContain(path)
    await expect(page.locator('main h1').first(), path).toBeVisible()
    await expect(page.locator('main'), path).not.toBeEmpty()
    expect(errors, path).toEqual([])
  }
})

test('desktop and mobile public routes, search and 404 render without fatal errors', async ({ page }) => {
  test.setTimeout(90_000)
  const admin = await db.admin.findFirstOrThrow()
  const stamp = Date.now()
  const slug = `e2e-ui-${stamp}`
  const category = await db.category.create({ data: { name: `UI Category ${stamp}`, slug: `${slug}-category` } })
  const tag = await db.tag.create({ data: { name: `UI Tag ${stamp}`, slug: `${slug}-tag` } })
  const post = await db.post.create({ data: { title: `UI Post ${stamp}`, slug, markdown: '## Heading\n\nBody', html: '<h2>Heading</h2><p>Body</p>',
    searchText: 'Heading Body', status: 'PUBLISHED', publishedAt: new Date(), authorId: admin.id, categoryId: category.id,
    tags: { create: { tagId: tag.id } } } })
  const contentPage = await db.page.create({ data: { title: `UI Page ${stamp}`, slug: `${slug}-page`, markdown: 'Body',
    html: '<p>Body</p>', status: 'PUBLISHED', publishedAt: new Date(), authorId: admin.id } })
  const series = await db.series.create({ data: { name: `UI Series ${stamp}`, slug: `${slug}-series`,
    posts: { create: { postId: post.id, position: 0 } } } })
  const errors = monitor(page)
  try {
    for (const viewport of [{ width: 1440, height: 900 }, { width: 390, height: 844 }]) {
      await page.setViewportSize(viewport)
      for (const path of ['/', `/posts/${slug}`, `/${slug}-page`, `/categories/${category.slug}`,
        `/tags/${tag.slug}`, `/series/${series.slug}`, '/links']) {
        const response = await page.goto(`${base}${path}`)
        expect(response?.status(), `${viewport.width} ${path}`).toBe(200)
        await expect(page.locator('h1').first(), path).toBeVisible()
        await expect(page.locator('main,article').first(), path).not.toBeEmpty()
      }
      await page.goto(base)
      await page.getByRole('button', { name: '搜索' }).click()
      await page.getByPlaceholder('搜索文章、标签或页面…').fill(`UI Post ${stamp}`)
      await expect(page.getByRole('dialog').getByText(`UI Post ${stamp}`)).toBeVisible()
      const missing = await page.goto(`${base}/e2e-no-such-page-${stamp}`)
      expect(missing?.status()).toBe(404)
      await expect(page.getByText('这一页去远行了')).toBeVisible()
    }
    expect(errors).toEqual([])
  } finally {
    await db.series.deleteMany({ where: { id: series.id } })
    await db.post.deleteMany({ where: { id: post.id } })
    await db.page.deleteMany({ where: { id: contentPage.id } })
    await db.category.deleteMany({ where: { id: category.id } })
    await db.tag.deleteMany({ where: { id: tag.id } })
  }
})
