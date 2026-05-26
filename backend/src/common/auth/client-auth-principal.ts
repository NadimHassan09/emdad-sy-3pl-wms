import { ClientPrincipal } from './client-principal.types';
import { AuthPrincipal } from './current-user.types';

/** Map a client-portal JWT principal into the internal `AuthPrincipal` shape. */
export function clientAuthPrincipal(client: ClientPrincipal): AuthPrincipal {
  return {
    id: client.id,
    companyId: client.companyId,
    role: client.role,
    email: client.email ?? undefined,
    tenantScope: 'restricted',
    authorizedCompanyIds: [client.companyId],
  };
}
