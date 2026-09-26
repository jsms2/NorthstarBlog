import { readAppearance } from '../../utils/appearance'
import { readPublicSiteSettings } from '../../utils/public-site-settings'

export default defineEventHandler(async (event) => {
  const [appearance, settings] = await Promise.all([
    readAppearance(),
    readPublicSiteSettings(getRequestURL(event).origin),
  ])
  return { ...appearance, ...settings }
})
