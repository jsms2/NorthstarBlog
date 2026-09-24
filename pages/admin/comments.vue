<script setup lang="ts">
definePageMeta({ layout: 'admin', middleware: 'admin' })
const { data, refresh } = await useFetch('/api/admin/comments')
const csrf = useCsrf()
const replies = reactive<Record<string, string>>({})
async function change(id: string, body: Record<string, unknown>) {
  await $fetch(`/api/admin/comments/${id}`, { method: 'PATCH', headers: csrf.value, body })
  await refresh()
}
async function reply(id: string) {
  await $fetch(`/api/admin/comments/${id}/reply`, { method: 'POST', headers: csrf.value, body: { content: replies[id] } })
  replies[id] = ''
  await refresh()
}
async function remove(id: string) {
  if (!confirm('永久删除这条评论及其回复？')) return
  await $fetch(`/api/admin/comments/${id}`, { method: 'DELETE', headers: csrf.value })
  await refresh()
}
</script>
<template>
  <div>
    <h1 class="text-3xl font-semibold">评论</h1>
    <div class="mt-8">
      <article v-for="c in data || []" :key="c.id" class="border-t py-5" style="border-color:var(--border)">
        <div class="flex justify-between"><strong>{{ c.authorName }} <small>在《{{ c.post?.title || c.page?.title }}》</small></strong><small>{{ c.status }}</small></div>
        <p class="my-3 whitespace-pre-wrap">{{ c.content }}</p>
        <div class="flex flex-wrap gap-4 text-sm">
          <button v-if="c.status !== 'APPROVED'" @click="change(c.id, { status: 'APPROVED' })">通过 / 恢复</button>
          <button @click="change(c.id, { status: 'SPAM' })">垃圾</button>
          <button v-if="c.status !== 'TRASH'" @click="change(c.id, { status: 'TRASH' })">移至回收站</button>
          <button v-else @click="remove(c.id)">永久删除</button>
          <button @click="change(c.id, { pinned: !c.pinned })">{{ c.pinned ? '取消置顶' : '置顶' }}</button>
        </div>
        <form v-if="c.status !== 'TRASH'" class="mt-4 flex gap-2" @submit.prevent="reply(c.id)">
          <input v-model="replies[c.id]" required minlength="2" maxlength="5000" placeholder="管理员回复" class="min-w-0 flex-1 rounded border bg-transparent p-2">
          <button type="submit">回复</button>
        </form>
      </article>
    </div>
  </div>
</template>
