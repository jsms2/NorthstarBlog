import { db } from './db'

export function normalizeRedirectPath(value: string) {
  if (!value.startsWith('/') || value.startsWith('//') || /[\\?#%]/.test(value) ||
    [...value].some(character => character.charCodeAt(0) < 32) ||
    value.split('/').some(segment => segment === '.' || segment === '..')) return null
  return value.length > 1 ? value.replace(/\/+$/, '') : '/'
}

export function normalizeRedirectDestination(value: string) {
  if (value.startsWith('/')) return normalizeRedirectPath(value)
  try {
    const url = new URL(value)
    return url.protocol === 'https:' && !url.username && !url.password ? url.toString() : null
  } catch { return null }
}

export async function validateRedirect(source: string, destination: string, excludeId?: string) {
  const normalizedSource = normalizeRedirectPath(source)
  const normalizedDestination = normalizeRedirectDestination(destination)
  if (!normalizedSource || !normalizedDestination || normalizedSource === normalizedDestination) return null
  const duplicate = await db.redirect.findUnique({ where: { source: normalizedSource }, select: { id: true } })
  if (duplicate && duplicate.id !== excludeId) return null
  const visited = new Set([normalizedSource])
  let target = normalizedDestination
  for (let depth = 0; depth < 32 && target.startsWith('/'); depth++) {
    if (visited.has(target)) return null
    visited.add(target)
    const next = await db.redirect.findUnique({ where: { source: target }, select: { id: true, destination: true, enabled: true } })
    if (!next || next.id === excludeId || !next.enabled) return { source: normalizedSource, destination: normalizedDestination }
    target = next.destination
  }
  return target.startsWith('/') ? null : { source: normalizedSource, destination: normalizedDestination }
}
