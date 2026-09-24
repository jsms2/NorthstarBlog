import { expect, test, type APIRequestContext } from '@playwright/test'
import { e2eAdminPassword } from './support/credentials'
import { db } from '../../server/utils/db'

const base = 'http://127.0.0.1:3000'

async function login(request: APIRequestContext) {
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

test('post lifecycle saves revisions, restores a revision, duplicates, trashes, restores and permanently deletes', async ({ request }) => {
  const headers = await login(request)
  const slug = `lifecycle-${Date.now()}`
  let copyId: string | undefined
  const created = await request.post(`${base}/api/admin/posts`, {
    headers,
    data: { title: 'Lifecycle draft', slug, markdown: 'first version', status: 'DRAFT', allowComments: false, showToc: false },
  })
  expect(created.ok(), `${created.status()} ${await created.text()}`).toBeTruthy()
  const post = await created.json() as { id: string }
  try {
    expect((await request.get(`${base}/api/public/posts/${slug}`)).status()).toBe(404)
    const baseline = await db.postRevision.count({ where: { postId: post.id } })
    const original = await db.post.findUniqueOrThrow({ where: { id: post.id } })
    const save = (markdown: string, status = 'DRAFT') => request.put(`${base}/api/admin/posts/${post.id}`, {
      headers,
      data: { title: markdown === 'second version' ? 'Lifecycle edited' : 'Lifecycle draft', slug, markdown, status, allowComments: false, showToc: false },
    })
    expect((await save('first version')).ok()).toBeTruthy()
    expect(await db.postRevision.count({ where: { postId: post.id } })).toBe(baseline)
    expect((await save('second version')).ok()).toBeTruthy()
    const revisions = await request.get(`${base}/api/admin/posts/${post.id}`, { headers })
    expect(revisions.ok()).toBeTruthy()
    const revision = (await revisions.json() as { revisions: Array<{ id: string; markdown: string }> }).revisions.find(item => item.markdown === original.markdown)
    expect(revision).toBeTruthy()
    expect(await db.postRevision.count({ where: { postId: post.id } })).toBeGreaterThan(baseline)
    const restored = await request.post(`${base}/api/admin/revisions/${revision!.id}/restore`, { headers, data: {} })
    expect(restored.ok(), `${restored.status()} ${await restored.text()}`).toBeTruthy()
    expect((await db.post.findUniqueOrThrow({ where: { id: post.id } })).markdown).toBe('first version')
    const publish = await save('first version', 'PUBLISHED')
    expect(publish.ok(), await publish.text()).toBeTruthy()
    expect((await request.get(`${base}/api/public/posts/${slug}`)).ok()).toBeTruthy()
    const duplicate = await request.post(`${base}/api/admin/posts/${post.id}/duplicate`, { headers, data: {} })
    expect(duplicate.ok(), `${duplicate.status()} ${await duplicate.text()}`).toBeTruthy()
    const copy = await duplicate.json() as { id: string; status: string }
    copyId = copy.id
    expect(copy.status).toBe('DRAFT')
    expect((await request.delete(`${base}/api/admin/posts/${post.id}?permanent=true`, { headers })).status()).toBe(409)
    expect((await request.delete(`${base}/api/admin/posts/${post.id}`, { headers })).ok()).toBeTruthy()
    expect((await db.post.findUniqueOrThrow({ where: { id: post.id }, select: { status: true, deletedAt: true } })).status).toBe('TRASH')
    expect((await request.get(`${base}/api/public/posts/${slug}`)).status()).toBe(404)
    const restoreFromTrash = await request.put(`${base}/api/admin/posts/${post.id}`, {
      headers,
      data: { title: 'Lifecycle draft', slug, markdown: 'first version', status: 'DRAFT', allowComments: false, showToc: false },
    })
    expect(restoreFromTrash.ok(), await restoreFromTrash.text()).toBeTruthy()
    expect((await db.post.findUniqueOrThrow({ where: { id: post.id }, select: { deletedAt: true } })).deletedAt).toBeNull()
    expect((await request.delete(`${base}/api/admin/posts/${post.id}`, { headers })).ok()).toBeTruthy()
    expect((await request.delete(`${base}/api/admin/posts/${post.id}?permanent=true`, { headers })).ok()).toBeTruthy()
    expect(await db.post.findUnique({ where: { id: post.id } })).toBeNull()
  } finally {
    if (copyId) await db.post.deleteMany({ where: { id: copyId } })
    await db.post.deleteMany({ where: { slug } })
  }
})
