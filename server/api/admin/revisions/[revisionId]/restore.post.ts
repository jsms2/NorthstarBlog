import { db } from '../../../../utils/db'
import { requireAdmin, requireCsrf } from '../../../../utils/security'
import { contentMetrics, renderMarkdown } from '../../../../utils/content'

export default defineEventHandler(async (event) => {
  await requireAdmin(event)
  requireCsrf(event)
  const revision = await db.postRevision.findUnique({ where: { id: getRouterParam(event, 'revisionId')! } })
  if (!revision) throw createError({ statusCode: 404, statusMessage: '版本不存在' })
  const post = await db.post.findUniqueOrThrow({ where: { id: revision.postId } })
  const html = await renderMarkdown(revision.markdown)
  const metrics = contentMetrics(revision.markdown)
  return db.$transaction(async (tx) => {
    await tx.postRevision.create({
      data: { postId: post.id, title: post.title, markdown: post.markdown, editorJson: post.editorJson ?? undefined, summary: '恢复前自动保存' },
    })
    return tx.post.update({
      where: { id: post.id },
      data: {
        title: revision.title,
        markdown: revision.markdown,
        editorJson: revision.editorJson ?? undefined,
        html,
        searchText: metrics.searchText,
        wordCount: metrics.wordCount,
        readingMinutes: metrics.readingMinutes,
      },
    })
  })
})
