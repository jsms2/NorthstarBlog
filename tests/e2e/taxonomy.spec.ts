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

test('category parent, child, editing, assignment, removal and guarded deletion', async ({ request }) => {
  const headers = await adminHeaders(request)
  const stamp = Date.now()
  const parentSlug = `e2e-parent-${stamp}`
  const childSlug = `e2e-child-${stamp}`
  const postSlug = `e2e-category-post-${stamp}`
  let parentId: string | undefined
  let childId: string | undefined
  let postId: string | undefined
  try {
    const parent = await request.post(`${base}/api/admin/categories`, { headers,
      data: { name: 'E2E Parent', slug: parentSlug, description: 'Parent description', coverUrl: 'https://example.com/parent.webp', position: 1 } })
    expect(parent.ok(), await parent.text()).toBeTruthy()
    parentId = (await parent.json()).id
    const child = await request.post(`${base}/api/admin/categories`, { headers,
      data: { name: 'E2E Child', slug: childSlug, description: 'Child description', parentId, position: 2 } })
    expect(child.ok(), await child.text()).toBeTruthy()
    childId = (await child.json()).id
    const edited = await request.put(`${base}/api/admin/categories/${childId}`, { headers,
      data: { name: 'E2E Child Edited', slug: childSlug, description: 'Updated category description', coverUrl: 'https://example.com/child.webp', parentId } })
    expect(edited.ok(), await edited.text()).toBeTruthy()
    const post = await request.post(`${base}/api/admin/posts`, { headers,
      data: { title: 'Category assignment', slug: postSlug, markdown: 'Category body', status: 'PUBLISHED', categoryId: childId } })
    expect(post.ok(), await post.text()).toBeTruthy()
    postId = (await post.json()).id
    const publicCategory = await request.get(`${base}/categories/${childSlug}`)
    expect(publicCategory.status()).toBe(200)
    expect(await publicCategory.text()).toContain('Category assignment')
    expect(await (await request.get(`${base}/categories/${parentSlug}`)).text()).toContain('E2E Child Edited')
    expect((await request.delete(`${base}/api/admin/categories/${childId}`, { headers })).status()).toBe(409)
    const unassigned = await request.put(`${base}/api/admin/posts/${postId}`, { headers,
      data: { title: 'Category assignment', slug: postSlug, markdown: 'Category body', status: 'PUBLISHED', categoryId: null } })
    expect(unassigned.ok(), await unassigned.text()).toBeTruthy()
    expect(await (await request.get(`${base}/categories/${childSlug}`)).text()).not.toContain('Category assignment')
    expect((await request.delete(`${base}/api/admin/categories/${parentId}`, { headers })).status()).toBe(409)
    expect((await request.delete(`${base}/api/admin/categories/${childId}`, { headers })).ok()).toBeTruthy()
    expect((await db.category.findUnique({ where: { id: parentId } }))?.id).toBe(parentId)
    expect((await request.delete(`${base}/api/admin/categories/${parentId}`, { headers })).ok()).toBeTruthy()
  } finally {
    if (postId) await db.post.deleteMany({ where: { id: postId } })
    if (childId) await db.category.deleteMany({ where: { id: childId } })
    if (parentId) await db.category.deleteMany({ where: { id: parentId } })
  }
})

