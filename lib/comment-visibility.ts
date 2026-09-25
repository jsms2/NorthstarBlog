export function commentsVisible(allowComments: boolean, globalSetting: unknown): boolean {
  return allowComments && globalSetting !== false
}
