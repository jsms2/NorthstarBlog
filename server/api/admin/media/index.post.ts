import { fileTypeFromBuffer } from 'file-type'
import { extname } from 'node:path'
import sharp from 'sharp'
import { db } from '../../../utils/db'
import { requireAdmin, requireCsrf } from '../../../utils/security'
import { safeExtension, storage } from '../../../utils/storage'
const allowed = new Set([
  'image/jpeg',
  'image/png',
  'image/gif',
  'image/webp',
  'image/avif',
  'application/pdf',
  'audio/mpeg',
  'video/mp4',
  'application/zip',
  'text/plain',
])
export default defineEventHandler(async (event) => {
  await requireAdmin(event)
  requireCsrf(event)
  const requestSize = Number(getHeader(event, 'content-length') || 0)
  if (requestSize > 26 * 1024 * 1024)
    throw createError({ statusCode: 413, statusMessage: '文件超过 25MB' })
  const parts = await readMultipartFormData(event)
  const part = parts?.find((p) => p.name === 'file' && p.filename)
  if (!part?.filename || !part.data)
    throw createError({ statusCode: 400, statusMessage: '请选择文件' })
  if (part.data.length > 25 * 1024 * 1024)
    throw createError({ statusCode: 413, statusMessage: '文件超过 25MB' })
  const filename = part.filename
  if (filename.length > 255 || /[\\/\0\r\n]/.test(filename) || /\.[^.]+\.[^.]+$/.test(filename))
    throw createError({ statusCode: 415, statusMessage: '文件名无效；不支持路径或双扩展名' })
  const detected = await fileTypeFromBuffer(part.data)
  const declared = (part.type || '').split(';')[0]!.trim().toLowerCase()
  const mime = detected?.mime || (declared === 'text/plain' ? declared : '')
  if (!allowed.has(mime)) throw createError({ statusCode: 415, statusMessage: '不支持的文件类型' })
  if (declared && declared !== 'application/octet-stream' && declared !== mime)
    throw createError({ statusCode: 415, statusMessage: '声明 MIME 与文件内容不匹配' })
  if (!detected && mime === 'text/plain') {
    const text = part.data.toString('utf8')
    if (
      part.data.includes(0) ||
      /^(?:\s*<!doctype\s+html|\s*<html|\s*<script|\s*<\?php|\s*#!|\s*(?:import\s|export\s|const\s|let\s|var\s|function\s))/i.test(
        text,
      )
    )
      throw createError({ statusCode: 415, statusMessage: '不支持 HTML、脚本或可执行文本' })
  }
  const extension = extname(filename).toLowerCase()
  const extensionMap: Record<string, string[]> = {
    'image/jpeg': ['.jpg', '.jpeg'],
    'image/png': ['.png'],
    'image/gif': ['.gif'],
    'image/webp': ['.webp'],
    'image/avif': ['.avif'],
    'application/pdf': ['.pdf'],
    'audio/mpeg': ['.mp3'],
    'video/mp4': ['.mp4'],
    'application/zip': ['.zip'],
    'text/plain': ['.txt'],
  }
  if (!extensionMap[mime]?.includes(extension))
    throw createError({ statusCode: 415, statusMessage: '扩展名与文件类型不匹配' })
  let data = part.data
  let width: number | undefined, height: number | undefined
  if (mime.startsWith('image/') && !['image/gif', 'image/svg+xml'].includes(mime)) {
    try {
      const img = sharp(data, { failOn: 'error' }).rotate()
      const meta = await img.metadata()
      width = meta.width
      height = meta.height
      data = await img.webp({ quality: 86 }).toBuffer()
    } catch {
      throw createError({ statusCode: 415, statusMessage: '图片已损坏或无法解码' })
    }
  }
  const ext =
    mime.startsWith('image/') && !['image/gif', 'image/svg+xml'].includes(mime)
      ? '.webp'
      : safeExtension(part.filename)
  const saved = await storage.put(
    data,
    ext,
    mime.startsWith('image/') && mime !== 'image/gif' ? 'image/webp' : mime,
  )
  try {
    return await db.media.create({
      data: {
        storageKey: saved.key,
        url: saved.url,
        filename,
        mimeType: mime,
        type: mime.startsWith('image/')
          ? 'IMAGE'
          : mime.startsWith('video/')
            ? 'VIDEO'
            : mime.startsWith('audio/')
              ? 'AUDIO'
              : mime === 'application/zip'
                ? 'ARCHIVE'
                : 'DOCUMENT',
        size: data.length,
        width,
        height,
      },
    })
  } catch (error) {
    await storage.delete(saved.key).catch(() => undefined)
    throw error
  }
})
