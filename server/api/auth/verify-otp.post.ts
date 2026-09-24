import { z } from 'zod'
import * as OTPAuth from 'otpauth'
import { db } from '../../utils/db'
import { createSession, hash, rateLimit, decryptSecret } from '../../utils/security'
const schema = z.object({ code: z.string().trim().min(6).max(32) })
export default defineEventHandler(async (event) => {
  rateLimit(event, 'otp-login', 8, 10 * 60_000)
  const token = getCookie(event, 'northstar_2fa')
  if (!token) throw createError({ statusCode: 401, statusMessage: '验证已过期，请重新登录' })
  const challenge = await db.authChallenge.findUnique({
    where: { tokenHash: hash(token) },
    include: { admin: true },
  })
  if (!challenge || challenge.expiresAt < new Date())
    throw createError({ statusCode: 401, statusMessage: '验证已过期，请重新登录' })
  const { code } = schema.parse(await readBody(event))
  let valid = false
  const secret = decryptSecret(challenge.admin.totpSecret!)
  if (/^\d{6}$/.test(code)) {
    const totp = new OTPAuth.TOTP({
      secret: OTPAuth.Secret.fromBase32(secret),
      issuer: 'Northstar',
      label: challenge.admin.email,
    })
    valid = totp.validate({ token: code, window: 1 }) !== null
  }
  if (!valid) {
    const digest = hash(code.toUpperCase())
    await db.$transaction(
      async (tx) => {
        const fresh = await tx.admin.findUniqueOrThrow({ where: { id: challenge.adminId } })
        const current = Array.isArray(fresh.recoveryCodes)
          ? fresh.recoveryCodes.filter((v): v is string => typeof v === 'string')
          : []
        if (current.includes(digest)) {
          await tx.admin.update({
            where: { id: fresh.id },
            data: { recoveryCodes: current.filter((x) => x !== digest) },
          })
          valid = true
        }
      },
      { isolationLevel: 'Serializable' },
    )
  }
  if (!valid) throw createError({ statusCode: 401, statusMessage: '验证码无效' })
  await db.authChallenge.deleteMany({ where: { adminId: challenge.adminId } })
  deleteCookie(event, 'northstar_2fa', { path: '/api/auth' })
  await createSession(event, challenge.adminId)
  return { ok: true }
})
