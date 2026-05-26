import { CompanyAccessService } from '../company-access/company-access.service';
import { AuthPrincipal } from './current-user.types';

/** List/read filter via centralized tenant validation. */
export function readCompanyIdFilter(
  companyAccess: CompanyAccessService,
  user: AuthPrincipal,
  queryCompanyId?: string,
): string | undefined {
  return companyAccess.getReadFilterCompanyId(user, queryCompanyId);
}
