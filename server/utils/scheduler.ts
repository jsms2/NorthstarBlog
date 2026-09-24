import type { PrismaClient } from '@prisma/client'

export async function publishDuePosts(database: PrismaClient, now = new Date()) {
  const result = await database.post.updateMany({
    where: { status: 'SCHEDULED', scheduledAt: { lte: now } },
    data: { status: 'PUBLISHED', publishedAt: now },
  })
  return result.count
}
