<script setup lang="ts">
const route = useRoute()
const { data: post, error } = await useFetch(`/api/public/posts/${route.params.slug}`)
const { data: appearance } = await useFetch('/api/public/appearance')
if (error.value) throw createError({ statusCode: 404, statusMessage: '文章不存在' })
const origin = useRequestURL().origin
const canonical = computed(() => post.value?.canonicalUrl || `${appearance.value?.siteUrl || origin}/posts/${post.value?.slug}`)
const title = computed(() => post.value?.seoTitle || post.value?.title || '')
const description = computed(() => post.value?.seoDescription || post.value?.excerpt || '')
const ogTitle = computed(() => post.value?.ogTitle || title.value)
const ogDescription = computed(() => post.value?.ogDescription || description.value)
const image = computed(() => post.value?.ogImage || post.value?.coverUrl || '')
useSeoMeta({ title, description, ogTitle, ogDescription, ogImage: image, ogType: 'article',
  twitterCard: 'summary_large_image', twitterTitle: ogTitle, twitterDescription: ogDescription,
  twitterImage: image, robots: () => `${post.value?.noindex ? 'noindex' : 'index'},${post.value?.nofollow ? 'nofollow' : 'follow'}` })
useHead(() => ({ link: [{ rel: 'canonical', href: canonical.value }], script: [{ type: 'application/ld+json',
  innerHTML: JSON.stringify({ '@context': 'https://schema.org', '@type': 'BlogPosting', headline: post.value?.title,
    description: description.value, datePublished: post.value?.publishedAt, dateModified: post.value?.updatedAt,
    mainEntityOfPage: canonical.value, image: image.value || undefined }).replace(/</g, '\\u003c') }] }))
</script>
<template><article v-if="post" class="container py-16" :data-article-layout="appearance?.articleLayout"><header class="mx-auto" :class="appearance?.articleLayout==='wide'?'max-w-5xl':'max-w-3xl'"><p class="text-sm" style="color:var(--muted)">{{post.publishedAt?new Date(post.publishedAt).toLocaleDateString('zh-CN'):''}} · {{post.readingMinutes}} 分钟阅读 · {{post.wordCount}} 字</p><h1 class="mt-5 text-4xl font-semibold leading-tight tracking-[-.035em] md:text-6xl">{{post.title}}</h1><p class="mt-6 text-xl" style="color:var(--muted)">{{post.excerpt}}</p></header><img v-if="post.coverUrl" :src="post.coverUrl" :alt="post.title" class="mx-auto mt-12 max-h-[560px] w-full max-w-5xl rounded-2xl object-cover"><div data-article-body><ContentRenderer class="prose mx-auto mt-14" :html="post.html" /></div><ArticleEnhancements :post-slug="post.slug" :post-title="post.title" :category-id="post.categoryId" :toc="!!appearance?.showToc && post.showToc" :progress="!!appearance?.readingProgress" :share="!!appearance?.showShare" :related="!!appearance?.showRelated" /><CommentSection v-if="post.allowComments" :post-id="post.id" :comments="post.comments" /></article></template>
