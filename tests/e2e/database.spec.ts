import { expect, test, type APIRequestContext } from '@playwright/test'
import { e2eAdminPassword } from './support/credentials'
import { Secret, TOTP } from 'otpauth'

const base = 'http://127.0.0.1:3000'

async function login(request: APIRequestContext) {
  const response = await request.post(`${base}/api/auth/login`, {
    data: { login: 'admin@example.com', password: e2eAdminPassword() },
    headers: { 'x-forwarded-for': `198.51.100.${Math.floor(Math.random() * 200) + 1}` },
  })
  expect(response.ok()).toBeTruthy()
  const body = await response.json()
  const session = response.headers()['set-cookie']?.match(/northstar_session=([^;]+)/)?.[1]
  expect(session).toBeTruthy()
  const cookie = `northstar_session=${session}; northstar_csrf=${body.csrf}`
  return {
    cookie,
    csrf: body.csrf as string,
    headers: { Cookie: cookie, 'x-csrf-token': body.csrf as string, Origin: base },
  }
}

test('database health and public feeds are served from the live MySQL-backed app', async ({ request }) => {
  const health = await request.get(`${base}/api/health`)
  expect(await health.json()).toMatchObject({ status: 'ok', database: 'ok' })
  for (const path of ['/', '/rss.xml', '/atom.xml', '/feed.json', '/sitemap.xml', '/robots.txt', '/llms.txt']) {
    expect((await request.get(`${base}${path}`)).status(), path).toBe(200)
  }
})

test('setup cannot be repeated and admin APIs require a valid session', async ({ request }) => {
  expect((await request.get(`${base}/api/auth/setup-status`)).status()).toBe(200)
  expect(await (await request.get(`${base}/api/auth/setup-status`)).json()).toMatchObject({ required: false })
  expect((await request.get(`${base}/api/admin/settings`)).status()).toBe(401)
  const auth = await login(request)
  expect((await request.get(`${base}/api/admin/settings`, { headers: { Cookie: auth.cookie } })).status()).toBe(200)
  expect((await request.put(`${base}/api/admin/settings`, { headers: { ...auth.headers, Origin: 'https://evil.example' }, data: {} })).status()).toBe(403)
})

test('page draft stays private, publish is visible, and trash can be permanently deleted', async ({ request }) => {
  const auth = await login(request)
  const slug = `e2e-page-${Date.now()}`
  const create = await request.post(`${base}/api/admin/pages`, {
    headers: auth.headers,
    data: { title: 'E2E page', slug, markdown: '# Private draft', status: 'DRAFT' },
  })
  expect(create.ok()).toBeTruthy()
  const page = await create.json()
  expect((await request.get(`${base}/api/public/pages/${slug}`)).status()).toBe(404)
  const publish = await request.put(`${base}/api/admin/pages/${page.id}`, {
    headers: auth.headers,
    data: { title: 'E2E page', slug, markdown: '# Public page', status: 'PUBLISHED' },
  })
  expect(publish.ok()).toBeTruthy()
  expect((await request.get(`${base}/api/public/pages/${slug}`)).status()).toBe(200)
  expect((await request.delete(`${base}/api/admin/pages/${page.id}`, { headers: auth.headers })).ok()).toBeTruthy()
  expect((await request.delete(`${base}/api/admin/pages/${page.id}?permanent=true`, { headers: auth.headers })).ok()).toBeTruthy()
})

test('Chinese seeded content is searchable, and session listing never exposes tokens', async ({ request }) => {
  const results = await request.get(`${base}/api/search?q=服务器`)
  expect(results.ok()).toBeTruthy()
  expect((await results.json()).items.length).toBeGreaterThan(0)
  const auth = await login(request)
  const sessions = await request.get(`${base}/api/admin/security/sessions`, { headers: { Cookie: auth.cookie } })
  expect(sessions.ok()).toBeTruthy()
  const body = JSON.stringify(await sessions.json())
  expect(body).not.toContain(auth.cookie.split('=')[1]?.split(';')[0] || 'token-absent')
  expect(body).not.toMatch(/tokenHash|northstar_session|passwordHash/i)
})

test('logout revokes the database-backed session', async ({ request }) => {
  const auth = await login(request)
  expect((await request.post(`${base}/api/auth/logout`, { headers: auth.headers, data: {} })).ok()).toBeTruthy()
  expect((await request.get(`${base}/api/auth/me`, { headers: { Cookie: auth.cookie } })).status()).toBe(401)
})

