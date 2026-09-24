import { createRequire } from 'node:module'
import { createWriteStream } from 'node:fs'
import { mkdir } from 'node:fs/promises'
import { join, resolve } from 'node:path'
import type { Archiver, ArchiverOptions } from 'archiver'

const { ZipArchive } = createRequire(import.meta.url)('archiver') as {
  ZipArchive: new (options?: ArchiverOptions) => Archiver
}
const dir = resolve(process.env.BACKUP_DIR || 'data/backups')
await mkdir(dir, { recursive: true })
const stamp = new Date().toISOString().replace(/[:T]/g, '-').slice(0, 16)
const target = join(dir, `site-${stamp}.zip`)
const output = createWriteStream(target, { flags: 'wx' })
const zip = new ZipArchive({ zlib: { level: 9 } })
const completed = new Promise<void>((resolveDone, reject) => {
  output.once('close', resolveDone)
  output.once('error', reject)
  zip.once('error', reject)
})
zip.pipe(output)
zip.directory(resolve(process.env.UPLOAD_DIR || 'data/uploads'), 'uploads')
zip.file('.env.example', { name: 'environment-reference.txt' })
await zip.finalize()
await completed
console.log(target)
