/** E2E runs against a deliberately provisioned local/test admin, never a source-embedded password. */
export function e2eAdminPassword() {
  const password = process.env.E2E_ADMIN_PASSWORD
  if (!password) throw new Error('Set E2E_ADMIN_PASSWORD for the disposable E2E environment')
  return password
}
