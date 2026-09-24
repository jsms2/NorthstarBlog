import { createReadStream } from 'node:fs'
import { stat } from 'node:fs/promises'
import { extname, relative, resolve, sep } from 'node:path'

export default defineEventHandler(async (event) => {
  const root = resolve(process.env.UPLOAD_DIR || 'data/uploads')
  const folder = getRouterParam(event, 'folder') || ''
  const filename = getRouterParam(event, 'filename') || ''
  if (!/^[0-9]{4}-[0-9]{2}$/.test(folder) || !/^[a-zA-Z0-9-]+\.[a-zA-Z0-9]{1,10}$/.test(filename))
    throw createError({ statusCode: 404 })
  const target = resolve(root, folder, filename)
  const rel = relative(root, target)
  if (rel.startsWith(`..${sep}`) || rel === '..' || resolve(target) === root)
    throw createError({ statusCode: 403 })
  let info
  try {
    info = await stat(target)
  } catch {
    throw createError({ statusCode: 404 })
  }
  if (!info.isFile()) throw createError({ statusCode: 404 })
  const contentTypes: Record<string, string> = {
    '.webp': 'image/webp', '.jpg': 'image/jpeg', '.jpeg': 'image/jpeg', '.png': 'image/png',
    '.gif': 'image/gif', '.avif': 'image/avif', '.pdf': 'application/pdf', '.mp3': 'audio/mpeg',
    '.mp4': 'video/mp4', '.zip': 'application/zip', '.txt': 'text/plain; charset=utf-8',
  }
  setHeader(event, 'Content-Length', info.size)
  setHeader(event, 'Content-Type', contentTypes[extname(target).toLowerCase()] || 'application/octet-stream')
  setHeader(event, 'X-Content-Type-Options', 'nosniff')
  setHeader(event, 'Cache-Control', 'public, max-age=31536000, immutable')
  return sendStream(event, createReadStream(target))
})
