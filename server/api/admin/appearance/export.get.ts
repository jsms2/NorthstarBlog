import { requireAdmin } from '../../../utils/security'
import { readAppearance } from '../../../utils/appearance'
export default defineEventHandler(async event => {
  await requireAdmin(event)
  setHeader(event, 'content-disposition', 'attachment; filename="northstar-theme.json"')
  return { version: 1, appearance: await readAppearance() }
})
