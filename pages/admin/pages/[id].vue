<script setup lang="ts">
definePageMeta({ layout: 'admin', middleware: 'admin' })
const route = useRoute()
const { data } = await useFetch(`/api/admin/pages/${route.params.id}`)
const initial = computed(() =>
  data.value
    ? {
        ...data.value,
        excerpt: data.value.excerpt || '',
        seoTitle: data.value.seoTitle || '',
        seoDescription: data.value.seoDescription || '',
        ogTitle: data.value.ogTitle || '',
        ogDescription: data.value.ogDescription || '',
        ogImage: data.value.ogImage || '',
        canonicalUrl: data.value.canonicalUrl || '',
        customCss: data.value.customCss || '',
        customJs: data.value.customJs || '',
      }
    : undefined,
)
</script>
<template>
  <AdminPageEditor v-if="initial" :initial="initial" :page-id="String(route.params.id)" />
</template>
