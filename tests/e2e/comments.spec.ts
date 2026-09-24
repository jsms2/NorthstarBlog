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

test('guest threads, moderation, admin reply, pin, like, trash, restore and permanent delete', async ({ request }) => {
  const auth = await adminHeaders(request)
  const stamp = Date.now()
  const slug = `e2e-comments-${stamp}`
  let postId: string | undefined
  let guestId: string | undefined
  let childId: string | undefined
  let nestedId: string | undefined
  let adminId: string | undefined
  const guest = (content: string, parentId?: string) => request.post(`${base}/api/public/posts/${postId}/comments`, {
    data: { authorName: 'Guest', email: 'secret@example.com', content, parentId },
    headers: { 'x-forwarded-for': `203.0.113.${Math.floor(Math.random() * 150) + 1}` },
  })
  try {
    const created = await request.post(`${base}/api/admin/posts`, { headers: auth,
      data: { title: 'Comment matrix', slug, markdown: 'Body', status: 'PUBLISHED', allowComments: true } })
    expect(created.ok(), await created.text()).toBeTruthy()
    postId = (await created.json()).id
    expect((await guest('Hello parent')).status()).toBe(200)
    guestId = (await db.comment.findFirstOrThrow({ where: { postId, content: 'Hello parent' } })).id
    expect((await request.get(`${base}/api/public/posts/${slug}`)).json()).resolves.toMatchObject({ comments: [] })
    expect((await request.patch(`${base}/api/admin/comments/${guestId}`, { headers: auth, data: { status: 'APPROVED' } })).ok()).toBeTruthy()
    const publicPost = await (await request.get(`${base}/api/public/posts/${slug}`)).json()
    expect(publicPost.comments).toHaveLength(1)
    expect(JSON.stringify(publicPost.comments)).not.toMatch(/secret@example.com|ipHash|website/)
    expect((await guest('Child reply', guestId)).ok()).toBeTruthy()
    childId = (await db.comment.findFirstOrThrow({ where: { postId, content: 'Child reply' } })).id
    expect((await guest('Nested reply', childId)).status()).toBe(400)
    await request.patch(`${base}/api/admin/comments/${childId}`, { headers: auth, data: { status: 'APPROVED' } })
    expect((await guest('Nested reply', childId)).ok()).toBeTruthy()
    nestedId = (await db.comment.findFirstOrThrow({ where: { postId, content: 'Nested reply' } })).id
    await request.patch(`${base}/api/admin/comments/${nestedId}`, { headers: auth, data: { status: 'APPROVED' } })
    const reply = await request.post(`${base}/api/admin/comments/${guestId}/reply`, { headers: auth, data: { content: 'Admin reply' } })
    expect(reply.ok(), await reply.text()).toBeTruthy()
    adminId = (await reply.json()).id
    expect((await db.comment.findUniqueOrThrow({ where: { id: adminId } })).isAdmin).toBeTruthy()
    expect((await request.patch(`${base}/api/admin/comments/${guestId}`, { headers: auth, data: { pinned: true } })).ok()).toBeTruthy()
    expect((await request.post(`${base}/api/public/comments/${guestId}/like`, { headers: { 'x-forwarded-for': '192.0.2.171' } })).ok()).toBeTruthy()
    expect((await request.post(`${base}/api/public/comments/${guestId}/like`, { headers: { 'x-forwarded-for': '192.0.2.171' } })).status()).toBe(429)
    expect((await db.comment.findUniqueOrThrow({ where: { id: guestId } })).likes).toBe(1)
    await request.patch(`${base}/api/admin/comments/${guestId}`, { headers: auth, data: { pinned: false, status: 'SPAM' } })
    expect((await (await request.get(`${base}/api/public/posts/${slug}`)).json()).comments.some((item: { id: string }) => item.id === guestId)).toBeFalsy()
    await request.patch(`${base}/api/admin/comments/${guestId}`, { headers: auth, data: { status: 'TRASH' } })
    await request.patch(`${base}/api/admin/comments/${guestId}`, { headers: auth, data: { status: 'APPROVED' } })
    expect((await (await request.get(`${base}/api/public/posts/${slug}`)).json()).comments.some((item: { id: string }) => item.id === guestId)).toBeTruthy()
    await request.patch(`${base}/api/admin/comments/${guestId}`, { headers: auth, data: { status: 'TRASH' } })
    expect((await request.delete(`${base}/api/admin/comments/${guestId}`, { headers: auth })).ok()).toBeTruthy()
    expect(await db.comment.findUnique({ where: { id: guestId } })).toBeNull()
  } finally {
    if (postId) await db.post.deleteMany({ where: { id: postId } })
  }
})

test('per-post and global disable, honeypot, invalid parent, escaping and rate limit', async ({ request }) => {
  const auth = await adminHeaders(request)
  const slug = `e2e-comment-security-${Date.now()}`
  let postId: string | undefined
  const previous = await db.setting.findUnique({ where: { key: 'commentsEnabled' } })
  try {
    const created = await request.post(`${base}/api/admin/posts`, { headers: auth,
      data: { title: 'Comment security', slug, markdown: 'Body', status: 'PUBLISHED', allowComments: true } })
    expect(created.ok(), await created.text()).toBeTruthy()
    postId = (await created.json()).id
    const url = `${base}/api/public/posts/${postId}/comments`
    const data = { authorName: '<img src=x onerror=alert(1)>', email: 'private@example.com',
      content: '<script>alert(1)</script><a href="javascript:alert(1)">x</a>' }
    const send = (extra: Record<string, unknown> = {}, ip = '203.0.113.220') => request.post(url, {
      data: { ...data, ...extra }, headers: { 'x-forwarded-for': ip } })
    expect((await send({ company: 'spam' }, '203.0.113.218')).status()).toBe(400)
    expect((await send({ parentId: 'foreign-comment-id' }, '203.0.113.219')).status()).toBe(400)
    expect((await send()).ok()).toBeTruthy()
    const comment = await db.comment.findFirstOrThrow({ where: { postId, email: data.email } })
    await request.patch(`${base}/api/admin/comments/${comment.id}`, { headers: auth, data: { status: 'APPROVED' } })
    const publicPost = await (await request.get(`${base}/api/public/posts/${slug}`)).json()
    expect(JSON.stringify(publicPost.comments)).not.toContain(data.email)
    const html = await (await request.get(`${base}/posts/${slug}`)).text()
    expect(html).not.toContain('<script>alert(1)</script>')
    expect(html).not.toContain('<img src=x onerror=alert(1)>')
    expect(html).not.toContain('href="javascript:alert(1)"')
    for (let i = 0; i < 4; i++) await send({ content: `Rate ${i}` })
    expect((await send({ content: 'Too many' })).status()).toBe(429)
    await db.post.update({ where: { id: postId }, data: { allowComments: false } })
    expect((await send({}, '203.0.113.221')).status()).toBe(404)
    await db.post.update({ where: { id: postId }, data: { allowComments: true } })
    expect((await request.put(`${base}/api/admin/settings`, { headers: auth, data: { commentsEnabled: false } })).ok()).toBeTruthy()
    expect((await send({}, '203.0.113.222')).status()).toBe(403)
  } finally {
    if (previous) await db.setting.update({ where: { key: 'commentsEnabled' }, data: { value: previous.value as boolean } })
    else await db.setting.deleteMany({ where: { key: 'commentsEnabled' } })
    if (postId) await db.post.deleteMany({ where: { id: postId } })
  }
})
