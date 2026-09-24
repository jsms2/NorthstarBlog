<script setup lang="ts">
definePageMeta({ layout: 'admin', middleware: 'admin' })
type Backup = {
  id: string
  filename: string
  size: number | string
  status: string
  createdAt: string
}
const csrf = useCsrf()
const { data, refresh } = await useFetch<Backup[]>('/api/admin/backups')
const busy = ref(false)
const error = ref('')
function size(value: number | string) {
  const bytes = Number(value)
  return bytes < 1024 * 1024
    ? `${(bytes / 1024).toFixed(1)} KB`
    : `${(bytes / 1024 / 1024).toFixed(1)} MB`
}
function timestamp(value: string) { return `${new Date(value).toISOString().slice(0, 16).replace('T', ' ')} UTC` }
async function create() {
  busy.value = true
  error.value = ''
  try {
    const endpoint: string = '/api/admin/backups'
    await $fetch(endpoint, { method: 'POST', headers: csrf.value, body: {} })
    await refresh()
  } catch (e) {
    error.value =
      (e as { data?: { message?: string } }).data?.message ||
      '创建失败；请检查服务器 mysqldump 是否安装且有数据库读取权限。'
  } finally {
    busy.value = false
  }
}
async function remove(id: string) {
  if (!confirm('删除这份备份？此操作无法撤销。')) return
  const endpoint: string = `/api/admin/backups/${id}`
  await $fetch(endpoint, { method: 'DELETE', headers: csrf.value })
  await refresh()
}
</script>
<template>
  <div class="max-w-5xl">
    <div class="flex flex-wrap items-center justify-between gap-4">
      <div>
        <h1 class="text-3xl font-semibold">备份</h1>
        <p class="mt-2" style="color: var(--muted)">
          MySQL SQL dump、Local uploads 和元数据存放在 Web Public 目录之外。
        </p>
      </div>
      <button
        :disabled="busy"
        class="rounded-lg px-4 py-2 text-white disabled:opacity-50"
        style="background: var(--accent)"
        @click="create"
      >
        {{ busy ? '正在创建…' : '创建备份' }}
      </button>
    </div>
    <p v-if="error" class="mt-5 rounded-lg bg-red-50 p-4 text-red-800">{{ error }}</p>
    <div
      class="mt-8 overflow-hidden rounded-xl border"
      style="border-color: var(--border); background: var(--surface)"
    >
      <div
        v-for="backup in data || []"
        :key="backup.id"
        class="flex flex-wrap items-center justify-between gap-4 border-b p-5 last:border-0"
        style="border-color: var(--border)"
      >
        <div>
          <strong>{{ backup.filename }}</strong>
          <p class="mt-1 text-sm" style="color: var(--muted)">
            {{ timestamp(backup.createdAt) }} · {{ size(backup.size) }} ·
            {{ backup.status }}
          </p>
        </div>
        <div class="flex gap-4">
          <a :href="`/api/admin/backups/${backup.id}`" class="underline">下载</a
          ><button class="text-red-700 underline" @click="remove(backup.id)">删除</button>
        </div>
      </div>
      <p v-if="!data?.length" class="p-8 text-center" style="color: var(--muted)">还没有备份</p>
    </div>
  </div>
</template>
