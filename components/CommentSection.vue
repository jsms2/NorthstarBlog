<script setup lang="ts">
import { requestErrorMessage, requestErrorStatus } from '../lib/request-error'
type Comment = { id: string; authorName: string; content: string; createdAt: string; parentId?: string | null; isAdmin?: boolean; likes?: number }
const props = defineProps<{ postId?: string; pageId?: string; comments: Comment[] }>()
const form = reactive({ authorName: '', email: '', website: '', content: '', company: '' })
const sent = ref(false)
const submitting = ref(false)
const closed = ref(false)
const submitError = ref('')
const likeError = ref('')
const liking = ref<string[]>([])
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
  if (submitting.value || closed.value) return
  submitting.value = true
  submitError.value = ''
  const path = props.pageId ? `/api/public/pages/${props.pageId}/comments` : `/api/public/posts/${props.postId}/comments`
  try {
    await $fetch(path, { method: 'POST', body: { ...form, parentId: replyingTo.value || undefined } })
    sent.value = true
  } catch (error) {
    submitError.value = requestErrorMessage(error, '评论提交失败，请稍后重试')
    if (requestErrorStatus(error) === 403 && submitError.value.includes('评论已关闭')) closed.value = true
  } finally {
    submitting.value = false
  }
}
async function like(id: string) {
  if (liking.value.includes(id) || liked.value.includes(id)) return
  liking.value.push(id)
  likeError.value = ''
  try {
    const result = await $fetch<{ likes: number }>(`/api/public/comments/${id}/like`, { method: 'POST' })
    likes[id] = result.likes
    liked.value.push(id)
  } catch (error) {
    likeError.value = requestErrorMessage(error, '点赞失败，请稍后重试')
  } finally {
    liking.value = liking.value.filter((item) => item !== id)
  }
}
</script>
<template>
  <section v-if="closed" class="mx-auto mt-20 max-w-3xl" role="status">评论功能已关闭。</section>
  <section v-else class="mx-auto mt-20 max-w-3xl border-t pt-10" style="border-color:var(--border)">
    <h2 class="text-2xl font-semibold">评论</h2>
    <p v-if="likeError" role="alert" class="mt-4 text-red-700">{{ likeError }}</p>
    <article v-for="c in ordered" :key="c.id" class="border-b py-6" :style="{ borderColor: 'var(--border)', marginLeft: `${Math.min(c.depth, 4) * 1.5}rem` }">
      <strong>{{ c.authorName }} <small v-if="c.isAdmin">站长</small></strong>
      <p class="mt-2 whitespace-pre-wrap">{{ c.content }}</p>
      <div class="mt-2 flex gap-4 text-sm"><button :disabled="liked.includes(c.id) || liking.includes(c.id)" @click="like(c.id)">♡ {{ likes[c.id] ?? c.likes ?? 0 }}</button><button @click="replyingTo = c.id; sent = false; submitError = ''">回复</button></div>
    </article>
    <p v-if="sent" class="mt-8 rounded-xl bg-green-100 p-4 text-green-900">评论已提交，审核后会显示。</p>
    <form v-else class="mt-8 grid gap-4" @submit.prevent="submit">
      <p v-if="submitError" role="alert" class="rounded-lg bg-red-50 p-3 text-red-800">{{ submitError }}</p>
      <p v-if="replyingTo" class="text-sm">正在回复 <button type="button" @click="replyingTo = null">取消</button></p>
      <input v-model="form.authorName" required maxlength="100" placeholder="昵称" class="rounded-lg border bg-transparent p-3">
      <input v-model="form.email" required type="email" placeholder="Email（不会公开）" class="rounded-lg border bg-transparent p-3">
      <textarea v-model="form.content" required maxlength="5000" rows="5" placeholder="写下你的评论…" class="rounded-lg border bg-transparent p-3" />
      <input v-model="form.company" tabindex="-1" autocomplete="off" class="hidden">
      <button :disabled="submitting" class="justify-self-start rounded-full px-5 py-2 text-white disabled:opacity-50" style="background:var(--accent)">{{ submitting ? '提交中…' : '提交评论' }}</button>
    </form>
  </section>
</template>
