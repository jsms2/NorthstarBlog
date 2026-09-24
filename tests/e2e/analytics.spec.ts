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

test('real homepage/post/page visits, referrer, UTM, UA, 7/30/90 days, disabled/admin/bot and privacy', async ({ request }) => {
  const auth = await adminHeaders(request)
  const stamp = Date.now()
  const slug = `e2e-analytics-${stamp}`
  const campaign = `e2e-analytics-campaign-${stamp}`
  let postId: string | undefined
  let pageId: string | undefined
  const originalSetting = await db.setting.findUnique({ where: { key: 'analyticsEnabled' } })
  const aggregates = await db.analyticsAggregate.findMany()
  const aggregateIds = new Set(aggregates.map(row => row.id))
  let trackedHashes: string[] = []
  const send = (path: string, ip: string, ua: string, headers: Record<string, string> = {}) => request.post(`${base}/api/analytics`, {
    data: { path, utmSource: 'newsletter', utmMedium: 'email', utmCampaign: campaign },
    headers: { 'x-forwarded-for': ip, 'user-agent': ua, referer: 'https://referrer.example/story', ...headers },
  })
  try {
    const post = await request.post(`${base}/api/admin/posts`, { headers: auth,
      data: { title: 'Analytics Post', slug, markdown: 'Body', status: 'PUBLISHED' } })
    expect(post.ok(), await post.text()).toBeTruthy()
    postId = (await post.json()).id
    const page = await request.post(`${base}/api/admin/pages`, { headers: auth,
      data: { title: 'Analytics Page', slug: `${slug}-page`, markdown: 'Body', status: 'PUBLISHED' } })
    expect(page.ok(), await page.text()).toBeTruthy()
    pageId = (await page.json()).id
    const chrome = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/125.0.0.0 Safari/537.36'
    const mobile = 'Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 Version/17.0 Mobile/15E148 Safari/604.1'
    for (const [path, ip, ua] of [['/', '203.0.113.21', chrome], [`/posts/${slug}`, '203.0.113.22', mobile],
      [`/${slug}-page`, '203.0.113.23', chrome]] as const) {
      const response = await send(path, ip, ua)
      expect(response.ok(), await response.text()).toBeTruthy()
      expect((await response.json()).tracked).toBeTruthy()
    }
    const events = await db.analyticsEvent.findMany({ where: { utmCampaign: campaign } })
    trackedHashes = events.map(event => event.visitorHash)
    expect(events).toHaveLength(3)
    expect(events.map(event => event.path).sort()).toEqual(['/', `/posts/${slug}`, `/${slug}-page`].sort())
    expect(events.find(event => event.path === `/posts/${slug}`)?.postId).toBe(postId)
    expect(events.every(event => event.utmSource === 'newsletter' && event.referrer === 'https://referrer.example')).toBeTruthy()
    expect(events.some(event => event.device === 'mobile')).toBeTruthy()
    expect(events.some(event => event.browser?.includes('Chrome'))).toBeTruthy()
    expect(JSON.stringify(events, (_key, value: unknown) => typeof value === 'bigint' ? String(value) : value)).not.toContain('203.0.113.2')
    for (const range of [7, 30, 90]) {
      const response = await request.get(`${base}/api/admin/analytics?range=${range}`, { headers: auth })
      expect(response.ok()).toBeTruthy()
      const report = await response.json()
      expect(report.range).toBe(range)
      expect(report.totals.views).toBeGreaterThanOrEqual(3)
      expect(report.popular.some((row: { name: string }) => row.name === `/posts/${slug}`)).toBeTruthy()
    }
    expect((await (await send('/', '203.0.113.24', 'Googlebot/2.1')).json()).tracked).toBeFalsy()
    expect((await (await send('/', '203.0.113.25', chrome, { Cookie: auth.Cookie })).json()).tracked).toBeFalsy()
    expect((await request.put(`${base}/api/admin/settings`, { headers: auth, data: { analyticsEnabled: false } })).ok()).toBeTruthy()
    expect((await (await send('/', '203.0.113.26', chrome)).json()).tracked).toBeFalsy()
    expect(await db.analyticsEvent.count({ where: { utmCampaign: campaign } })).toBe(3)
  } finally {
    if (originalSetting) await db.setting.update({ where: { key: 'analyticsEnabled' }, data: { value: originalSetting.value as boolean } })
    else await db.setting.deleteMany({ where: { key: 'analyticsEnabled' } })
    await db.analyticsEvent.deleteMany({ where: { utmCampaign: campaign } })
    await db.analyticsVisitorDay.deleteMany({ where: { visitorHash: { in: trackedHashes } } })
    const newRows = await db.analyticsAggregate.findMany({ where: { id: { notIn: [...aggregateIds] } } })
    const touchedValues = new Set(['all', '/', `/posts/${slug}`, `/${slug}-page`, 'https://referrer.example', 'Chrome', 'Safari', 'Windows', 'iOS', 'desktop', 'mobile'])
    await db.analyticsAggregate.deleteMany({ where: { id: { in: newRows.filter(row => touchedValues.has(row.value)).map(row => row.id) } } })
    for (const row of aggregates) await db.analyticsAggregate.update({ where: { id: row.id }, data: { views: row.views, visitors: row.visitors } })
    if (postId) await db.post.deleteMany({ where: { id: postId } })
    if (pageId) await db.page.deleteMany({ where: { id: pageId } })
  }
})
