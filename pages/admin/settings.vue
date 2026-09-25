<script setup lang="ts">
import { requestErrorMessage } from '../../lib/request-error'
definePageMeta({ layout: 'admin', middleware: 'admin' })
const { data, error: loadError } = await useFetch('/api/admin/settings')
const csrf = useCsrf()
const form = reactive({ siteName: '', description: '', siteUrl: '', accentColor: '#d75a32',
  commentsEnabled: true, analyticsEnabled: true, customCss: '', headerHtml: '', footerHtml: '' })
watchEffect(() => Object.assign(form, data.value || {}))
const saved = ref(false)
const saving = ref(false)
const error = ref('')
async function save() {
  if (saving.value || loadError.value) return
  saving.value = true
  saved.value = false
  error.value = ''
  try {
    await $fetch('/api/admin/settings', { method: 'PUT', headers: csrf.value, body: form })
    saved.value = true
  } catch (failure) {
    error.value = requestErrorMessage(failure, '设置保存失败，请稍后重试')
  } finally {
    saving.value = false
  }
}
</script>
<template>
  <form class="max-w-3xl" @submit.prevent="save">
    <h1 class="text-3xl font-semibold">设置</h1>
    <p class="mt-2" style="color:var(--muted)">站点身份、外观与代码注入。</p>
    <p v-if="loadError" role="alert" class="mt-4 text-red-700">设置加载失败，请刷新页面后重试。</p>
    <p v-if="error" role="alert" class="mt-4 text-red-700">{{ error }}</p>
    <p class="sr-only" aria-live="polite">{{ saved ? '设置已保存' : '' }}</p>
    <div class="mt-8 grid gap-5">
      <label>站点名称<input v-model="form.siteName" class="mt-1 w-full rounded-lg border bg-transparent p-3"></label>
      <label>站点描述<textarea v-model="form.description" class="mt-1 w-full rounded-lg border bg-transparent p-3"/></label>
      <label>站点 URL<input v-model="form.siteUrl" type="url" class="mt-1 w-full rounded-lg border bg-transparent p-3"></label>
      <label>强调色<input v-model="form.accentColor" type="color" class="ml-3"></label>
      <label class="flex items-center gap-2"><input v-model="form.commentsEnabled" type="checkbox">全站允许评论</label>
      <label class="flex items-center gap-2"><input v-model="form.analyticsEnabled" type="checkbox">记录访问统计</label>
      <div class="rounded-xl border border-amber-400/50 bg-amber-50 p-4 text-amber-900">自定义代码可能影响网站安全和显示。后台不会执行这些代码。</div>
      <label>自定义 CSS<textarea v-model="form.customCss" rows="8" class="mt-1 w-full rounded-lg border bg-transparent p-3 font-mono"/></label>
      <label>Header HTML<textarea v-model="form.headerHtml" rows="5" class="mt-1 w-full rounded-lg border bg-transparent p-3 font-mono"/></label>
      <label>Footer HTML<textarea v-model="form.footerHtml" rows="5" class="mt-1 w-full rounded-lg border bg-transparent p-3 font-mono"/></label>
    </div>
    <button :disabled="saving || !!loadError" class="mt-6 rounded-full px-5 py-2 text-white disabled:opacity-50" style="background:var(--accent)">{{ saving ? '保存中…' : '保存设置' }}</button>
    <span v-if="saved" class="ml-4">已保存</span>
  </form>
</template>
