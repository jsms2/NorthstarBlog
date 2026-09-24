<script setup lang="ts">
definePageMeta({ layout: 'admin', middleware: 'admin' })
const route = useRoute()
const { data } = await useFetch(`/api/admin/posts/${route.params.id}`)
const initial = computed(() => {
  const post = data.value as {
    excerpt?: string | null
    seoTitle?: string | null
    seoDescription?: string | null
    ogTitle?: string | null
    ogDescription?: string | null
    scheduledAt?: string | null
    tags?: Array<{ tagId: string }>
  } | null
  if (!post) return undefined
  return {
    ...post,
    excerpt: post.excerpt || '',
    seoTitle: post.seoTitle || '',
    seoDescription: post.seoDescription || '',
    ogTitle: post.ogTitle || '',
    ogDescription: post.ogDescription || '',
    scheduledAt: post.scheduledAt || null,
    tagIds: post.tags?.map(tag => tag.tagId) || [],
  }
})
</script>
<template><AdminPostEditor v-if="initial" :post-id="String(route.params.id)" :initial="initial" /></template>
