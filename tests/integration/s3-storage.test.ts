import { createServer } from 'node:http'
import { afterAll, describe, expect, it } from 'vitest'

const environmentKeys = ['STORAGE_DRIVER', 'S3_BUCKET', 'S3_ENDPOINT', 'S3_PUBLIC_URL', 'S3_REGION', 'S3_ACCESS_KEY', 'S3_SECRET_KEY', 'S3_PATH_STYLE'] as const
const previous = Object.fromEntries(environmentKeys.map(key => [key, process.env[key]]))

afterAll(() => {
  for (const key of environmentKeys) {
    if (previous[key] === undefined) Reflect.deleteProperty(process.env, key)
    else process.env[key] = previous[key]
  }
})

describe('S3-compatible storage protocol', () => {
  it('puts, checks and deletes objects with safe keys and public URLs', async () => {
    const objects = new Map<string, { data: Buffer; contentType: string }>()
    const server = createServer((request, response) => {
      const path = new URL(request.url || '/', 'http://127.0.0.1').pathname
      if (!path.startsWith('/e2e-bucket/')) { response.writeHead(404).end(); return }
      if (request.method === 'PUT') {
        const chunks: Buffer[] = []
        request.on('data', chunk => chunks.push(Buffer.from(chunk)))
        request.on('end', () => {
          objects.set(path, { data: Buffer.concat(chunks), contentType: String(request.headers['content-type'] || '') })
          response.writeHead(200, { ETag: '"e2e"' }).end()
        })
      } else if (request.method === 'HEAD') {
        response.writeHead(objects.has(path) ? 200 : 404).end()
      } else if (request.method === 'DELETE') {
        objects.delete(path)
        response.writeHead(204).end()
      } else response.writeHead(405).end()
    })
    await new Promise<void>(resolve => server.listen(0, '127.0.0.1', resolve))
    const address = server.address()
    if (!address || typeof address === 'string') throw new Error('Mock S3 listener unavailable')
    Object.assign(process.env, { STORAGE_DRIVER: 's3', S3_BUCKET: 'e2e-bucket',
      S3_ENDPOINT: `http://127.0.0.1:${address.port}`, S3_PUBLIC_URL: 'https://cdn.example.com/blog',
      S3_REGION: 'us-east-1', S3_ACCESS_KEY: 'test', S3_SECRET_KEY: 'test', S3_PATH_STYLE: 'true' })
    try {
      const { storage } = await import('../../server/utils/storage')
      const payload = Buffer.from('S3 protocol verification')
      const result = await storage.put(payload, '.txt', 'text/plain')
      expect(result.key).toMatch(/^\d{4}-\d{2}\/[a-f0-9-]+\.txt$/)
      expect(result.url).toBe(`https://cdn.example.com/blog/${result.key}`)
      expect(objects.get(`/e2e-bucket/${result.key}`)).toEqual({ data: payload, contentType: 'text/plain' })
      expect(await storage.exists(result.key)).toBe(true)
      expect(await storage.exists('missing.txt')).toBe(false)
      expect(() => storage.getPublicUrl('../escape.txt')).toThrow('Invalid storage key')
      await storage.delete(result.key)
      expect(await storage.exists(result.key)).toBe(false)
    } finally {
      await new Promise<void>((resolve, reject) => server.close(error => error ? reject(error) : resolve()))
    }
  })
})
