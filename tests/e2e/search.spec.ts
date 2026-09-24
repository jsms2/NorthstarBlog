import { expect, test, type APIRequestContext } from '@playwright/test'
import { e2eAdminPassword } from './support/credentials'
import { db } from '../../server/utils/db'

const base = 'http://127.0.0.1:3000'

async function headers(request: APIRequestContext) {
  const response = await request.post(`${base}/api/auth/login`, {
    data: { login: 'admin@example.com', password: e2eAdminPassword() },
    headers: { 'x-forwarded-for': `198.51.100.${Math.floor(Math.random() * 200) + 1}` },
  })
  expect(response.ok(), await response.text()).toBeTruthy()
  const body = await response.json()
  const session = response.headers()['set-cookie']?.match(/northstar_session=([^;]+)/)?.[1]
  return { Cookie: `northstar_session=${session}; northstar_csrf=${body.csrf}`, 'x-csrf-token': body.csrf as string, Origin: base }
}

test('multilingual text, taxonomy, pages, ranking, pagination and unpublished isolation', async ({ request }) => {
  const auth = await headers(request)
  const stamp = Date.now()
  const prefix = `e2e-search-${stamp}`
  const postIds: string[] = []
  let pageId: string | undefined
  let categoryId: string | undefined
  let tagId: string | undefined
  const createPost = async (name: string, data: Record<string, unknown>) => {
    const response = await request.post(`${base}/api/admin/posts`, { headers: auth,
      data: { title: name, slug: `${prefix}-${postIds.length}`, markdown: 'ordinary body', ...data } })
    expect(response.ok(), await response.text()).toBeTruthy()
    const post = await response.json()
    postIds.push(post.id)
    return post
  }
  const results = async (q: string, query = '') => {
    const response = await request.get(`${base}/api/search?q=${encodeURIComponent(q)}${query}`)
    expect(response.ok(), await response.text()).toBeTruthy()
    return response.json()
  }
  try {
    const category = await request.post(`${base}/api/admin/categories`, { headers: auth,
      data: { name: `类别${stamp}`, slug: `${prefix}-category` } })
    expect(category.ok(), await category.text()).toBeTruthy()
    categoryId = (await category.json()).id
    const tag = await request.post(`${base}/api/admin/tags`, { headers: auth,
      data: { name: `标签${stamp}`, slug: `${prefix}-tag` } })
    expect(tag.ok(), await tag.text()).toBeTruthy()
    tagId = (await tag.json()).id
    const title = await createPost(`星河检索${stamp}`, { status: 'PUBLISHED' })
    const body = await createPost('Unrelated title', { markdown: `正文包含星河检索${stamp}`, status: 'PUBLISHED' })
    await createPost(`English title ${stamp}`, { status: 'PUBLISHED' })
    await createPost('Other English', { markdown: `English body ${stamp}`, status: 'PUBLISHED' })
    await createPost(`中文Mixed${stamp}`, { status: 'PUBLISHED', categoryId, tagIds: [tagId] })
    await createPost('Taxonomy only', { status: 'PUBLISHED', categoryId, tagIds: [tagId] })
    for (const status of ['DRAFT', 'PRIVATE', 'SCHEDULED', 'TRASH'] as const) {
      const hidden = await createPost(`星河检索${stamp} ${status}`, { status: status === 'TRASH' ? 'DRAFT' : status,
        scheduledAt: status === 'SCHEDULED' ? new Date(Date.now() + 86_400_000).toISOString() : undefined })
      if (status === 'TRASH') await db.post.update({ where: { id: hidden.id }, data: { status: 'TRASH', deletedAt: new Date() } })
    }
    const page = await request.post(`${base}/api/admin/pages`, { headers: auth,
      data: { title: `独立页面${stamp}`, slug: `${prefix}-page`, markdown: `页面正文星河检索${stamp}`, status: 'PUBLISHED' } })
    expect(page.ok(), await page.text()).toBeTruthy()
    pageId = (await page.json()).id

    const chinese = await results(`星河检索${stamp}`)
    expect(chinese.items[0].url).toBe(`/posts/${title.slug}`)
    expect(chinese.items.map((item: { url: string }) => item.url)).toContain(`/posts/${body.slug}`)
    expect(chinese.items).toHaveLength(3)
    expect(chinese.items.some((item: { type: string }) => item.type === 'page')).toBeTruthy()
    expect((await results(`English title ${stamp}`)).items).toHaveLength(1)
    expect((await results(`English body ${stamp}`)).items).toHaveLength(1)
    expect((await results(`Mixed${stamp}`)).items).toHaveLength(1)
    expect((await results(`类别${stamp}`)).items).toHaveLength(2)
    expect((await results(`标签${stamp}`)).items).toHaveLength(2)
    const first = await results(`星河检索${stamp}`, '&pageSize=1&page=1')
    const second = await results(`星河检索${stamp}`, '&pageSize=1&page=2')
    expect(first.total).toBe(3)
    expect(first.pages).toBe(3)
    expect(first.items[0].url).not.toBe(second.items[0].url)
    expect((await results('')).items).toHaveLength(0)
    expect((await results('星')).items).toHaveLength(0)
    expect((await results('nonexistent-xyz-01234')).items).toHaveLength(0)
    for (const special of ['%', '_', "'", '"', '+', '-', '*', 'x'.repeat(150)]) {
      const response = await request.get(`${base}/api/search?q=${encodeURIComponent(special)}`)
      expect(response.status(), special).toBe(200)
    }
  } finally {
    if (pageId) await db.page.deleteMany({ where: { id: pageId } })
    await db.post.deleteMany({ where: { id: { in: postIds } } })
    if (categoryId) await db.category.deleteMany({ where: { id: categoryId } })
    if (tagId) await db.tag.deleteMany({ where: { id: tagId } })
  }
})
