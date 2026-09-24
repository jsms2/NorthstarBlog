import { z } from 'zod'
import { Prisma } from '@prisma/client'
import argon2 from 'argon2'
import * as OTPAuth from 'otpauth'
import { db } from '../../../../utils/db'
import { requireAdmin, requireCsrf, decryptSecret } from '../../../../utils/security'
const s = z.object({ password: z.string().min(1), code: z.string().optional() })
export default defineEventHandler(async (event) => {
  const admin = await requireAdmin(event)
  requireCsrf(event)
  const b = s.parse(await readBody(event))
  const row = await db.admin.findUniqueOrThrow({ where: { id: admin.id } })
  if (!(await argon2.verify(row.passwordHash, b.password)))
    throw createError({ statusCode: 403, statusMessage: '密码错误' })
  if (row.totpSecret) {
    if (!b.code) throw createError({ statusCode: 400, statusMessage: '请输入当前验证器代码' })
    const totp = new OTPAuth.TOTP({
      secret: OTPAuth.Secret.fromBase32(decryptSecret(row.totpSecret)),
      issuer: 'Northstar',
      label: row.email,
    })
    if (totp.validate({ token: b.code, window: 1 }) === null)
      throw createError({ statusCode: 403, statusMessage: '验证码错误' })
  }
  await db.admin.update({
    where: { id: admin.id },
    data: { totpSecret: null, pendingTotpSecret: null, recoveryCodes: Prisma.JsonNull },
  })
  return { ok: true }
})
