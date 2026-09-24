import * as OTPAuth from 'otpauth'
import { db } from '../../../../utils/db'
import { requireAdmin, requireCsrf, encryptSecret } from '../../../../utils/security'
export default defineEventHandler(async (event) => {
  const admin = await requireAdmin(event)
  requireCsrf(event)
  const secret = new OTPAuth.Secret({ size: 20 })
  const totp = new OTPAuth.TOTP({
    issuer: 'Northstar',
    label: admin.email,
    algorithm: 'SHA1',
    digits: 6,
    period: 30,
    secret,
  })
  await db.admin.update({
    where: { id: admin.id },
    data: { pendingTotpSecret: encryptSecret(secret.base32) },
  })
  return { secret: secret.base32, otpauth: totp.toString() }
})
