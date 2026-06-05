/** Staging-only QA constants — never use production URLs. */
export const STAGING = {
  adminUrl: process.env.ADMIN_BASE_URL ?? 'https://staging-admin.emdadsy.com',
  clientUrl: process.env.CLIENT_BASE_URL ?? 'https://staging-client.emdadsy.com',
  apiDirect: process.env.STAGING_API_DIRECT ?? 'http://127.0.0.1:3001',
  companyId: '00000000-0000-4000-8000-000000000001',
  companyIdAlt: '00000000-0000-4000-8000-000000000002',
  warehouseId: '', // resolved at runtime from API
  password: 'demo123',
  /** Min 8 chars required for user creation API */
  newUserPassword: 'demo1234',
} as const;

export const USERS = {
  superAdmin: { email: 'superadmin@emdad.example', role: 'super_admin' },
  manager: { email: 'manager@emdad.example', role: 'wh_manager' },
  clientAdmin: { email: 'client@acme.example', role: 'client_admin' },
  /** Created at runtime by role-coverage tests if missing */
  operator: { email: 'qa-operator@emdad.example', role: 'wh_operator' },
} as const;
