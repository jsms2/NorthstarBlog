import { db } from '../utils/db'
import { publishDuePosts } from '../utils/scheduler'

export default defineNitroPlugin((nitro) => {
  const publish = async () => {
    try {
      await publishDuePosts(db)
    } catch {
      console.error('Scheduled publishing failed')
    }
  }
  void publish()
  const timer = setInterval(publish, 15_000)
  timer.unref?.()
  nitro.hooks.hook('close', async () => {
    clearInterval(timer)
    await db.$disconnect()
  })
})
