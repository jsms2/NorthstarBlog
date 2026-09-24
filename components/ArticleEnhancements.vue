<script setup lang="ts">
const props = defineProps<{ postSlug: string; postTitle: string; categoryId?: string | null; toc: boolean; progress: boolean; share: boolean; related: boolean }>()
const headings = ref<Array<{ id: string; title: string }>>([])
const progressValue = ref(0)
const copied = ref(false)
const { data: posts } = await useFetch('/api/public/posts', { query: { pageSize: 20 } })
const relatedPosts = computed(() => (posts.value?.items || []).filter(item => item.slug !== props.postSlug &&
  (!props.categoryId || item.category?.id === props.categoryId)).slice(0, 3))
function updateProgress() {
  const article = document.querySelector<HTMLElement>('[data-article-body]')
  if (!article) return
  const total = article.offsetTop + article.offsetHeight - innerHeight
  progressValue.value = total <= 0 ? 100 : Math.max(0, Math.min(100, Math.round((scrollY - article.offsetTop) / (total - article.offsetTop) * 100)))
}
onMounted(() => {
  const article = document.querySelector<HTMLElement>('[data-article-body]')
  headings.value = [...(article?.querySelectorAll<HTMLElement>('h2,h3') || [])].map((element, index) => {
    element.id ||= `section-${index + 1}`
    return { id: element.id, title: element.textContent || `第 ${index + 1} 节` }
  })
  addEventListener('scroll', updateProgress, { passive: true })
  updateProgress()
})
onUnmounted(() => removeEventListener('scroll', updateProgress))
async function copyLink() { await navigator.clipboard.writeText(location.href); copied.value = true }
</script>
<template>
  <div v-if="progress" data-reading-progress class="fixed left-0 top-0 z-50 h-1" :style="{ width: `${progressValue}%`, background: 'var(--accent)' }" />
  <nav v-if="toc && headings.length" aria-label="文章目录" class="mx-auto mt-8 max-w-3xl rounded-xl border p-4" style="border-color:var(--border)">
    <h2 class="font-semibold">目录</h2><a v-for="heading in headings" :key="heading.id" :href="`#${heading.id}`" class="mr-4 mt-2 inline-block text-sm">{{ heading.title }}</a>
  </nav>
  <div v-if="share" class="mx-auto mt-12 max-w-3xl"><button @click="copyLink">{{ copied ? '链接已复制' : '分享文章' }}</button></div>
  <section v-if="related && relatedPosts.length" class="mx-auto mt-12 max-w-3xl" aria-label="相关文章">
    <h2 class="text-xl font-semibold">相关文章</h2>
    <NuxtLink v-for="item in relatedPosts" :key="item.id" :to="`/posts/${item.slug}`" class="mt-3 block border-t pt-3" style="border-color:var(--border)">{{ item.title }}</NuxtLink>
  </section>
</template>
