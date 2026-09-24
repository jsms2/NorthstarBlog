<script setup lang="ts">
const route = useRoute()
const { data, error } = await useFetch(`/api/public/tags/${route.params.slug}`)
if (error.value) throw createError({ statusCode: 404, statusMessage: '标签不存在' })
useSeoMeta({ title: () => data.value?.seoTitle || data.value?.name, description: () => data.value?.seoDescription || data.value?.description || '' })
</script>
<template>
  <section v-if="data" class="container py-16">
    <h1 class="text-5xl font-semibold" :style="{ color: data.color || 'inherit' }">{{ data.name }}</h1>
    <p v-if="data.description" class="mt-4" style="color:var(--muted)">{{ data.description }}</p>
    <div class="mt-10"><article v-for="post in data.posts" :key="post.id" class="border-t py-6" style="border-color:var(--border)"><NuxtLink :to="`/posts/${post.slug}`" class="text-xl font-semibold">{{ post.title }}</NuxtLink><p class="mt-2" style="color:var(--muted)">{{ post.excerpt }}</p></article></div>
  </section>
</template>
