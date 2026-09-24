import { z } from 'zod'
import { db } from './db'

export const appearanceSchema = z.object({
  siteName: z.string().trim().min(1).max(100),
  subtitle: z.string().max(200),
  logoUrl: z.union([z.url().max(1000), z.literal('')]),
  faviconUrl: z.union([z.url().max(1000), z.literal('')]),
  accentColor: z.string().regex(/^#[0-9a-fA-F]{6}$/),
  bodyFont: z.enum(['sans', 'serif']),
  headingFont: z.enum(['sans', 'serif']),
  monoFont: z.enum(['mono', 'sans']),
  contentWidth: z.number().int().min(800).max(1600),
  articleWidth: z.number().int().min(560).max(1100),
  radius: z.number().int().min(0).max(32),
  homeLayout: z.enum(['grid', 'list']),
  articleLayout: z.enum(['standard', 'wide']),
  showToc: z.boolean(),
  readingProgress: z.boolean(),
  showShare: z.boolean(),
  showRelated: z.boolean(),
})

export const appearanceDefaults: z.infer<typeof appearanceSchema> = {
  siteName: 'Northstar', subtitle: '', logoUrl: '', faviconUrl: '', accentColor: '#d75a32',
  bodyFont: 'sans', headingFont: 'sans', monoFont: 'mono', contentWidth: 1120,
  articleWidth: 760, radius: 14, homeLayout: 'grid', articleLayout: 'standard',
  showToc: true, readingProgress: true, showShare: true, showRelated: true,
}

export async function readAppearance() {
  const rows = await db.setting.findMany({ where: { key: { in: Object.keys(appearanceDefaults) } } })
  const stored = Object.fromEntries(rows.map(row => [row.key, row.value]))
  return appearanceSchema.parse({ ...appearanceDefaults, ...stored })
}
