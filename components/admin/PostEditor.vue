<script setup lang="ts">
type Form = {
  title: string
  slug: string
  excerpt: string
  markdown: string
  status: 'DRAFT' | 'SCHEDULED' | 'PUBLISHED' | 'PRIVATE' | 'TRASH'
  scheduledAt: string | null
  featured: boolean
  pinned: boolean
  coverUrl: string
  categoryId: string | null
  tagIds: string[]
  allowComments: boolean
  showToc: boolean
  seoTitle: string
  seoDescription: string
  ogTitle: string
  ogDescription: string
  canonicalUrl: string
  noindex: boolean
  nofollow: boolean
  ogImage: string
  editorJson?: unknown
  html?: string
}
const props = defineProps<{ initial?: Partial<Form>; postId?: string }>()
const { data: categories } = await useFetch<Array<{ id: string; name: string }>>('/api/admin/categories')
const { data: tags } = await useFetch<Array<{ id: string; name: string }>>('/api/admin/tags')
const csrf = useCsrf()
const saving = ref(false)
const message = ref('')
const form = reactive<Form>({
  title: '',
  slug: '',
  excerpt: '',
  markdown: '# 开始写作\n',
  status: 'DRAFT',
  scheduledAt: null,
  featured: false,
  pinned: false,
  coverUrl: '',
  categoryId: null,
  tagIds: [],
  allowComments: true,
  showToc: true,
  seoTitle: '',
  seoDescription: '',
  ogTitle: '',
  ogDescription: '',
  canonicalUrl: '',
  noindex: false,
  nofollow: false,
  ogImage: '',
  ...props.initial,
})
watch(
  () => form.title,
  (v) => {
    if (!props.postId && !form.slug)
      form.slug = v
        .toLowerCase()
        .trim()
        .replace(/[^a-z0-9\u4e00-\u9fff]+/g, '-')
        .replace(/(^-|-$)/g, '')
  },
)
async function save() {
  if (saving.value) return
  saving.value = true
  message.value = ''
  try {
    const result = await $fetch<{ id: string }>(
      props.postId ? `/api/admin/posts/${props.postId}` : '/api/admin/posts',
      {
        method: props.postId ? 'PUT' : 'POST',
        headers: csrf.value,
        body: {
          ...form,
          editorJson: form.editorJson ?? undefined,
          html: form.html || undefined,
          scheduledAt: form.scheduledAt ? new Date(form.scheduledAt).toISOString() : null,
        },
      },
    )
    message.value = '已保存'
    if (!props.postId) await navigateTo(`/admin/posts/${result.id}`)
  } catch (e) {
    message.value = (e as { data?: { message?: string } }).data?.message || '保存失败'
  } finally {
    saving.value = false
  }
}
let timer: ReturnType<typeof setTimeout>
watch(
  form,
  () => {
    clearTimeout(timer)
    timer = setTimeout(() => {
      if (props.postId) void save()
    }, 30_000)
  },
  { deep: true },
)
</script>
<template>
  <form @submit.prevent="save">
    <div class="flex flex-wrap items-center justify-between gap-3">
      <NuxtLink to="/admin/posts">← 文章</NuxtLink>
      <div class="flex items-center gap-3">
        <span class="text-sm" style="color: var(--muted)">{{ message }}</span
        ><select v-model="form.status" class="rounded-lg border bg-transparent px-3 py-2">
          <option value="DRAFT">草稿</option>
          <option value="PUBLISHED">发布</option>
          <option value="SCHEDULED">定时</option>
          <option value="PRIVATE">私密</option>
          <option v-if="postId" value="TRASH">回收站</option></select
        ><button
          :disabled="saving"
          class="rounded-full px-5 py-2 text-white disabled:opacity-50"
          style="background: var(--accent)"
        >
          {{ saving ? '保存中…' : '保存' }}
        </button>
      </div>
    </div>
    <div class="mx-auto mt-10 max-w-4xl">
      <input
        v-model="form.title"
        required
        maxlength="255"
        class="w-full bg-transparent text-4xl font-semibold outline-none"
        placeholder="文章标题"
      />
      <div class="mt-3 flex items-center text-sm" style="color: var(--muted)">
        <span>/posts/</span
        ><input
          v-model="form.slug"
          required
          pattern="[a-z0-9]+(?:-[a-z0-9]+)*"
          class="flex-1 bg-transparent outline-none"
        />
      </div>
      <textarea
        v-model="form.excerpt"
        rows="2"
        maxlength="1000"
        class="mt-6 w-full resize-none rounded-xl border bg-transparent p-4"
        placeholder="文章摘要"
      />
      <div class="mt-6 flex gap-2 text-sm" style="color: var(--muted)">
        <span>Tiptap 可视化编辑器</span><span>·</span><span>30 秒自动保存</span>
      </div>
      <AdminContentEditor
        v-model="form.markdown"
        v-model:json="form.editorJson"
        v-model:html="form.html"
      />
      <details class="mt-6 rounded-xl border p-5">
        <summary class="cursor-pointer font-semibold">发布与 SEO 设置</summary>
        <div class="mt-5 grid gap-4 md:grid-cols-2">
          <label
            >SEO 标题<input
              v-model="form.seoTitle"
              class="mt-1 w-full rounded-lg border bg-transparent p-2" /></label
          ><label
            >SEO 描述<input
              v-model="form.seoDescription"
              class="mt-1 w-full rounded-lg border bg-transparent p-2" /></label
          ><label>OG 标题<input v-model="form.ogTitle" class="mt-1 w-full rounded-lg border bg-transparent p-2" /></label
          ><label>OG 描述<input v-model="form.ogDescription" class="mt-1 w-full rounded-lg border bg-transparent p-2" /></label
          ><label v-if="form.status === 'SCHEDULED'"
            >发布时间<input
              v-model="form.scheduledAt"
              type="datetime-local"
              class="mt-1 w-full rounded-lg border bg-transparent p-2" /></label
          ><label><input v-model="form.featured" type="checkbox" /> 精选</label
          ><label><input v-model="form.pinned" type="checkbox" /> 置顶</label
          ><label><input v-model="form.allowComments" type="checkbox" /> 允许评论</label
          ><label><input v-model="form.showToc" type="checkbox" /> 显示目录</label>
          <label>封面地址<input v-model="form.coverUrl" class="mt-1 w-full rounded-lg border bg-transparent p-2" /></label>
          <label>分类<select v-model="form.categoryId" class="mt-1 w-full rounded-lg border bg-transparent p-2"><option :value="null">未分类</option><option v-for="category in categories || []" :key="category.id" :value="category.id">{{ category.name }}</option></select></label>
          <fieldset class="md:col-span-2"><legend>标签</legend><label v-for="tag in tags || []" :key="tag.id" class="mr-4 inline-block"><input v-model="form.tagIds" type="checkbox" :value="tag.id" /> {{ tag.name }}</label></fieldset>
          <label>Canonical URL<input v-model="form.canonicalUrl" class="mt-1 w-full rounded-lg border bg-transparent p-2" /></label>
          <label>OG 图片<input v-model="form.ogImage" class="mt-1 w-full rounded-lg border bg-transparent p-2" /></label>
          <label><input v-model="form.noindex" type="checkbox" /> 不收录</label>
          <label><input v-model="form.nofollow" type="checkbox" /> 不跟踪链接</label>
        </div>
      </details>
    </div>
  </form>
</template>
