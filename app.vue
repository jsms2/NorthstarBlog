<script setup lang="ts">
import { requestErrorMessage } from './lib/request-error'
const actionError = ref('')
onErrorCaptured((error, _instance, info) => {
  if (!import.meta.client || !/event handler|watcher callback/.test(info)) return
  actionError.value = requestErrorMessage(error)
  return false
})
function onUnhandledRejection(event: PromiseRejectionEvent) {
  actionError.value = requestErrorMessage(event.reason)
  event.preventDefault()
}
onMounted(() => window.addEventListener('unhandledrejection', onUnhandledRejection))
onUnmounted(() => window.removeEventListener('unhandledrejection', onUnhandledRejection))
useHead({ script: [{ innerHTML: "(()=>{try{const m=localStorage.getItem('color-mode')||'system';if(m==='dark'||(m==='system'&&matchMedia('(prefers-color-scheme:dark)').matches))document.documentElement.classList.add('dark')}catch{}})()", tagPosition: 'head' }] })
</script>
<template>
  <NuxtLayout><NuxtPage /></NuxtLayout>
  <div v-if="actionError" role="alert" class="fixed bottom-5 left-1/2 z-[100] flex max-w-[calc(100vw-2rem)] -translate-x-1/2 items-center gap-4 rounded-xl border border-red-300 bg-red-50 px-4 py-3 text-red-900 shadow-lg">
    <span>{{ actionError }}</span>
    <button type="button" aria-label="关闭错误提示" class="font-semibold" @click="actionError = ''">×</button>
  </div>
</template>
