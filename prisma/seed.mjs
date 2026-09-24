import { PrismaClient } from '@prisma/client'
import argon2 from 'argon2'
import { marked } from 'marked'
const db = new PrismaClient()
const password = process.env.SEED_ADMIN_PASSWORD
async function main() {
  const existingAdmin = await db.admin.findUnique({ where: { email: 'admin@example.com' } })
  if (!existingAdmin && (!password || password.length < 12))
    throw new Error('SEED_ADMIN_PASSWORD must be set to at least 12 characters before first seed')
  const admin = existingAdmin || await db.admin.create({
    data: {
      username: 'admin',
      email: 'admin@example.com',
      passwordHash: await argon2.hash(password, { type: argon2.argon2id }),
    },
  })
  const category = await db.category.upsert({
    where: { slug: 'engineering' },
    update: {},
    create: { name: '工程实践', slug: 'engineering', description: '关于构建可靠软件的笔记' },
  })
  const tags = await Promise.all(
    ['TypeScript', '自托管', '生活记录'].map((name) =>
      db.tag.upsert({
        where: { slug: name.toLowerCase() },
        update: {},
        create: { name, slug: name.toLowerCase(), color: '#d75a32' },
      }),
    ),
  )
  const entries = [
    [
      'why-i-write',
      '我为什么重新开始写博客',
      '写作不是为了制造更多信息，而是为了让思考留下清晰的轨迹。',
    ],
    [
      'home-server-from-zero',
      '从零搭建自己的家庭服务器',
      '一次关于硬件、网络、安全与长期维护的完整实践。',
    ],
    [
      'typescript-small-tool',
      '使用 TypeScript 构建一个小工具',
      '从需求、类型建模到发布，记录一个小工具的完整生命周期。',
    ],
    ['projects-2026', '2026 年我的个人项目回顾', '复盘这一年完成、放弃和仍在继续的个人项目。'],
  ]
  for (const [slug, title, excerpt] of entries) {
    const markdown = `# ${title}\n\n${excerpt}\n\n> 保持系统简单，但不牺牲可靠性。\n\n## 从问题出发\n\n真正有价值的工具，通常始于一个被反复遇到的小问题。\n\n\`\`\`ts\nexport function greet(name: string) {\n  return \`Hello, \${name}\`\n}\n\`\`\`\n\n| 原则 | 实践 |\n| --- | --- |\n| 可迁移 | Markdown 作为内容源 |\n| 可维护 | 单体应用与清晰边界 |\n`
    await db.post.upsert({
      where: { slug },
      update: {},
      create: {
        slug,
        title,
        excerpt,
        markdown,
        html: await marked.parse(markdown),
        searchText: `${title} ${excerpt} TypeScript 自托管`,
        status: 'PUBLISHED',
        publishedAt: new Date(),
        wordCount: 180,
        readingMinutes: 2,
        featured: slug === 'why-i-write',
        authorId: admin.id,
        categoryId: category.id,
        tags: { create: tags.slice(0, 2).map((t) => ({ tagId: t.id })) },
      },
    })
  }
  await db.page.upsert({
    where: { slug: 'about' },
    update: {},
    create: {
      slug: 'about',
      title: '关于',
      markdown: '# 关于\n\n你好，我是这个博客的作者。这里记录工程、创造与日常生活。',
      html: '<h1>关于</h1><p>你好，我是这个博客的作者。这里记录工程、创造与日常生活。</p>',
      status: 'PUBLISHED',
      publishedAt: new Date(),
      authorId: admin.id,
    },
  })
  console.log(existingAdmin
    ? 'Seed complete. Existing admin credentials were left unchanged.'
    : 'Seed complete. Admin created; password was not printed.')
}
main().finally(() => db.$disconnect())
