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

test('header/footer CRUD, sorting, hierarchy, internal/external URLs and SSR', async ({ request }) => {
  const auth = await adminHeaders(request)
  const stamp = Date.now()
  const ids: string[] = []
  const add = async (label: string, data: Record<string, unknown>) => {
    const response = await request.post(`${base}/api/admin/navigation`, { headers: auth,
      data: { location: 'header', label, url: '/posts', position: 5000, ...data } })
    expect(response.ok(), await response.text()).toBeTruthy()
    const item = await response.json()
    ids.push(item.id)
    return item
  }
  try {
    const first = await add(`E2E First ${stamp}`, { position: 5001 })
    const second = await add(`E2E Second ${stamp}`, { url: 'https://example.com/', newWindow: true, position: 5002 })
    const child = await add(`E2E Child ${stamp}`, { parentId: first.id, position: 1 })
    const footer = await add(`E2E Footer ${stamp}`, { location: 'footer', url: '/links', position: 5001 })
    const publicNav = await (await request.get(`${base}/api/public/navigation`)).json()
    expect(publicNav.header.find((item: { id: string }) => item.id === first.id).children[0].id).toBe(child.id)
    const initial = await (await request.get(base)).text()
    expect(initial).toContain(first.label)
    expect(initial).toContain(second.label)
    expect(initial).toContain(child.label)
    expect(initial).toContain(footer.label)
    expect(initial.indexOf(first.label)).toBeLessThan(initial.indexOf(second.label))
    expect(initial).toContain('target="_blank"')
    const edited = await request.put(`${base}/api/admin/navigation/${second.id}`, { headers: auth,
      data: { location: 'header', label: `E2E Edited ${stamp}`, url: 'https://example.org/', icon: null,
        newWindow: true, position: 5000, parentId: null } })
    expect(edited.ok(), await edited.text()).toBeTruthy()
    const changed = await (await request.get(base)).text()
    expect(changed.indexOf(`E2E Edited ${stamp}`)).toBeLessThan(changed.indexOf(first.label))
    expect(changed).toContain('https://example.org/')
    expect((await request.delete(`${base}/api/admin/navigation/${first.id}`, { headers: auth })).status()).toBe(409)
    expect((await request.post(`${base}/api/admin/navigation`, { headers: auth,
      data: { location: 'footer', label: 'Invalid', url: '/', parentId: first.id } })).status()).toBe(400)
    expect((await request.delete(`${base}/api/admin/navigation/${child.id}`, { headers: auth })).ok()).toBeTruthy()
    expect((await request.delete(`${base}/api/admin/navigation/${first.id}`, { headers: auth })).ok()).toBeTruthy()
    expect((await request.delete(`${base}/api/admin/navigation/${second.id}`, { headers: auth })).ok()).toBeTruthy()
    expect((await request.delete(`${base}/api/admin/navigation/${footer.id}`, { headers: auth })).ok()).toBeTruthy()
    const cleared = await (await request.get(base)).text()
    expect(cleared).not.toContain(`E2E Edited ${stamp}`)
  } finally {
    await db.navigation.deleteMany({ where: { id: { in: ids } } })
  }
})
