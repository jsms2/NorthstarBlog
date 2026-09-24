export default defineNuxtConfig({
  compatibilityDate: '2026-07-15',
  devtools: { enabled: false },
  modules: ['@nuxt/eslint', '@nuxtjs/tailwindcss'],
  css: ['~/assets/css/main.css'],
  runtimeConfig: {
    sessionSecret: process.env.SESSION_SECRET,
    encryptionSecret: process.env.ENCRYPTION_SECRET,
    public: { siteUrl: process.env.SITE_URL || 'http://localhost:3000' }
  },
  app: {
    head: {
      htmlAttrs: { lang: 'zh-CN' },
      meta: [
        { name: 'viewport', content: 'width=device-width, initial-scale=1' },
        { name: 'theme-color', content: '#111827' }
      ],
      link: [{ rel: 'manifest', href: '/manifest.webmanifest' }]
    }
  },
  nitro: { compressPublicAssets: true },
  typescript: { strict: true, typeCheck: true }
})
