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

test('link group, sorting, visibility, logo, description, URL, editing and deletion reach frontend', async ({ request }) => {
  const auth = await adminHeaders(request)
  const stamp = Date.now()
  const ids: string[] = []
  const create = async (name: string, position: number) => {
    const response = await request.post(`${base}/api/admin/links`, { headers: auth,
      data: { name, url: 'https://example.com/', logo: 'https://example.com/logo.png',
        description: `Description ${stamp}`, group: `E2E Group ${stamp}`, position, visible: true } })
    expect(response.ok(), await response.text()).toBeTruthy()
    const item = await response.json()
    ids.push(item.id)
    return item
  }
  try {
    const first = await create(`E2E Link A ${stamp}`, 2)
    const second = await create(`E2E Link B ${stamp}`, 1)
    const initial = await (await request.get(`${base}/links`)).text()
    expect(initial).toContain(`E2E Group ${stamp}`)
    expect(initial).toContain(`Description ${stamp}`)
    expect(initial).toContain('https://example.com/logo.png')
    expect(initial.indexOf(second.name)).toBeLessThan(initial.indexOf(first.name))
    const edited = await request.put(`${base}/api/admin/links/${first.id}`, { headers: auth,
      data: { name: `E2E Renamed ${stamp}`, url: 'https://example.org/new', logo: null,
        description: 'Updated description', group: `E2E Group ${stamp}`, position: 0, visible: false } })
    expect(edited.ok(), await edited.text()).toBeTruthy()
    const hidden = await (await request.get(`${base}/links`)).text()
    expect(hidden).not.toContain(`E2E Renamed ${stamp}`)
    expect(hidden).toContain(second.name)
    expect((await request.put(`${base}/api/admin/links/${first.id}`, { headers: auth,
      data: { name: `E2E Renamed ${stamp}`, url: 'https://example.org/new', logo: null,
        description: 'Updated description', group: `E2E Group ${stamp}`, position: 0, visible: true } })).ok()).toBeTruthy()
    const visible = await (await request.get(`${base}/links`)).text()
    expect(visible).toContain(`E2E Renamed ${stamp}`)
    expect(visible).toContain('Updated description')
    expect(visible).toContain('https://example.org/new')
    expect(visible.indexOf(`E2E Renamed ${stamp}`)).toBeLessThan(visible.indexOf(second.name))
    expect((await request.delete(`${base}/api/admin/links/${first.id}`, { headers: auth })).ok()).toBeTruthy()
    expect((await request.delete(`${base}/api/admin/links/${second.id}`, { headers: auth })).ok()).toBeTruthy()
    expect(await db.link.count({ where: { id: { in: ids } } })).toBe(0)
  } finally {
    await db.link.deleteMany({ where: { id: { in: ids } } })
  }
})