test('guest comments stay pending until an administrator approves them', async ({ request }) => {
  const post = await request.get(`${base}/api/public/posts/why-i-write`)
  expect(post.ok()).toBeTruthy()
  const postId = (await post.json()).id as string
  const marker = `e2e-comment-${Date.now()}`
  const submitted = await request.post(`${base}/api/public/posts/${postId}/comments`, {
    data: {
      authorName: marker,
      email: 'reader@example.test',
      content: '<img src=x onerror=alert(1)> E2E comment',
      company: '',
    },
  })
  expect(submitted.ok()).toBeTruthy()
  const beforeModeration = await request.get(`${base}/api/public/posts/why-i-write`)
  expect((await beforeModeration.json()).comments.some((row: { authorName: string }) => row.authorName === marker)).toBeFalsy()
  const auth = await login(request)
  const pending = await request.get(`${base}/api/admin/comments`, { headers: { Cookie: auth.cookie } })
  const comment = (await pending.json()).find((row: { authorName: string }) => row.authorName === marker)
  expect(comment).toBeTruthy()
  expect(comment.status).toBe('PENDING')
  expect((await request.patch(`${base}/api/admin/comments/${comment.id}`, {
    headers: auth.headers,
    data: { status: 'APPROVED' },
  })).ok()).toBeTruthy()
  const published = await request.get(`${base}/api/public/posts/why-i-write`)
  const comments = (await published.json()).comments as Array<{ authorName: string; content: string }>
  expect(comments.some((row) => row.authorName === marker)).toBeTruthy()
  expect(comments.find((row) => row.authorName === marker)?.content).toContain('onerror=alert(1)')
  await request.patch(`${base}/api/admin/comments/${comment.id}`, {
    headers: auth.headers,
    data: { status: 'SPAM' },
  })
})

test('TOTP setup, authenticator login, one-time recovery code, and disable work', async ({ request }) => {
  const auth = await login(request)
  const setup = await request.post(`${base}/api/admin/security/2fa/begin`, { headers: auth.headers })
  expect(setup.ok()).toBeTruthy()
  const setupData = await setup.json()
  const totp = new TOTP({
    secret: Secret.fromBase32(setupData.secret),
    issuer: 'Northstar',
    label: 'admin@example.com',
  })
  const enabled = await request.post(`${base}/api/admin/security/2fa/confirm`, {
    headers: auth.headers,
    data: { code: totp.generate() },
  })
  expect(enabled.ok()).toBeTruthy()
  const recoveryCodes = (await enabled.json()).recoveryCodes as string[]
  expect(recoveryCodes).toHaveLength(10)

  const loginWithOtp = await request.post(`${base}/api/auth/login`, {
    data: { login: 'admin@example.com', password: e2eAdminPassword() },
    headers: { 'x-forwarded-for': `198.51.100.${Math.floor(Math.random() * 200) + 1}` },
  })
  expect(await loginWithOtp.json()).toMatchObject({ requiresTwoFactor: true })
  const challenge = loginWithOtp.headers()['set-cookie']?.match(/northstar_2fa=([^;]+)/)?.[1]
  expect(challenge).toBeTruthy()
  expect((await request.post(`${base}/api/auth/verify-otp`, {
    headers: { Cookie: `northstar_2fa=${challenge}` },
    data: { code: totp.generate() },
  })).ok()).toBeTruthy()

  const recoveryLogin = await request.post(`${base}/api/auth/login`, {
    data: { login: 'admin@example.com', password: e2eAdminPassword() },
    headers: { 'x-forwarded-for': `198.51.100.${Math.floor(Math.random() * 200) + 1}` },
  })
  const recoveryChallenge = recoveryLogin.headers()['set-cookie']?.match(/northstar_2fa=([^;]+)/)?.[1]
  expect(recoveryChallenge).toBeTruthy()
  expect((await request.post(`${base}/api/auth/verify-otp`, {
    headers: { Cookie: `northstar_2fa=${recoveryChallenge}` },
    data: { code: recoveryCodes[0] },
  })).ok()).toBeTruthy()
  const disabled = await request.post(`${base}/api/admin/security/2fa/disable`, {
    headers: auth.headers,
    data: { password: e2eAdminPassword(), code: totp.generate() },
  })
  expect(disabled.ok()).toBeTruthy()
})
