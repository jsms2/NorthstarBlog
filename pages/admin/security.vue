<script setup lang="ts">
import QRCode from 'qrcode'
definePageMeta({ layout: 'admin', middleware: 'admin' })
const csrf = useCsrf()
const { data: me } = await useFetch('/api/auth/me')
const { data: sessions, refresh } = await useFetch('/api/admin/security/sessions')
const security = ref<{ enabled: boolean; pending: boolean; recoveryCodesRemaining: number } | null>(
  null,
)
const setup = ref<{ secret: string; otpauth: string } | null>(null)
const qr = ref('')
const code = ref('')
const recovered = ref<string[]>([])
const error = ref('')
const password = ref('')
const disablingCode = ref('')
const statusEndpoint: string = '/api/admin/security/status'
const pw = reactive({ currentPassword: '', newPassword: '', logoutOthers: true })
onMounted(async () => {
  security.value = await $fetch<{ enabled: boolean; pending: boolean; recoveryCodesRemaining: number }>(statusEndpoint)
})
async function begin() {
  error.value = ''
  const endpoint: string = '/api/admin/security/2fa/begin'
  setup.value = await $fetch<{ secret: string; otpauth: string }>(endpoint, {
    method: 'POST',
    headers: csrf.value,
  })
  const current = setup.value
  if (!current) return
  qr.value = await QRCode.toDataURL(current.otpauth, { width: 220, margin: 1 })
}
async function confirm() {
  try {
    const endpoint: string = '/api/admin/security/2fa/confirm'
    const r = await $fetch<{ recoveryCodes: string[] }>(endpoint, {
      method: 'POST',
      headers: csrf.value,
      body: { code: code.value },
    })
    recovered.value = r.recoveryCodes
    setup.value = null
    security.value = await $fetch<{ enabled: boolean; pending: boolean; recoveryCodesRemaining: number }>(statusEndpoint)
  } catch (e) {
    error.value = (e as { data?: { message?: string } }).data?.message || '验证码无效'
  }
}
async function disable() {
  try {
    const endpoint: string = '/api/admin/security/2fa/disable'
    await $fetch(endpoint, {
      method: 'POST',
      headers: csrf.value,
      body: { password: password.value, code: disablingCode.value },
    })
    security.value = await $fetch<{ enabled: boolean; pending: boolean; recoveryCodesRemaining: number }>(statusEndpoint)
    password.value = ''
    disablingCode.value = ''
  } catch (e) {
    error.value = (e as { data?: { message?: string } }).data?.message || '无法关闭'
  }
}
async function revoke(id?: string, others = false) {
  await $fetch('/api/admin/security/sessions', {
    method: 'DELETE',
    headers: csrf.value,
    body: { id, others },
  })
  await refresh()
}
async function changePassword() {
  await $fetch('/api/admin/security/password', { method: 'PUT', headers: csrf.value, body: pw })
  pw.currentPassword = ''
  pw.newPassword = ''
  await refresh()
}
</script>
<template>
  <div class="max-w-4xl">
    <h1 class="text-3xl font-semibold">安全</h1>
    <p class="mt-2" style="color: var(--muted)">{{ me?.email }}</p>
    <section
      class="mt-8 rounded-xl border p-6"
      style="border-color: var(--border); background: var(--surface)"
    >
      <div class="flex items-center justify-between">
        <div>
          <h2 class="font-semibold">双重验证</h2>
          <p class="text-sm" style="color: var(--muted)">
            {{ security?.enabled ? '已启用 TOTP' : '使用验证器保护登录' }}
          </p>
        </div>
        <button
          v-if="!security?.enabled"
          class="rounded-lg px-4 py-2 text-white"
          style="background: var(--accent)"
          @click="begin"
        >
          配置验证器
        </button>
      </div>
      <div v-if="setup" class="mt-5 grid gap-4">
        <p>使用验证器扫描二维码，也可手动输入密钥：</p>
        <img :src="qr" alt="TOTP 配置二维码" width="220" height="220" /><code
          class="rounded bg-black/5 p-3 dark:bg-white/10"
          >{{ setup.secret }}</code
        ><label
          >输入验证器的 6 位代码<input
            v-model="code"
            inputmode="numeric"
            class="ml-3 rounded border bg-transparent p-2" /></label
        ><button
          class="justify-self-start rounded-lg px-4 py-2 text-white"
          style="background: var(--accent)"
          @click="confirm"
        >
          确认并启用
        </button>
      </div>
      <div v-if="recovered.length" class="mt-5 rounded-xl bg-amber-50 p-5 text-amber-950">
        <h3 class="font-semibold">请立即保存这些一次性恢复码</h3>
        <p class="text-sm">仅本次显示，数据库保存的是哈希。</p>
        <pre class="mt-3 grid grid-cols-2 gap-2">{{ recovered.join('\n') }}</pre>
        <button class="mt-3 underline" @click="recovered = []">已妥善保存</button>
      </div>
      <div v-if="security?.enabled" class="mt-5 flex flex-wrap gap-3">
        <input
          v-model="password"
          type="password"
          placeholder="确认密码"
          class="rounded border bg-transparent p-2"
        /><input
          v-model="disablingCode"
          inputmode="numeric"
          placeholder="当前 OTP"
          class="rounded border bg-transparent p-2"
        /><button class="rounded-lg border px-4 py-2" @click="disable">关闭双重验证</button
        ><span class="text-sm">剩余恢复码：{{ security.recoveryCodesRemaining }}</span>
      </div>
      <p v-if="error" class="text-red-600">{{ error }}</p>
    </section>
    <section
      class="mt-8 rounded-xl border p-6"
      style="border-color: var(--border); background: var(--surface)"
    >
      <div class="flex justify-between">
        <h2 class="font-semibold">登录设备</h2>
        <button class="text-sm underline" @click="revoke(undefined, true)">注销其他设备</button>
      </div>
      <div
        v-for="s in sessions || []"
        :key="s.id"
        class="mt-4 flex flex-wrap items-center justify-between gap-3 border-t pt-4"
        style="border-color: var(--border)"
      >
        <div>
          <strong
            >{{ s.browser }} · {{ s.os }} · {{ s.device }}
            <span v-if="s.current" style="color: var(--accent)">当前设备</span></strong
          >
          <p class="text-xs" style="color: var(--muted)">
            创建 {{ new Date(s.createdAt).toLocaleString() }} · 最近活动
            {{ new Date(s.lastSeenAt).toLocaleString() }} · {{ s.network }}
          </p>
        </div>
        <button v-if="!s.current" class="text-sm underline" @click="revoke(s.id)">注销</button>
      </div>
    </section>
    <section
      class="mt-8 rounded-xl border p-6"
      style="border-color: var(--border); background: var(--surface)"
    >
      <h2 class="font-semibold">修改密码</h2>
      <form class="mt-4 grid gap-3 sm:grid-cols-2" @submit.prevent="changePassword">
        <input
          v-model="pw.currentPassword"
          required
          type="password"
          placeholder="当前密码"
          class="rounded border bg-transparent p-2"
        /><input
          v-model="pw.newPassword"
          required
          minlength="12"
          type="password"
          placeholder="新密码（至少 12 位）"
          class="rounded border bg-transparent p-2"
        /><label class="text-sm"
          ><input v-model="pw.logoutOthers" type="checkbox" /> 修改后注销其他设备</label
        ><button
          class="justify-self-start rounded-lg px-4 py-2 text-white"
          style="background: var(--accent)"
        >
          更新密码
        </button>
      </form>
    </section>
  </div>
</template>
