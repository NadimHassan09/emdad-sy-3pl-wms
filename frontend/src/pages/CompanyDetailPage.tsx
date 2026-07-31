import { useQuery } from '@tanstack/react-query';
import { Link, useParams } from 'react-router-dom';

import { Alert, Card, ListPageHeader, Skeleton } from '@ds';

import { CompaniesApi } from '../api/companies';
import { CompanyDetailsCard } from '../components/clients/CompanyDetailsCard';
import { QK } from '../constants/query-keys';

export function CompanyDetailPage() {
  const { id = '' } = useParams<{ id: string }>();

  const companyQuery = useQuery({
    queryKey: [...QK.companies, id],
    queryFn: () => CompaniesApi.get(id),
    enabled: !!id,
  });

  const company = companyQuery.data;

  return (
    <div className="space-y-5 animate-enter">
      <Link
        to="/clients"
        className="inline-flex items-center gap-1.5 text-sm font-medium text-text-muted transition-colors hover:text-text-strong"
      >
        <i className="fa-solid fa-arrow-left rtl:rotate-180 text-xs" aria-hidden="true" />
        Back to clients
      </Link>

      <ListPageHeader
        icon="fa-building"
        title={company?.name ?? 'Company details'}
        subtitle={company?.contactEmail ?? 'Client company profile'}
      />

      {companyQuery.isPending ? (
        <Card className="p-5 sm:p-6">
          <div className="space-y-4" aria-busy="true">
            <Skeleton height={28} width="40%" />
            <div className="grid gap-3 pt-2 sm:grid-cols-3">
              <Skeleton height={64} />
              <Skeleton height={64} />
              <Skeleton height={64} />
            </div>
            <Skeleton height={120} />
          </div>
        </Card>
      ) : null}

      {companyQuery.isError ? (
        <Alert variant="error" title="Could not load company details." />
      ) : null}
      {!companyQuery.isPending && !companyQuery.isError && !company ? (
        <Alert variant="error" title="Company not found." />
      ) : null}

      {company ? <CompanyDetailsCard company={company} /> : null}
    </div>
  );
}
