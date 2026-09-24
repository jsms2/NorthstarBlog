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

test('301/302, edit, delete, chain, loop, duplicate, destination and path normalization', async ({ request }) => {
  const auth = await adminHeaders(request)
  const stamp = Date.now()
  const root = `/e2e-redirect-${stamp}`
  const ids: string[] = []
  const create = async (source: string, destination: string, statusCode: 301 | 302 = 301) => {
    const response = await request.post(`${base}/api/admin/redirects`, { headers: auth,
      data: { source, destination, statusCode, enabled: true } })
    expect(response.ok(), await response.text()).toBeTruthy()
    const row = await response.json()
    ids.push(row.id)
    return row
  }
  const direct = (path: string) => request.get(`${base}${path}`, { maxRedirects: 0 })
  try {
    const last = await create(`${root}-last`, '/posts')
    const middle = await create(`${root}-middle`, `${root}-last`, 302)
    const first = await create(`${root}-first/`, `${root}-middle`)
    expect(first.source).toBe(`${root}-first`)
    const directFirst = await direct(`${root}-first/?utm=abc`)
    expect(directFirst.status()).toBe(301)
    expect(directFirst.headers().location).toBe(`${root}-middle`)
    expect((await direct(`${root}-middle`)).status()).toBe(302)
    expect((await direct(`${root}-last`)).headers().location).toBe('/posts')
    expect((await request.get(`${base}${root}-first`)).status()).toBe(200)
    expect((await request.post(`${base}/api/admin/redirects`, { headers: auth,
      data: { source: `${root}-first`, destination: '/links', statusCode: 301 } })).status()).toBe(400)
    expect((await request.post(`${base}/api/admin/redirects`, { headers: auth,
      data: { source: `${root}-last`, destination: `${root}-first`, statusCode: 301 } })).status()).toBe(400)
    for (const destination of ['javascript:alert(1)', 'http://example.com', '//example.com', '/bad/../path']) {
      expect((await request.post(`${base}/api/admin/redirects`, { headers: auth,
        data: { source: `${root}-invalid`, destination, statusCode: 301 } })).status(), destination).toBe(400)
    }
    const changed = await request.put(`${base}/api/admin/redirects/${last.id}`, { headers: auth,
      data: { source: `${root}-last`, destination: '/links', statusCode: 302, enabled: true } })
    expect(changed.ok(), await changed.text()).toBeTruthy()
    expect((await direct(`${root}-last`)).headers().location).toBe('/links')
    expect((await direct(`${root}-last`)).status()).toBe(302)
    expect((await request.put(`${base}/api/admin/redirects/${last.id}`, { headers: auth,
      data: { source: `${root}-last`, destination: `${root}-first`, statusCode: 301, enabled: true } })).status()).toBe(400)
    expect((await request.delete(`${base}/api/admin/redirects/${middle.id}`, { headers: auth })).ok()).toBeTruthy()
    expect((await direct(`${root}-middle`)).status()).toBe(404)
  } finally {
    await db.redirect.deleteMany({ where: { id: { in: ids } } })
  }
})
