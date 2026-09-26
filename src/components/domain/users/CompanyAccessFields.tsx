'use client';

import { useEffect, useState } from 'react';
import { listAccessibleCompaniesAction } from '@/server/actions/company';

export default function CompanyAccessFields({ value = [], onChange, all, onAllChange, homeCompanyId, readOnly = false }: {
  value?: string[]; onChange?: (ids: string[]) => void; all: boolean;
  onAllChange?: (all: boolean) => void; homeCompanyId?: string; readOnly?: boolean;
}) {
  const [companies, setCompanies] = useState<Array<{ id: string; name: string }>>([]);
  const [error, setError] = useState('');
  useEffect(() => {
    let canceled = false;
    void listAccessibleCompaniesAction().then(result => {
      if (canceled) return;
      if (result.ok) setCompanies(result.data);
      else setError(result.error);
    }).catch(() => { if (!canceled) setError('Não foi possível carregar as empresas.'); });
    return () => { canceled = true; };
  }, []);
  return <fieldset className="space-y-3 rounded-xl border border-ui-border p-4" disabled={readOnly}>
    <legend className="px-2 font-semibold">Acesso por empresa</legend>
    <p className="text-sm text-content-muted">As diretivas do grupo de usuário serão respeitadas em todas as empresas. A empresa de cadastro permanece acessível.</p>
    <label className="flex gap-2 items-center"><input type="checkbox" checked={all} onChange={event => onAllChange?.(event.target.checked)} />Todas as empresas, incluindo novas</label>
    {error && <p role="alert" className="text-red-600">{error}</p>}
    {!all && <div className="grid gap-2 sm:grid-cols-2">{companies.map(company => <label key={company.id} className="flex items-center gap-2 text-sm">
      <input type="checkbox" disabled={readOnly || company.id === homeCompanyId} checked={company.id === homeCompanyId || value.includes(company.id)} onChange={event => onChange?.(event.target.checked ? [...value, company.id] : value.filter(id => id !== company.id))} />
      {company.name}{company.id === homeCompanyId ? ' (cadastro)' : ''}
    </label>)}</div>}
  </fieldset>;
}
