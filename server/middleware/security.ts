import { setHeader } from 'h3'
export default defineEventHandler((event) => {
  setResponseHeaders(event, {
    'X-Content-Type-Options': 'nosniff',
    'X-Frame-Options': 'DENY',
    'Referrer-Policy': 'strict-origin-when-cross-origin',
    'Permissions-Policy': 'camera=(), microphone=(), geolocation=()',
    'Content-Security-Policy':
      "default-src 'self'; img-src 'self' data: https:; style-src 'self' 'unsafe-inline'; script-src 'self' 'unsafe-inline'; frame-src https://www.youtube.com https://player.bilibili.com; connect-src 'self'",
  })
  if (event.path.startsWith('/admin') || event.path.startsWith('/api/admin'))
    setHeader(event, 'Cache-Control', 'private, no-store')
})
