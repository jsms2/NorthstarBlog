<script setup lang="ts">
const route = useRoute()
const { data, error } = await useFetch(`/api/public/series/${route.params.slug}`)
if (error.value) throw createError({ statusCode: 404, statusMessage: '系列不存在' })
const total = computed(() => data.value?.posts.length || 0)
useSeoMeta({ title: () => data.value?.seoTitle || data.value?.name, description: () => data.value?.seoDescription || data.value?.description || '' })
</script>
<template>
  <main v-if="data" class="container py-16">
    <header class="mx-auto max-w-3xl">
      <p class="text-xs uppercase tracking-widest" style="color:var(--accent)">Reading series · {{ total }} 篇</p>
      <h1 class="mt-3 text-5xl font-semibold">{{ data.name }}</h1>
      <p class="mt-5 text-lg" style="color:var(--muted)">{{ data.description }}</p>
      <img v-if="data.coverUrl" :src="data.coverUrl" :alt="data.name" class="mt-8 max-h-80 w-full rounded-xl object-cover">
    </header>
    <ol class="mx-auto mt-10 max-w-3xl">
      <li v-for="(entry, index) in data.posts" :key="entry.postId" class="border-t py-5" style="border-color:var(--border)">
        <NuxtLink :to="`/posts/${entry.post.slug}`">
          <span class="text-sm" style="color:var(--muted)">{{ String(index + 1).padStart(2, '0') }} / {{ total }}</span>
          <h2 class="mt-1 text-xl font-semibold">{{ entry.post.title }}</h2>
          <p class="mt-1" style="color:var(--muted)">{{ entry.post.excerpt }}</p>
          <div class="mt-3 h-1 rounded bg-black/10 dark:bg-white/10"><div class="h-full rounded" :style="{ background: 'var(--accent)', width: `${entry.progress}%` }" /></div>
        </NuxtLink>
        <nav class="mt-3 flex justify-between text-sm" aria-label="系列文章导航">
          <NuxtLink v-if="entry.previous" :to="`/posts/${entry.previous.slug}`">← {{ entry.previous.title }}</NuxtLink><span v-else />
          <NuxtLink v-if="entry.next" :to="`/posts/${entry.next.slug}`">{{ entry.next.title }} →</NuxtLink>
        </nav>
      </li>
    </ol>
  </main>
</template>
