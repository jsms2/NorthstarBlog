import { expect, test, type APIRequestContext } from '@playwright/test'
import { e2eAdminPassword } from './support/credentials'
import sharp from 'sharp'
import { existsSync } from 'node:fs'
import { mkdir, rm, writeFile } from 'node:fs/promises'
import { resolve } from 'node:path'
import { inflateRawSync } from 'node:zlib'
import { db } from '../../server/utils/db'

const base = 'http://127.0.0.1:3000'

async function login(request: APIRequestContext) {
  const response = await request.post(`${base}/api/auth/login`, {
    data: { login: 'admin@example.com', password: e2eAdminPassword() },
    headers: { 'x-forwarded-for': `198.51.100.${Math.floor(Math.random() * 200) + 1}` },
  })
  expect(response.ok()).toBeTruthy()
  const body = await response.json()
  const session = response.headers()['set-cookie']?.match(/northstar_session=([^;]+)/)?.[1]
  expect(session).toBeTruthy()
  const cookie = `northstar_session=${session}; northstar_csrf=${body.csrf}`
  return {
    headers: { Cookie: cookie, 'x-csrf-token': body.csrf as string, Origin: base },
  }
}

test('admin export returns portable JSON and a Markdown ZIP without credential settings', async ({ request }) => {
  const auth = await login(request)
  const jsonResponse = await request.get(`${base}/api/admin/export`, { headers: auth.headers })
  expect(jsonResponse.ok()).toBeTruthy()
  const data = await jsonResponse.json()
  expect(data).toMatchObject({ formatVersion: 1 })
  expect(data.data.posts.length).toBeGreaterThan(0)
  expect(JSON.stringify(data)).not.toMatch(/passwordHash|tokenHash|secretKey|ENCRYPTION_SECRET/i)

  const markdown = await request.get(`${base}/api/admin/export?format=markdown`, {
    headers: auth.headers,
  })
  expect(markdown.ok(), `${markdown.status()} ${await markdown.text()}`).toBeTruthy()
  expect((await markdown.body()).subarray(0, 2)).toEqual(Buffer.from('PK'))
})

test('Markdown and versioned JSON imports validate formats and create drafts with migrated slugs', async ({ request }) => {
  const auth = await login(request)
  const slug = `e2e-import-${Date.now()}`
  const jsonSlug = `${slug}-json`
  try {
    const response = await request.post(`${base}/api/admin/import`, {
      headers: auth.headers,
      data: {
        format: 'markdown',
        files: [
          {
            filename: `${slug}.md`,
            content: `---\ntitle: Imported E2E\nslug: ${slug}\nstatus: DRAFT\ntags: []\n---\n\nImported body.`,
          },
        ],
      },
    })
    expect(response.ok(), `${response.status()} ${await response.text()}`).toBeTruthy()
    expect(await response.json()).toMatchObject({ ok: true, imported: { posts: 1 } })
    expect(await db.post.findUnique({ where: { slug }, select: { status: true } })).toEqual({ status: 'DRAFT' })
    const jsonImport = await request.post(`${base}/api/admin/import`, {
      headers: auth.headers,
      data: {
        formatVersion: 1,
        data: { posts: [{ title: 'Imported JSON E2E', slug: jsonSlug, markdown: 'JSON body', status: 'DRAFT' }] },
      },
    })
    expect(jsonImport.ok(), `${jsonImport.status()} ${await jsonImport.text()}`).toBeTruthy()
    expect(await jsonImport.json()).toMatchObject({ ok: true, imported: { posts: 1 } })
    expect(await db.post.findUnique({ where: { slug: jsonSlug }, select: { status: true } })).toEqual({ status: 'DRAFT' })
  } finally {
    await db.post.deleteMany({ where: { slug: { in: [slug, jsonSlug] } } })
  }
})

