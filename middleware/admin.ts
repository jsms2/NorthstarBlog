export default defineNuxtRouteMiddleware(async (to) => {
  if (to.path === '/admin/login' || to.path === '/admin/setup') return
  try {
    await $fetch('/api/auth/me', {
      headers: import.meta.server ? useRequestHeaders(['cookie']) : undefined,
    })
  } catch {
    return navigateTo('/admin/login')
  }
})
