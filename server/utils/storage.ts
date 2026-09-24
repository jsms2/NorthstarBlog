import { mkdir, writeFile, unlink, access } from 'node:fs/promises'
import { resolve, join, extname } from 'node:path'
import { randomUUID } from 'node:crypto'
import {
  S3Client,
  PutObjectCommand,
  DeleteObjectCommand,
  HeadObjectCommand,
} from '@aws-sdk/client-s3'
export interface StorageAdapter {
  put(data: Buffer, extension: string, contentType?: string): Promise<{ key: string; url: string }>
  delete(key: string): Promise<void>
  exists(key: string): Promise<boolean>
  getPublicUrl(key: string): string
}
class LocalStorage implements StorageAdapter {
  root = resolve(process.env.UPLOAD_DIR || 'data/uploads')
  async put(data: Buffer, extension: string, _contentType?: string) {
    const day = new Date().toISOString().slice(0, 7)
    const dir = join(this.root, day)
    await mkdir(dir, { recursive: true })
    const name = `${randomUUID()}${extension.toLowerCase()}`
    await writeFile(join(dir, name), data, { flag: 'wx' })
    const key = `${day}/${name}`
    return { key, url: this.getPublicUrl(key) }
  }
  async delete(key: string) {
    const target = resolve(this.root, key)
    if (!target.startsWith(`${this.root}${process.platform === 'win32' ? '\\' : '/'}`))
      throw new Error('Invalid storage key')
    await unlink(target)
  }
  async exists(key: string) {
    try {
      await access(resolve(this.root, key))
      return true
    } catch {
      return false
    }
  }
  getPublicUrl(key: string) {
    return `/api/uploads/${key.replaceAll('\\', '/')}`
  }
}
class S3Storage implements StorageAdapter {
  private readonly bucket = process.env.S3_BUCKET!
  private readonly client = new S3Client({
    endpoint: process.env.S3_ENDPOINT || undefined,
    region: process.env.S3_REGION || 'auto',
    forcePathStyle: process.env.S3_PATH_STYLE === 'true',
    credentials:
      process.env.S3_ACCESS_KEY && process.env.S3_SECRET_KEY
        ? { accessKeyId: process.env.S3_ACCESS_KEY, secretAccessKey: process.env.S3_SECRET_KEY }
        : undefined,
  })
  async put(data: Buffer, extension: string, contentType?: string) {
    const key = `${new Date().toISOString().slice(0, 7)}/${randomUUID()}${extension.toLowerCase()}`
    await this.client.send(
      new PutObjectCommand({
        Bucket: this.bucket,
        Key: key,
        Body: data,
        ContentType: contentType,
        CacheControl: 'public, max-age=31536000, immutable',
      }),
    )
    return { key, url: this.getPublicUrl(key) }
  }
  async delete(key: string) {
    await this.client.send(
      new DeleteObjectCommand({ Bucket: this.bucket, Key: this.validate(key) }),
    )
  }
  async exists(key: string) {
    try {
      await this.client.send(
        new HeadObjectCommand({ Bucket: this.bucket, Key: this.validate(key) }),
      )
      return true
    } catch (error) {
      if ((error as { $metadata?: { httpStatusCode?: number } }).$metadata?.httpStatusCode === 404)
        return false
      throw error
    }
  }
  getPublicUrl(key: string) {
    const base = process.env.S3_PUBLIC_URL
    if (!base) throw new Error('S3_PUBLIC_URL is required when STORAGE_DRIVER=s3')
    return `${base.replace(/\/$/, '')}/${this.validate(key).split('/').map(encodeURIComponent).join('/')}`
  }
  private validate(key: string) {
    if (!key || key.startsWith('/') || key.includes('..') || key.includes('\\'))
      throw new Error('Invalid storage key')
    return key
  }
}
export const storage: StorageAdapter =
  process.env.STORAGE_DRIVER === 's3' && process.env.S3_BUCKET
    ? new S3Storage()
    : new LocalStorage()
export const safeExtension = (name: string) =>
  extname(name)
    .replace(/[^.a-zA-Z0-9]/g, '')
    .slice(0, 10)
