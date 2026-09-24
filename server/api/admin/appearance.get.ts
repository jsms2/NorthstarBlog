import { requireAdmin } from '../../utils/security'
import { readAppearance } from '../../utils/appearance'
export default defineEventHandler(async event => { await requireAdmin(event); return readAppearance() })
