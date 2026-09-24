<script setup lang="ts">
const route = useRoute()
const links = [
  ['/admin', '总览'],
  ['/admin/posts', '文章'],
  ['/admin/pages', '页面'],
  ['/admin/categories', '分类'],
  ['/admin/tags', '标签'],
  ['/admin/series', '系列'],
  ['/admin/comments', '评论'],
  ['/admin/media', '媒体'],
  ['/admin/navigation', '导航'],
  ['/admin/links', '友链'],
  ['/admin/redirects', '跳转'],
  ['/admin/analytics', '统计'],
  ['/admin/appearance', '外观'],
  ['/admin/data', '导入 / 导出'],
  ['/admin/backups', '备份'],
  ['/admin/settings', '设置'],
  ['/admin/security', '安全'],
]
</script>
<template>
  <div class="min-h-screen md:grid md:grid-cols-[240px_1fr]" style="background: var(--bg)">
    <aside class="border-r p-5" style="border-color: var(--border); background: var(--surface)">
      <div class="flex items-center justify-between">
        <NuxtLink to="/admin" class="font-semibold text-lg"
          >Northstar<span style="color: var(--accent)">.</span> Studio</NuxtLink
        >
      </div>
      <nav class="mt-10 grid gap-1">
        <NuxtLink
          v-for="l in links"
          :key="l[0]"
          :to="l[0]"
          class="rounded-lg px-3 py-2 text-sm"
          :class="route.path === l[0] ? 'font-semibold bg-black/5 dark:bg-white/10' : ''"
          >{{ l[1] }}</NuxtLink
        >
      </nav>
      <NuxtLink to="/" class="mt-10 block px-3 text-sm" style="color: var(--muted)"
        >← 查看网站</NuxtLink
      >
    </aside>
    <main class="p-5 md:p-10 overflow-auto"><slot /></main>
  </div>
</template>
