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

test('appearance is visible in SSR, article controls and theme export/import restore settings', async ({ request }) => {
  const auth = await adminHeaders(request)
  const original = await (await request.get(`${base}/api/admin/appearance`, { headers: auth })).json()
  const originalRows = await db.setting.findMany({ where: { key: { in: Object.keys(original) } } })
  const stamp = Date.now()
  const postIds: string[] = []
  try {
    const modified = { ...original, siteName: `E2E Brand ${stamp}`, subtitle: `E2E subtitle ${stamp}`,
      logoUrl: 'https://example.com/logo.png', faviconUrl: 'https://example.com/favicon.ico', accentColor: '#123abc',
      bodyFont: 'serif', headingFont: 'serif', monoFont: 'sans', contentWidth: 1200, articleWidth: 880,
      radius: 24, homeLayout: 'list', articleLayout: 'wide', showToc: true, readingProgress: true,
      showShare: true, showRelated: true }
    const saved = await request.put(`${base}/api/admin/appearance`, { headers: auth, data: modified })
    expect(saved.ok(), await saved.text()).toBeTruthy()
    const home = await (await request.get(base)).text()
    expect(home).toContain(`E2E Brand ${stamp}`)
    expect(home).toContain(`E2E subtitle ${stamp}`)
    expect(home).toContain('https://example.com/logo.png')
    expect(home).toContain('https://example.com/favicon.ico')
    expect(home).toContain('--accent:#123abc')
    expect(home).toContain('--content-width:1200px')
    expect(home).toContain('--article-width:880px')
    expect(home).toContain('--site-radius:24px')
    expect(home).toContain('data-home-layout="list"')
    const create = async (title: string, index: number) => {
      const response = await request.post(`${base}/api/admin/posts`, { headers: auth,
        data: { title, slug: `e2e-appearance-${stamp}-${index}`, markdown: '## Test heading\n\nBody', status: 'PUBLISHED' } })
      expect(response.ok(), await response.text()).toBeTruthy()
      const item = await response.json()
      postIds.push(item.id)
      return item
    }
    await create('Related Post', 1)
    const post = await create('Main Post', 2)
    const article = await (await request.get(`${base}/posts/${post.slug}`)).text()
    expect(article).toContain('data-article-layout="wide"')
    expect(article).toContain('data-reading-progress')
    expect(article).toContain('分享文章')
    expect(article).toContain('相关文章')
    const exported = await (await request.get(`${base}/api/admin/appearance/export`, { headers: auth })).json()
    expect(exported).toMatchObject({ version: 1, appearance: modified })
    expect((await request.put(`${base}/api/admin/appearance`, { headers: auth,
      data: { ...modified, siteName: 'Changed Again', showShare: false, showRelated: false } })).ok()).toBeTruthy()
    expect((await request.post(`${base}/api/admin/appearance/import`, { headers: auth, data: exported })).ok()).toBeTruthy()
    expect(await (await request.get(`${base}/api/admin/appearance`, { headers: auth })).json()).toMatchObject(modified)
  } finally {
    const oldKeys = new Set(originalRows.map(row => row.key))
    await db.setting.deleteMany({ where: { key: { in: Object.keys(original).filter(key => !oldKeys.has(key)) } } })
    for (const row of originalRows) await db.setting.update({ where: { key: row.key }, data: { value: row.value as string } })
    await db.post.deleteMany({ where: { id: { in: postIds } } })
  }
})

test('light, dark and system mode persist across reload without a light flash', async ({ page }) => {
  await page.goto(base)
  const toggle = page.getByRole('button', { name: /切换深色模式/ })
  await toggle.click()
  expect(await page.evaluate(() => localStorage.getItem('color-mode'))).toBe('light')
  await page.reload()
  expect(await page.evaluate(() => document.documentElement.classList.contains('dark'))).toBeFalsy()
  await toggle.click()
  expect(await page.evaluate(() => localStorage.getItem('color-mode'))).toBe('dark')
  await page.reload()
  expect(await page.evaluate(() => document.documentElement.classList.contains('dark'))).toBeTruthy()
  await toggle.click()
  expect(await page.evaluate(() => localStorage.getItem('color-mode'))).toBe('system')
  await page.emulateMedia({ colorScheme: 'dark' })
  await page.reload()
  expect(await page.evaluate(() => document.documentElement.classList.contains('dark'))).toBeTruthy()
  await page.emulateMedia({ colorScheme: 'light' })
  await page.reload()
  expect(await page.evaluate(() => document.documentElement.classList.contains('dark'))).toBeFalsy()
})
