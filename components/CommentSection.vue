<script setup lang="ts">
type Comment = { id: string; authorName: string; content: string; createdAt: string; parentId?: string | null; isAdmin?: boolean; likes?: number }
const props = defineProps<{ postId?: string; pageId?: string; comments: Comment[] }>()
const form = reactive({ authorName: '', email: '', website: '', content: '', company: '' })
const sent = ref(false)
const replyingTo = ref<string | null>(null)
const liked = ref<string[]>([])
const likes = reactive<Record<string, number>>({})
const ordered = computed(() => {
  const result: Array<Comment & { depth: number }> = []
  const visit = (parentId: string | null, depth: number) => {
    for (const comment of props.comments.filter(item => (item.parentId || null) === parentId)) {
      result.push({ ...comment, depth })
      visit(comment.id, depth + 1)
    }
  }
  visit(null, 0)
  return result
})
async function submit() {
  const path = props.pageId ? `/api/public/pages/${props.pageId}/comments` : `/api/public/posts/${props.postId}/comments`
  await $fetch(path, { method: 'POST', body: { ...form, parentId: replyingTo.value || undefined } })
  sent.value = true
}
async function like(id: string) {
  const result = await $fetch<{ likes: number }>(`/api/public/comments/${id}/like`, { method: 'POST' })
  likes[id] = result.likes
  liked.value.push(id)
}
</script>
<template>
  <section class="mx-auto mt-20 max-w-3xl border-t pt-10" style="border-color:var(--border)">
    <h2 class="text-2xl font-semibold">评论</h2>
    <article v-for="c in ordered" :key="c.id" class="border-b py-6" :style="{ borderColor: 'var(--border)', marginLeft: `${Math.min(c.depth, 4) * 1.5}rem` }">
      <strong>{{ c.authorName }} <small v-if="c.isAdmin">站长</small></strong>
      <p class="mt-2 whitespace-pre-wrap">{{ c.content }}</p>
      <div class="mt-2 flex gap-4 text-sm"><button :disabled="liked.includes(c.id)" @click="like(c.id)">♡ {{ likes[c.id] ?? c.likes ?? 0 }}</button><button @click="replyingTo = c.id; sent = false">回复</button></div>
    </article>
    <p v-if="sent" class="mt-8 rounded-xl bg-green-100 p-4 text-green-900">评论已提交，审核后会显示。</p>
    <form v-else class="mt-8 grid gap-4" @submit.prevent="submit">
      <p v-if="replyingTo" class="text-sm">正在回复 <button type="button" @click="replyingTo = null">取消</button></p>
      <input v-model="form.authorName" required maxlength="100" placeholder="昵称" class="rounded-lg border bg-transparent p-3">
      <input v-model="form.email" required type="email" placeholder="Email（不会公开）" class="rounded-lg border bg-transparent p-3">
      <textarea v-model="form.content" required maxlength="5000" rows="5" placeholder="写下你的评论…" class="rounded-lg border bg-transparent p-3" />
      <input v-model="form.company" tabindex="-1" autocomplete="off" class="hidden">
      <button class="justify-self-start rounded-full px-5 py-2 text-white" style="background:var(--accent)">提交评论</button>
    </form>
  </section>
</template>
