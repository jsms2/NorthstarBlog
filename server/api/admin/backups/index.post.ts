import { spawn } from 'node:child_process'
import { createWriteStream, existsSync } from 'node:fs'
import { mkdir, rm, stat } from 'node:fs/promises'
import { randomUUID } from 'node:crypto'
import { createRequire } from 'node:module'
import { basename, isAbsolute, relative, resolve, sep } from 'node:path'
import type { Archiver, ArchiverOptions } from 'archiver'
import { db } from '../../../utils/db'
import { requireAdmin, requireCsrf } from '../../../utils/security'

const { ZipArchive } = createRequire(import.meta.url)('archiver') as {
  ZipArchive: new (options?: ArchiverOptions) => Archiver
}
const inside = (root: string, target: string) => {
  const rel = relative(root, target)
  return rel === '' || (!rel.startsWith(`..${sep}`) && rel !== '..' && !isAbsolute(rel))
}
function dumpDatabase(): Promise<Buffer> {
  const url = new URL(process.env.DATABASE_URL || '')
  if (!url.hostname || !url.pathname.slice(1))
    throw createError({ statusCode: 503, statusMessage: 'DATABASE_URL 配置无效' })
  const binary =
    process.env.MYSQLDUMP_PATH || (process.platform === 'win32' ? 'mysqldump.exe' : 'mysqldump')
  return new Promise((resolveDump, reject) => {
    let child
    try {
      child = spawn(
        binary,
        [
          '--single-transaction',
          '--skip-lock-tables',
          '--no-tablespaces',
          '--hex-blob',
          '-h',
          url.hostname,
          '-P',
          url.port || '3306',
          '-u',
          decodeURIComponent(url.username),
          decodeURIComponent(url.pathname.slice(1)),
        ],
        {
          env: { ...process.env, MYSQL_PWD: decodeURIComponent(url.password) },
          stdio: ['ignore', 'pipe', 'ignore'],
          windowsHide: true,
        },
      )
    } catch {
      reject(
        createError({
          statusCode: 503,
          statusMessage: '无法启动 mysqldump；请在 PATH 中安装 MySQL client tools',
        }),
      )
      return
    }
    const chunks: Buffer[] = []
    child.stdout.on('data', (chunk: Buffer) => chunks.push(chunk))
    child.once('error', (error: NodeJS.ErrnoException) =>
      reject(
        createError({
          statusCode: 503,
          statusMessage:
            error.code === 'ENOENT'
              ? '未找到 mysqldump；请在 PATH 中安装 MySQL client tools'
              : '启动 mysqldump 失败',
        }),
      ),
    )
    child.once('close', (code) =>
      code === 0
        ? resolveDump(Buffer.concat(chunks))
        : reject(
            createError({
              statusCode: 500,
              statusMessage: 'MySQL 备份失败；请检查数据库权限和 mysqldump 兼容性',
            }),
          ),
    )
  })
}

export default defineEventHandler(async (event) => {
  await requireAdmin(event)
  requireCsrf(event)
  const configuredDir = process.env.BACKUP_DIR || 'data/backups'
  const backupDir = resolve(configuredDir)
  const publicDir = resolve('.output/public')
  if (inside(publicDir, backupDir))
    throw createError({ statusCode: 500, statusMessage: '备份目录不能位于 Public 目录' })
  const uploadsDir = resolve(process.env.UPLOAD_DIR || 'data/uploads')
  const dump = await dumpDatabase()
  await mkdir(backupDir, { recursive: true })
  const stamp = new Date()
    .toISOString()
    .replace(/[-:TZ.]/g, '')
    .slice(0, 14)
  const filename = `backup-${stamp}-${randomUUID().slice(0, 8)}.zip`
  if (basename(filename) !== filename)
    throw createError({ statusCode: 500, statusMessage: '备份文件名无效' })
  const filepath = resolve(backupDir, filename)
  if (!inside(backupDir, filepath))
    throw createError({ statusCode: 400, statusMessage: '备份路径无效' })
  const output = createWriteStream(filepath, { flags: 'wx' })
  const zip = new ZipArchive({ zlib: { level: 6 } })
  const completion = new Promise<void>((resolveDone, reject) => {
    output.once('close', resolveDone)
    output.once('error', reject)
    zip.once('error', reject)
  })
  zip.pipe(output)
  zip.append(dump, { name: 'database.sql' })
  zip.append(
    JSON.stringify(
      {
        formatVersion: 1,
        createdAt: new Date().toISOString(),
        database: new URL(process.env.DATABASE_URL!).pathname.slice(1),
        uploadsIncluded: process.env.STORAGE_DRIVER !== 's3',
      },
      null,
      2,
    ),
    { name: 'metadata.json' },
  )
  if (process.env.STORAGE_DRIVER !== 's3')
    if (existsSync(uploadsDir)) zip.directory(uploadsDir, 'uploads', { date: new Date(0) })
  zip.append(
    JSON.stringify({
      formatVersion: 1,
      exportedAt: new Date().toISOString(),
      note: 'Restore site data via Admin → Import / Export',
    }),
    { name: 'site-export-reference.json' },
  )
  try {
    await zip.finalize()
    await completion
    const size = (await stat(filepath)).size
    const row = await db.backup.create({ data: { filename, size: BigInt(size), status: 'READY' } })
    return { id: row.id, filename: row.filename, size: row.size.toString(), createdAt: row.createdAt }
  } catch (error) {
    await rm(filepath, { force: true })
    throw error
  }
})
