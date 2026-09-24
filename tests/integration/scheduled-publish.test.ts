import { afterAll, describe, expect, it } from 'vitest'
import { db } from '../../server/utils/db'
import { publishDuePosts } from '../../server/utils/scheduler'

describe('MySQL scheduled post publishing', () => {
  const slugs: string[] = []
  afterAll(async () => {
    if (slugs.length) await db.post.deleteMany({ where: { slug: { in: slugs } } })
  })

  it('publishes due posts on startup catch-up, ignores future posts, and is idempotent', async () => {
    const admin = await db.admin.findFirstOrThrow()
    const suffix = Date.now().toString()
    const dueSlug = `integration-due-${suffix}`
    const futureSlug = `integration-future-${suffix}`
    slugs.push(dueSlug, futureSlug)
    const now = new Date()
    await db.post.createMany({
      data: [
        {
          title: 'Due after downtime',
          slug: dueSlug,
          markdown: 'due',
          html: '<p>due</p>',
          searchText: 'due',
          status: 'SCHEDULED',
          scheduledAt: new Date(now.getTime() - 60_000),
          authorId: admin.id,
        },
        {
          title: 'Future',
          slug: futureSlug,
          markdown: 'future',
          html: '<p>future</p>',
          searchText: 'future',
          status: 'SCHEDULED',
          scheduledAt: new Date(now.getTime() + 60_000),
          authorId: admin.id,
        },
      ],
    })

    expect(await publishDuePosts(db, now)).toBe(1)
    expect(await publishDuePosts(db, now)).toBe(0)
    const rows = await db.post.findMany({
      where: { slug: { in: slugs } },
      select: { slug: true, status: true, publishedAt: true },
    })
    expect(rows.find((row) => row.slug === dueSlug)).toMatchObject({ status: 'PUBLISHED' })
    expect(rows.find((row) => row.slug === dueSlug)?.publishedAt).not.toBeNull()
    expect(rows.find((row) => row.slug === futureSlug)?.status).toBe('SCHEDULED')
  })
})
