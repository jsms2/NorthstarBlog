<script setup lang="ts">
definePageMeta({ layout: 'admin', middleware: 'admin' })
const { data, refresh } = await useFetch('/api/admin/appearance')
const csrf = useCsrf()
const saved = ref('')
const file = ref<HTMLInputElement>()
const form = reactive({ siteName: 'Northstar', subtitle: '', logoUrl: '', faviconUrl: '', accentColor: '#d75a32',
  bodyFont: 'sans', headingFont: 'sans', monoFont: 'mono', contentWidth: 1120, articleWidth: 760,
  radius: 14, homeLayout: 'grid', articleLayout: 'standard', showToc: true,
  readingProgress: true, showShare: true, showRelated: true })
watchEffect(() => { if (data.value) Object.assign(form, data.value) })
async function save() {
  await $fetch('/api/admin/appearance', { method: 'PUT', headers: csrf.value, body: form })
  saved.value = '已保存'
  await refresh()
}
async function exportTheme() {
  const theme = await $fetch('/api/admin/appearance/export')
  const link = document.createElement('a')
  link.href = URL.createObjectURL(new Blob([JSON.stringify(theme, null, 2)], { type: 'application/json' }))
  link.download = 'northstar-theme.json'
  link.click()
  URL.revokeObjectURL(link.href)
}
async function importTheme(event: Event) {
  const target = event.target as HTMLInputElement
  const selected = target.files?.[0]
  if (!selected) return
  const theme = JSON.parse(await selected.text())
  await $fetch('/api/admin/appearance/import', { method: 'POST', headers: csrf.value, body: theme })
  await refresh()
  saved.value = '主题已恢复'
  if (file.value) file.value.value = ''
}
</script>
<template>
  <form class="max-w-4xl" @submit.prevent="save">
    <h1 class="text-3xl font-semibold">外观</h1>
    <p class="mt-2" style="color:var(--muted)">站点身份、排版、布局与阅读功能。</p>
    <div class="mt-8 grid gap-4 md:grid-cols-2">
      <label>站点名称<input v-model="form.siteName" required class="mt-1 w-full rounded border bg-transparent p-2"></label>
      <label>副标题<input v-model="form.subtitle" class="mt-1 w-full rounded border bg-transparent p-2"></label>
      <label>Logo URL<input v-model="form.logoUrl" type="url" class="mt-1 w-full rounded border bg-transparent p-2"></label>
      <label>Favicon URL<input v-model="form.faviconUrl" type="url" class="mt-1 w-full rounded border bg-transparent p-2"></label>
      <label>强调色<input v-model="form.accentColor" type="color" class="ml-2"></label>
      <label>正文字体<select v-model="form.bodyFont" class="ml-2 rounded border bg-transparent p-2"><option value="sans">无衬线</option><option value="serif">衬线</option></select></label>
      <label>标题字体<select v-model="form.headingFont" class="ml-2 rounded border bg-transparent p-2"><option value="sans">无衬线</option><option value="serif">衬线</option></select></label>
      <label>代码字体<select v-model="form.monoFont" class="ml-2 rounded border bg-transparent p-2"><option value="mono">等宽</option><option value="sans">无衬线</option></select></label>
      <label>页面宽度<input v-model.number="form.contentWidth" type="number" min="800" max="1600" class="ml-2 w-24 rounded border bg-transparent p-2"> px</label>
      <label>文章宽度<input v-model.number="form.articleWidth" type="number" min="560" max="1100" class="ml-2 w-24 rounded border bg-transparent p-2"> px</label>
      <label>圆角<input v-model.number="form.radius" type="number" min="0" max="32" class="ml-2 w-24 rounded border bg-transparent p-2"> px</label>
      <label>首页布局<select v-model="form.homeLayout" class="ml-2 rounded border bg-transparent p-2"><option value="grid">网格</option><option value="list">列表</option></select></label>
      <label>文章布局<select v-model="form.articleLayout" class="ml-2 rounded border bg-transparent p-2"><option value="standard">标准</option><option value="wide">宽幅</option></select></label>
      <label><input v-model="form.showToc" type="checkbox"> 显示目录</label>
      <label><input v-model="form.readingProgress" type="checkbox"> 阅读进度</label>
      <label><input v-model="form.showShare" type="checkbox"> 分享</label>
      <label><input v-model="form.showRelated" type="checkbox"> 相关文章</label>
    </div>
    <div class="mt-6 flex flex-wrap items-center gap-4"><button class="rounded-full px-5 py-2 text-white" style="background:var(--accent)">保存外观</button><button type="button" @click="exportTheme">导出主题</button><label>导入主题<input ref="file" type="file" accept="application/json,.json" class="ml-2" @change="importTheme"></label><span>{{ saved }}</span></div>
  </form>
</template>
