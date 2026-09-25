import { describe, expect, it } from 'vitest'
import { requestErrorMessage, requestErrorStatus } from '../../lib/request-error'

describe('request error feedback', () => {
  it('shows the API status message, including disabled comments', () => {
    const error = { statusCode: 403, data: { statusMessage: '全站评论已关闭' } }
    expect(requestErrorStatus(error)).toBe(403)
    expect(requestErrorMessage(error)).toBe('全站评论已关闭')
  })

  it('has useful fallbacks without exposing long error bodies', () => {
    expect(requestErrorMessage({ status: 429 })).toContain('频繁')
    expect(requestErrorMessage({ data: { message: 'x'.repeat(201) } }, '上传失败')).toBe('上传失败')
  })
})
