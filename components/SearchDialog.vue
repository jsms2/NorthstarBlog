<script setup lang="ts">
const emit = defineEmits<{ close: [] }>()
const q = ref('')
const { data, error, pending, refresh } = await useFetch('/api/search', { query: { q }, immediate: false })
watch(q, () => { if (q.value.trim().length > 1) void refresh() })
</script>
<template>
  <div class="fixed inset-0 z-50 bg-black/50 p-4" @click.self="emit('close')">
    <section role="dialog" aria-modal="true" aria-label="站内搜索" class="mx-auto mt-[10vh] max-w-2xl rounded-2xl p-5" style="background:var(--surface)">
      <div class="flex gap-3"><input v-model="q" autofocus class="w-full rounded-xl border bg-transparent px-4 py-3 focus" style="border-color:var(--border)" placeholder="搜索文章、标签或页面…"><button @click="emit('close')">关闭</button></div>
      <div class="mt-4 max-h-96 overflow-auto">
        <p v-if="error" role="alert" class="py-4 text-red-700">搜索失败，请稍后重试。</p>
        <p v-else-if="pending" class="py-4" role="status">搜索中…</p>
        <template v-else>
          <NuxtLink v-for="item in data?.items || []" :key="item.url" :to="item.url" class="block border-t py-4" style="border-color:var(--border)" @click="emit('close')"><strong>{{ item.title }}</strong><p class="text-sm" style="color:var(--muted)">{{ item.excerpt }}</p></NuxtLink>
          <p v-if="q.length > 1 && !data?.items?.length" class="py-8 text-center" style="color:var(--muted)">没有找到相关内容</p>
        </template>
      </div>
    </section>
  </div>
</template>
