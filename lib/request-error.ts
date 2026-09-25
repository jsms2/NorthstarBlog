type RequestFailure = {
  status?: number
  statusCode?: number
  statusMessage?: string
  data?: { statusMessage?: string; message?: string }
}

export function requestErrorStatus(error: unknown): number | undefined {
  const failure = error as RequestFailure | null
  return failure?.statusCode ?? failure?.status
}

export function requestErrorMessage(error: unknown, fallback = '操作失败，请稍后重试'): string {
  const failure = error as RequestFailure | null
  const message = failure?.data?.statusMessage || failure?.data?.message || failure?.statusMessage
  if (typeof message === 'string' && message.trim() && message.length <= 200) return message
  if (requestErrorStatus(error) === 403) return '没有权限执行此操作，或当前功能已关闭'
  if (requestErrorStatus(error) === 429) return '操作过于频繁，请稍后重试'
  return fallback
}
