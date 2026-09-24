<script setup lang="ts">
const route = useRoute()
const { data, error } = await useFetch(`/api/public/categories/${route.params.slug}`)
if (error.value) throw createError({ statusCode: 404, statusMessage: '分类不存在' })
useSeoMeta({ title: () => data.value?.seoTitle || data.value?.name, description: () => data.value?.seoDescription || data.value?.description || '' })
</script>
<template>
  <section v-if="data" class="container py-16">
    <p v-if="data.parent" class="text-sm"><NuxtLink :to="`/categories/${data.parent.slug}`">{{ data.parent.name }}</NuxtLink> /</p>
    <h1 class="mt-3 text-5xl font-semibold">{{ data.name }}</h1>
    <p v-if="data.description" class="mt-4" style="color:var(--muted)">{{ data.description }}</p>
    <img v-if="data.coverUrl" :src="data.coverUrl" :alt="data.name" class="mt-8 max-h-80 w-full rounded-xl object-cover">
    <nav v-if="data.children.length" class="mt-8 flex gap-4"><NuxtLink v-for="child in data.children" :key="child.id" :to="`/categories/${child.slug}`">{{ child.name }}</NuxtLink></nav>
    <div class="mt-10"><article v-for="post in data.posts" :key="post.id" class="border-t py-6" style="border-color:var(--border)"><NuxtLink :to="`/posts/${post.slug}`" class="text-xl font-semibold">{{ post.title }}</NuxtLink><p class="mt-2" style="color:var(--muted)">{{ post.excerpt }}</p></article></div>
  </section>
</template>
