import { z } from 'zod'
import * as OTPAuth from 'otpauth'
import { randomBytes } from 'node:crypto'
import { db } from '../../../../utils/db'
import { requireAdmin, requireCsrf, hash, decryptSecret } from '../../../../utils/security'
const s = z.object({ code: z.string().regex(/^\d{6}$/) })
export default defineEventHandler(async (event) => {
  const admin = await requireAdmin(event)
  requireCsrf(event)
  const { code } = s.parse(await readBody(event))
  const row = await db.admin.findUniqueOrThrow({ where: { id: admin.id } })
  if (!row.pendingTotpSecret)
    throw createError({ statusCode: 400, statusMessage: '请先开始配置双重验证' })
  const totp = new OTPAuth.TOTP({
    secret: OTPAuth.Secret.fromBase32(decryptSecret(row.pendingTotpSecret)),
    issuer: 'Northstar',
    label: row.email,
  })
  if (totp.validate({ token: code, window: 1 }) === null)
    throw createError({ statusCode: 400, statusMessage: '验证码不正确' })
  const codes = Array.from({ length: 10 }, () => randomBytes(5).toString('hex').toUpperCase())
  await db.admin.update({
    where: { id: row.id },
    data: {
      totpSecret: row.pendingTotpSecret,
      pendingTotpSecret: null,
      recoveryCodes: codes.map(hash),
    },
  })
  return { recoveryCodes: codes }
})