test('backup manager creates, lists, inspects, downloads, and deletes a real database and uploads archive', async ({ request }) => {
  const auth = await login(request)
  const uploadRoot = resolve(process.env.UPLOAD_DIR || 'data/uploads')
  const month = new Date().toISOString().slice(0, 7)
  const marker = `backup-e2e-${Date.now()}.txt`
  const markerPath = resolve(uploadRoot, month, marker)
  await mkdir(resolve(uploadRoot, month), { recursive: true })
  await writeFile(markerPath, 'backup upload verification', { flag: 'wx' })
  let backup: { id: string; filename: string; size: number | string } | undefined
  try {
    const created = await request.post(`${base}/api/admin/backups`, {
      headers: auth.headers,
      data: {},
    })
    expect(created.ok(), `${created.status()} ${await created.text()}`).toBeTruthy()
    const backupInfo = (await created.json()) as { id: string; filename: string; size: number | string }
    backup = backupInfo
    expect(Number(backupInfo.size)).toBeGreaterThan(0)
    const listed = await request.get(`${base}/api/admin/backups`, { headers: auth.headers })
    expect((await listed.json()).some((row: { id: string }) => row.id === backupInfo.id)).toBeTruthy()
    const download = await request.get(`${base}/api/admin/backups/${backupInfo.id}`, {
      headers: auth.headers,
    })
    expect(download.ok()).toBeTruthy()
    const bytes = await download.body()
    expect(bytes.subarray(0, 2)).toEqual(Buffer.from('PK'))
    const directoryEnd = bytes.lastIndexOf(Buffer.from([0x50, 0x4b, 0x05, 0x06]))
    expect(directoryEnd).toBeGreaterThan(0)
    const entryCount = bytes.readUInt16LE(directoryEnd + 10)
    let offset = bytes.readUInt32LE(directoryEnd + 16)
    const entries = new Map<string, Buffer>()
    for (let i = 0; i < entryCount; i++) {
      expect(bytes.readUInt32LE(offset)).toBe(0x02014b50)
      const method = bytes.readUInt16LE(offset + 10)
      const compressedSize = bytes.readUInt32LE(offset + 20)
      const nameSize = bytes.readUInt16LE(offset + 28)
      const extraSize = bytes.readUInt16LE(offset + 30)
      const commentSize = bytes.readUInt16LE(offset + 32)
      const localOffset = bytes.readUInt32LE(offset + 42)
      const entryName = bytes.subarray(offset + 46, offset + 46 + nameSize).toString('utf8')
      const localNameSize = bytes.readUInt16LE(localOffset + 26)
      const localExtraSize = bytes.readUInt16LE(localOffset + 28)
      const dataStart = localOffset + 30 + localNameSize + localExtraSize
      const compressed = bytes.subarray(dataStart, dataStart + compressedSize)
      entries.set(entryName, method === 8 ? inflateRawSync(compressed) : Buffer.from(compressed))
      offset += 46 + nameSize + extraSize + commentSize
    }
    expect(entries.has('database.sql')).toBeTruthy()
    expect(entries.get('database.sql')!.toString('utf8')).toContain('CREATE TABLE')
    expect(entries.has('metadata.json')).toBeTruthy()
    expect(entries.has('site-export-reference.json')).toBeTruthy()
    expect([...entries.keys()].some((name) => name.endsWith(marker))).toBeTruthy()
    expect(JSON.parse(entries.get('metadata.json')!.toString('utf8'))).toMatchObject({
      formatVersion: 1,
      uploadsIncluded: true,
    })
  } finally {
    if (backup) {
      const removed = await request.delete(`${base}/api/admin/backups/${backup.id}`, {
        headers: auth.headers,
      })
      expect(removed.ok()).toBeTruthy()
      expect(
        existsSync(resolve(process.env.BACKUP_DIR || 'data/backups', backup.filename)),
      ).toBeFalsy()
    }
    await rm(markerPath, { force: true })
  }
})

test('media upload rejects spoofed types and path-like filenames, then allows safe removal', async ({ request }) => {
  const auth = await login(request)
  const dangerous = [
    { name: 'fake.jpg', mimeType: 'image/jpeg', buffer: Buffer.from('<html>not an image</html>') },
    { name: 'evil.jpg.php', mimeType: 'image/jpeg', buffer: Buffer.from('<?php echo 1;') },
    { name: 'evil.png.exe', mimeType: 'image/png', buffer: Buffer.from('MZ executable') },
    { name: 'test.html', mimeType: 'text/plain', buffer: Buffer.from('<!doctype html><script>alert(1)</script>') },
    { name: 'test.js', mimeType: 'text/plain', buffer: Buffer.from('const x = 1') },
    { name: 'test.php', mimeType: 'text/plain', buffer: Buffer.from('<?php echo 1;') },
    { name: 'test.sh', mimeType: 'text/plain', buffer: Buffer.from('#!/bin/sh\necho unsafe') },
    { name: 'test.bat', mimeType: 'text/plain', buffer: Buffer.from('@echo off') },
    { name: 'test.exe', mimeType: 'application/octet-stream', buffer: Buffer.from('MZ executable') },
    { name: 'broken.jpg', mimeType: 'image/jpeg', buffer: Buffer.from('not a JPEG') },
    { name: 'empty.png', mimeType: 'image/png', buffer: Buffer.alloc(0) },
    { name: '../evil.jpg', mimeType: 'image/jpeg', buffer: Buffer.from('path') },
    { name: '..\\evil.jpg', mimeType: 'image/jpeg', buffer: Buffer.from('path') },
    { name: '../../app.vue', mimeType: 'text/plain', buffer: Buffer.from('source') },
    { name: '%2e%2e%2f.png', mimeType: 'image/png', buffer: Buffer.from('encoded path') },
  ]
  for (const file of dangerous) {
    const response = await request.post(`${base}/api/admin/media`, { headers: auth.headers, multipart: { file } })
    expect([400, 415]).toContain(response.status())
  }
  const svg = await request.post(`${base}/api/admin/media`, {
    headers: auth.headers,
    multipart: { file: { name: 'vector.svg', mimeType: 'image/svg+xml', buffer: Buffer.from('<svg xmlns="http://www.w3.org/2000/svg"/>') } },
  })
  expect(svg.status()).toBe(415)

  const png = await sharp({ create: { width: 1, height: 1, channels: 4, background: '#f00' } }).png().toBuffer()
  const uploaded = await request.post(`${base}/api/admin/media`, {
    headers: auth.headers,
    multipart: { file: { name: `safe-${Date.now()}.png`, mimeType: 'image/png', buffer: png } },
  })
  expect(uploaded.ok(), `${uploaded.status()} ${await uploaded.text()}`).toBeTruthy()
  const media = await uploaded.json()
  try {
    expect(media.mimeType).toBe('image/png')
    expect(media.url).toMatch(/\.webp(?:\?|$)/)
    const object = await request.get(new URL(media.url, base).href)
    expect(object.status(), `${media.url} - ${object.status()} ${await object.text()} - local=${existsSync(resolve('data/uploads', ...media.url.split('/').slice(-2)))}`).toBe(200)
    expect(object.headers()['content-type']).toContain('image/webp')
    expect(object.headers()['x-content-type-options']).toBe('nosniff')
  } finally {
    expect((await request.delete(`${base}/api/admin/media/${media.id}`, { headers: auth.headers })).ok()).toBeTruthy()
  }
  expect((await request.get(new URL(media.url, base).href)).status()).toBe(404)
})
