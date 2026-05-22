import { useQuery } from '@tanstack/react-query';
import { Link, useParams } from 'react-router-dom';

import { CompaniesApi } from '../api/companies';
import { CompanyDetailsCard } from '../components/clients/CompanyDetailsCard';
import { PageHeader } from '../components/PageHeader';
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
    <div className="space-y-4">
      <div className="text-sm text-slate-500">
        <Link to="/clients" className="hover:underline">
          ← Back to clients
        </Link>
      </div>

      <PageHeader title="Company details" />

      {companyQuery.isPending ? <p className="text-sm text-slate-500">Loading company details…</p> : null}
      {companyQuery.isError ? <p className="text-sm text-rose-600">Could not load company details.</p> : null}
      {!companyQuery.isPending && !companyQuery.isError && !company ? (
        <p className="text-sm text-rose-600">Company not found.</p>
      ) : null}

      {company ? <CompanyDetailsCard company={company} /> : null}
    </div>
  );
}