test('tag editing, public page, assignment, removal and deletion', async ({ request }) => {
  const headers = await adminHeaders(request)
  const stamp = Date.now()
  const slug = `e2e-tag-${stamp}`
  const postSlug = `e2e-tag-post-${stamp}`
  let tagId: string | undefined
  let postId: string | undefined
  try {
    const tag = await request.post(`${base}/api/admin/tags`, { headers,
      data: { name: 'E2E Tag', slug, description: 'Tag description', color: '#123456' } })
    expect(tag.ok(), await tag.text()).toBeTruthy()
    tagId = (await tag.json()).id
    const edited = await request.put(`${base}/api/admin/tags/${tagId}`, { headers,
      data: { name: 'E2E Tag Edited', slug, description: 'Updated tag', color: '#654321' } })
    expect(edited.ok(), await edited.text()).toBeTruthy()
    const post = await request.post(`${base}/api/admin/posts`, { headers,
      data: { title: 'Tag assignment', slug: postSlug, markdown: 'Tag body', status: 'PUBLISHED', tagIds: [tagId] } })
    expect(post.ok(), await post.text()).toBeTruthy()
    postId = (await post.json()).id
    const publicTag = await request.get(`${base}/tags/${slug}`)
    expect(publicTag.status()).toBe(200)
    expect(await publicTag.text()).toContain('Tag assignment')
    const untagged = await request.put(`${base}/api/admin/posts/${postId}`, { headers,
      data: { title: 'Tag assignment', slug: postSlug, markdown: 'Tag body', status: 'PUBLISHED', tagIds: [] } })
    expect(untagged.ok(), await untagged.text()).toBeTruthy()
    expect(await (await request.get(`${base}/tags/${slug}`)).text()).not.toContain('Tag assignment')
    expect((await request.delete(`${base}/api/admin/tags/${tagId}`, { headers })).ok()).toBeTruthy()
    expect(await db.postTag.count({ where: { tagId } })).toBe(0)
  } finally {
    if (postId) await db.post.deleteMany({ where: { id: postId } })
    if (tagId) await db.tag.deleteMany({ where: { id: tagId } })
  }
})

test('series order, previous/next, progress, removal and deletion', async ({ request }) => {
  const headers = await adminHeaders(request)
  const stamp = Date.now()
  const slug = `e2e-series-${stamp}`
  const postSlugs = [`e2e-series-a-${stamp}`, `e2e-series-b-${stamp}`]
  const postIds: string[] = []
  let seriesId: string | undefined
  try {
    for (const [index, postSlug] of postSlugs.entries()) {
      const post = await request.post(`${base}/api/admin/posts`, { headers,
        data: { title: `Series article ${index + 1}`, slug: postSlug, markdown: `Series body ${index + 1}`, status: 'PUBLISHED' } })
      expect(post.ok(), await post.text()).toBeTruthy()
      postIds.push((await post.json()).id)
    }
    const series = await request.post(`${base}/api/admin/series`, { headers,
      data: { name: 'E2E Series', slug, description: 'Series description', coverUrl: 'https://example.com/series.webp', postIds } })
    expect(series.ok(), await series.text()).toBeTruthy()
    seriesId = (await series.json()).id
    const first = await request.get(`${base}/api/public/series/${slug}`)
    const ordered = (await first.json()).posts as Array<{ postId: string; progress: number; previous: { slug: string } | null; next: { slug: string } | null }>
    expect(ordered.map(entry => entry.postId)).toEqual(postIds)
    expect(ordered.map(entry => entry.progress)).toEqual([50, 100])
    expect(ordered[0]?.next?.slug).toBe(postSlugs[1])
    expect(ordered[1]?.previous?.slug).toBe(postSlugs[0])
    const html = await (await request.get(`${base}/series/${slug}`)).text()
    expect(html.indexOf('Series article 1')).toBeLessThan(html.indexOf('Series article 2'))
    expect(html).toContain('Series description')
    const reversed = await request.put(`${base}/api/admin/series/${seriesId}`, { headers,
      data: { name: 'E2E Series Edited', slug, description: 'Updated series description', coverUrl: 'https://example.com/series-new.webp', postIds: [...postIds].reverse() } })
    expect(reversed.ok(), await reversed.text()).toBeTruthy()
    const reordered = (await (await request.get(`${base}/api/public/series/${slug}`)).json()).posts as Array<{ postId: string }>
    expect(reordered.map(entry => entry.postId)).toEqual([...postIds].reverse())
    const removed = await request.put(`${base}/api/admin/series/${seriesId}`, { headers,
      data: { name: 'E2E Series Edited', slug, description: 'Updated series description', postIds: [postIds[0]] } })
    expect(removed.ok(), await removed.text()).toBeTruthy()
    expect((await (await request.get(`${base}/api/public/series/${slug}`)).json()).posts).toHaveLength(1)
    expect((await request.delete(`${base}/api/admin/series/${seriesId}`, { headers })).ok()).toBeTruthy()
    expect(await db.seriesPost.count({ where: { seriesId } })).toBe(0)
  } finally {
    if (seriesId) await db.series.deleteMany({ where: { id: seriesId } })
    await db.post.deleteMany({ where: { id: { in: postIds } } })
  }
})
