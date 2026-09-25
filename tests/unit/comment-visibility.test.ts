import { describe, expect, it } from 'vitest'
import { commentsVisible } from '../../lib/comment-visibility'

describe('public comment visibility', () => {
  it('hides comments on every article and page when the global switch is off', () => {
    expect(commentsVisible(true, false)).toBe(false)
    expect(commentsVisible(false, false)).toBe(false)
  })

  it('respects the content switch when global comments are enabled', () => {
    expect(commentsVisible(true, true)).toBe(true)
    expect(commentsVisible(false, true)).toBe(false)
    expect(commentsVisible(true, undefined)).toBe(true)
  })
})
