<script setup lang="ts">
type Form = {
  title: string
  slug: string
  markdown: string
  excerpt: string
  status: 'DRAFT' | 'SCHEDULED' | 'PUBLISHED' | 'PRIVATE' | 'TRASH'
  seoTitle: string
  seoDescription: string
  ogTitle: string
  ogDescription: string
  ogImage: string
  canonicalUrl: string
  noindex: boolean
  nofollow: boolean
  allowComments: boolean
  customCss: string
  customJs: string
  template: string
}
const props = defineProps<{ initial?: Partial<Form>; pageId?: string }>()
const form = reactive<Form>({
  title: '',
  slug: '',
  markdown: '# 开始写作\n',
  excerpt: '',
  status: 'DRAFT',
  seoTitle: '',
  seoDescription: '',
  ogTitle: '',
  ogDescription: '',
  ogImage: '',
  canonicalUrl: '',
  noindex: false,
  nofollow: false,
  allowComments: false,
  customCss: '',
  customJs: '',
  template: 'default',
  ...props.initial,
})
const csrf = useCsrf()
async function save() {
  const r = await $fetch<{ id: string }>(
    props.pageId ? `/api/admin/pages/${props.pageId}` : '/api/admin/pages',
    { method: props.pageId ? 'PUT' : 'POST', headers: csrf.value, body: { ...form, canonicalUrl: form.canonicalUrl || null } },
  )
  if (!props.pageId) await navigateTo(`/admin/pages/${r.id}`)
}
watch(
  () => form.title,
  (v) => {
    if (!props.pageId && !form.slug)
      form.slug = v
        .toLowerCase()
        .trim()
        .replace(/[^a-z0-9]+/g, '-')
        .replace(/(^-|-$)/g, '')
  },
)
</script>
<template>
  <form class="max-w-4xl" @submit.prevent="save">
    <div class="flex justify-between">
      <NuxtLink to="/admin/pages">← 页面</NuxtLink>
      <div class="flex gap-3">
        <select v-model="form.status" class="rounded-lg border bg-transparent p-2">
          <option value="DRAFT">草稿</option>
          <option value="PUBLISHED">发布</option>
          <option value="PRIVATE">私密</option>
          <option v-if="pageId" value="TRASH">回收站</option></select
        ><button class="rounded-full px-5 py-2 text-white" style="background: var(--accent)">
          保存
        </button>
      </div>
    </div>
    <input
      v-model="form.title"
      required
      class="mt-8 w-full bg-transparent text-4xl font-semibold outline-none"
      placeholder="页面标题"
    /><label class="mt-3 flex text-sm"
      >/{{ form.slug
      }}<input v-model="form.slug" required class="ml-2 flex-1 bg-transparent" /></label
    ><textarea
      v-model="form.excerpt"
      class="mt-5 w-full rounded-lg border bg-transparent p-3"
      placeholder="摘要"
    /><AdminContentEditor v-model="form.markdown" />
    <details class="mt-5 rounded-xl border p-5">
      <summary>页面与 SEO 设置</summary>
      <div class="mt-4 grid gap-4 md:grid-cols-2">
        <input
          v-model="form.seoTitle"
          placeholder="SEO 标题"
          class="rounded border bg-transparent p-2"
        /><input
          v-model="form.seoDescription"
          placeholder="SEO 描述"
          class="rounded border bg-transparent p-2"
        /><input
          v-model="form.canonicalUrl"
          placeholder="Canonical URL"
          class="rounded border bg-transparent p-2"
        /><input v-model="form.ogTitle" placeholder="OG 标题" class="rounded border bg-transparent p-2"
        /><input v-model="form.ogDescription" placeholder="OG 描述" class="rounded border bg-transparent p-2"
        /><input v-model="form.ogImage" placeholder="OG 图片" class="rounded border bg-transparent p-2"
        /><input
          v-model="form.template"
          placeholder="模板名称"
          class="rounded border bg-transparent p-2"
        /><label><input v-model="form.noindex" type="checkbox" /> noindex</label
        ><label><input v-model="form.nofollow" type="checkbox" /> nofollow</label
        ><label><input v-model="form.allowComments" type="checkbox" /> 允许评论</label
        ><textarea
          v-model="form.customCss"
          placeholder="自定义 CSS"
          class="rounded border bg-transparent p-2"
        ></textarea
        ><textarea
          v-model="form.customJs"
          placeholder="自定义 JS（前台执行）"
          class="rounded border bg-transparent p-2"
        ></textarea>
      </div>
    </details>
  </form>
</template>
