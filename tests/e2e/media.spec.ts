import { expect, test, type APIRequestContext } from '@playwright/test'
import { e2eAdminPassword } from './support/credentials'
import sharp from 'sharp'
import { existsSync } from 'node:fs'
import { relative, resolve, sep } from 'node:path'

const base = 'http://127.0.0.1:3000'

async function adminHeaders(request: APIRequestContext) {
  const response = await request.post(`${base}/api/auth/login`, {
    data: { login: 'admin@example.com', password: e2eAdminPassword() },
    headers: { 'x-forwarded-for': `198.51.100.${Math.floor(Math.random() * 200) + 1}` },
  })
  expect(response.ok(), await response.text()).toBeTruthy()
  const body = await response.json()
  const session = response.headers()['set-cookie']?.match(/northstar_session=([^;]+)/)?.[1]
  return { Cookie: `northstar_session=${session}; northstar_csrf=${body.csrf}`, 'x-csrf-token': body.csrf as string, Origin: base }
}

test('JPEG, PNG, WebP, GIF and PDF stay inside uploads and are served with safe headers', async ({ request }) => {
  const headers = await adminHeaders(request)
  const image = sharp({ create: { width: 2, height: 2, channels: 4, background: '#369' } })
  const files = [
    { name: 'photo.jpg', mimeType: 'image/jpeg', buffer: await image.clone().jpeg().toBuffer(), served: 'image/webp' },
    { name: 'photo.png', mimeType: 'image/png', buffer: await image.clone().png().toBuffer(), served: 'image/webp' },
    { name: 'photo.webp', mimeType: 'image/webp', buffer: await image.clone().webp().toBuffer(), served: 'image/webp' },
    { name: 'photo.gif', mimeType: 'image/gif', buffer: await image.clone().gif().toBuffer(), served: 'image/gif' },
    { name: 'document.pdf', mimeType: 'application/pdf', buffer: Buffer.from('%PDF-1.4\n1 0 obj\n<<>>\nendobj\n%%EOF'), served: 'application/pdf' },
  ]
  const uploaded: Array<{ id: string; storageKey: string; url: string }> = []
  const root = resolve(process.env.UPLOAD_DIR || 'data/uploads')
  try {
    for (const file of files) {
      const response = await request.post(`${base}/api/admin/media`, { headers, multipart: { file } })
      expect(response.ok(), `${file.name}: ${response.status()} ${await response.text()}`).toBeTruthy()
      const media = await response.json() as { id: string; storageKey: string; url: string; mimeType: string }
      uploaded.push(media)
      expect(media.mimeType).toBe(file.mimeType)
      const target = resolve(root, media.storageKey)
      const pathFromRoot = relative(root, target)
      expect(pathFromRoot.startsWith(`..${sep}`) || pathFromRoot === '..').toBeFalsy()
      expect(existsSync(target)).toBeTruthy()
      const served = await request.get(new URL(media.url, base).href)
      expect(served.status()).toBe(200)
      expect(served.headers()['content-type']).toContain(file.served)
      expect(served.headers()['x-content-type-options']).toBe('nosniff')
    }
  } finally {
    for (const media of uploaded) {
      const removed = await request.delete(`${base}/api/admin/media/${media.id}`, { headers })
      expect(removed.ok()).toBeTruthy()
      expect(existsSync(resolve(root, media.storageKey))).toBeFalsy()
    }
  }
})

test('oversized, empty, damaged and mismatched uploads are rejected without server errors', async ({ request }) => {
  test.setTimeout(60_000)
  const headers = await adminHeaders(request)
  const validJpeg = await sharp({ create: { width: 4, height: 4, channels: 3, background: '#f00' } }).jpeg().toBuffer()
  const cases = [
    { name: 'empty.jpg', mimeType: 'image/jpeg', buffer: Buffer.alloc(0) },
    { name: 'broken.jpg', mimeType: 'image/jpeg', buffer: validJpeg.subarray(0, 12) },
    { name: 'spoof.jpg', mimeType: 'image/jpeg', buffer: Buffer.from('<script>alert(1)</script>') },
    { name: 'wrong.png', mimeType: 'image/png', buffer: validJpeg },
    { name: 'evil.webp.js', mimeType: 'image/webp', buffer: Buffer.from('const unsafe = true') },
    { name: 'evil.cmd', mimeType: 'text/plain', buffer: Buffer.from('@echo off') },
    { name: 'evil.ps1', mimeType: 'text/plain', buffer: Buffer.from('Write-Host unsafe') },
  ]
  for (const file of cases) {
    const response = await request.post(`${base}/api/admin/media`, { headers, multipart: { file } })
    expect([400, 415], `${file.name}: ${response.status()} ${await response.text()}`).toContain(response.status())
  }
  const oversized = await request.post(`${base}/api/admin/media`, {
    headers,
    multipart: { file: { name: 'large.jpg', mimeType: 'image/jpeg', buffer: Buffer.alloc(26 * 1024 * 1024 + 1) } },
  })
  expect(oversized.status()).toBe(413)
})
