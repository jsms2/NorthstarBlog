<script setup lang="ts">
const route = useRoute()
const { data, error } = await useFetch(`/api/public/pages/${route.params.slug}`)
if (error.value) throw createError({ statusCode: 404, statusMessage: '页面不存在' })
const origin = useRequestURL().origin
const canonical = computed(() => data.value?.canonicalUrl || `${origin}/${data.value?.slug}`)
const title = computed(() => data.value?.seoTitle || data.value?.title || '')
const description = computed(() => data.value?.seoDescription || data.value?.excerpt || '')
const ogTitle = computed(() => data.value?.ogTitle || title.value)
const ogDescription = computed(() => data.value?.ogDescription || description.value)
const image = computed(() => data.value?.ogImage || '')
useSeoMeta({
  title,
  description,
  ogTitle,
  ogDescription,
  ogImage: image,
  ogType: 'website',
  twitterCard: 'summary_large_image',
  twitterTitle: ogTitle,
  twitterDescription: ogDescription,
  twitterImage: image,
  robots: () =>
    `${data.value?.noindex ? 'noindex' : 'index'},${data.value?.nofollow ? 'nofollow' : 'follow'}`,
})
useHead(() => ({
  link: [{ rel: 'canonical', href: canonical.value }],
  script: [{ type: 'application/ld+json', innerHTML: JSON.stringify({ '@context': 'https://schema.org',
    '@type': 'WebPage', name: data.value?.title, description: description.value, url: canonical.value }).replace(/</g, '\\u003c') },
    ...(data.value?.customJs ? [{ innerHTML: data.value.customJs }] : [])],
  style: data.value?.customCss ? [{ innerHTML: data.value.customCss }] : [],
}))
</script>
<template>
  <article v-if="data" class="container py-16">
    <h1 class="mx-auto mb-8 max-w-3xl text-5xl font-semibold">{{ data.title }}</h1>
    <ContentRenderer class="mx-auto max-w-3xl" :html="data.html" />
    <CommentSection v-if="data.allowComments" :page-id="data.id" :comments="data.comments" />
  </article>
</template>
