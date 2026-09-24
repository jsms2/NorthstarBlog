<script setup lang="ts">
definePageMeta({ layout: 'admin', middleware: 'admin' })
const csrf = useCsrf()
const input = ref<HTMLInputElement>()
const busy = ref(false)
const message = ref('')
const result = ref<Record<string, number> | null>(null)
async function importFiles(files: FileList | null) {
  if (!files?.length) return
  busy.value = true
  message.value = ''
  result.value = null
  try {
    const selected = [...files]
    if (selected.some((file) => file.size > 2_000_000) || selected.length > 100)
      throw new Error('每篇 Markdown 不超过 2MB，最多 100 篇')
    let payload: Record<string, unknown>
    if (selected.length === 1 && selected[0]!.name.toLowerCase().endsWith('.json')) {
      if (selected[0]!.size > 15 * 1024 * 1024) throw new Error('JSON 导入文件不能超过 15MB')
      const parsed: unknown = JSON.parse(await selected[0]!.text())
      if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed))
        throw new Error('JSON 文件顶层必须是对象')
      payload = parsed as Record<string, unknown>
    } else {
      payload = {
        format: 'markdown',
        files: await Promise.all(
          selected.map(async (file) => ({ filename: file.name, content: await file.text() })),
        ),
      }
    }
    const endpoint: string = '/api/admin/import'
    const response = await $fetch<{ ok: boolean; imported: Record<string, number> }>(endpoint, {
      method: 'POST',
      headers: csrf.value,
      body: payload,
    })
    result.value = response.imported
    message.value = '导入已完成；冲突内容按 slug 合并，文章正文会重新安全渲染。'
  } catch (error) {
    message.value =
      (error as { data?: { message?: string }; message?: string }).data?.message ||
      (error as Error).message ||
      '导入失败'
  } finally {
    busy.value = false
    if (input.value) input.value.value = ''
  }
}
</script>
<template>
  <div class="max-w-4xl">
    <h1 class="text-3xl font-semibold">导入 / 导出</h1>
    <p class="mt-2" style="color: var(--muted)">
      开放格式导出站点内容与主题设置；导入按 slug 匹配现有分类、标签和文章。
    </p>
    <div class="mt-8 grid gap-5 md:grid-cols-2">
      <section
        class="rounded-xl border p-6"
        style="border-color: var(--border); background: var(--surface)"
      >
        <h2 class="text-xl font-semibold">导出</h2>
        <p class="mt-2 text-sm" style="color: var(--muted)">
          JSON 包含内容、关系和非敏感设置。Markdown ZIP 含 Front Matter 和正文文件。
        </p>
        <div class="mt-5 flex flex-wrap gap-3">
          <a
            href="/api/admin/export"
            class="rounded-lg px-4 py-2 text-white"
            style="background: var(--accent)"
            >下载全站 JSON</a
          >
          <a href="/api/admin/export?format=markdown" class="rounded-lg border px-4 py-2"
            >批量 Markdown</a
          >
        </div>
      </section>
      <section
        class="rounded-xl border p-6"
        style="border-color: var(--border); background: var(--surface)"
      >
        <h2 class="text-xl font-semibold">导入</h2>
        <p class="mt-2 text-sm" style="color: var(--muted)">
          选择全站 JSON，或一次选择多篇带 YAML Front Matter 的 Markdown 文件。
        </p>
        <label class="mt-5 inline-flex cursor-pointer rounded-lg border px-4 py-2"
          >选择 JSON / Markdown
          <input
            ref="input"
            type="file"
            accept=".json,.md,text/markdown,application/json"
            multiple
            class="sr-only"
            @change="importFiles(($event.target as HTMLInputElement).files)"
          />
        </label>
        <span v-if="busy" class="ml-3 text-sm">正在校验并导入…</span>
      </section>
    </div>
    <section
      v-if="message"
      class="mt-5 rounded-xl border p-5"
      style="border-color: var(--border); background: var(--surface)"
    >
      <p>{{ message }}</p>
      <div v-if="result" class="mt-3 flex flex-wrap gap-3 text-sm">
        <span v-for="(count, key) in result" :key="key">{{ key }}：{{ count }}</span>
      </div>
    </section>
  </div>
</template>
