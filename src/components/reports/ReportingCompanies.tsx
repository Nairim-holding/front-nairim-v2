'use client';

import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from 'react';
import { Building2 } from 'lucide-react';
import { useAuth } from '@/contexts/AuthContext';
import { listAccessibleCompaniesAction } from '@/server/actions/company';
import { CheckboxGroup } from '@/app/dashboard/(financeiro)/relatorios/_components/FiltersPanel';

const DEFAULT_SCOPE = { companyIds: [] as string[], setCompanyIds: (() => {}) as (ids: string[]) => void,
  companies: [] as { id: string; name: string }[], error: '', loading: false };
const ReportingContext = createContext(DEFAULT_SCOPE);
export const useReportingCompanies = () => useContext(ReportingContext);

export function ReportingCompaniesProvider({ children }: { children: ReactNode }) {
  const { user } = useAuth();
  const owner = `${user?.id}:${user?.company_id}:${user?.role}`;
  const [selection, setSelection] = useState({ owner, ids: [] as string[] });
  const companyIds = useMemo(() => selection.owner === owner ? selection.ids : [], [selection, owner]);
  const setCompanyIds = useCallback((ids: string[]) => setSelection({ owner, ids }), [owner]);
  const [companies, setCompanies] = useState<{ id: string; name: string }[]>([]);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(true);
  useEffect(() => {
    if (user?.role !== 'SUPER_ADMIN') return;
    let cancelled = false;
    listAccessibleCompaniesAction().then(result => {
      if (cancelled) return;
      if (result.ok) setCompanies(result.data.filter(c => c.is_active));
      else setError(result.error);
      setLoading(false);
    }).catch(() => {
      if (!cancelled) { setError('Não foi possível carregar as empresas.'); setLoading(false); }
    });
    return () => { cancelled = true; };
  }, [user?.id, user?.company_id, user?.role]);
  const value = useMemo(() => ({ companyIds: user?.role === 'SUPER_ADMIN' ? companyIds : [], setCompanyIds,
    companies, error, loading }), [companyIds, setCompanyIds, companies, error, loading, user?.role]);
  return <ReportingContext.Provider key={owner} value={value}>{children}</ReportingContext.Provider>;
}

/** Reuses the existing report checkbox selector and existing company listing. */
export function ReportingCompanyFilter() {
  const { user } = useAuth();
  const { companyIds, setCompanyIds, companies, error, loading } = useReportingCompanies();
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState('');
  const [draft, setDraft] = useState<string[]>([]);
  if (user?.role !== 'SUPER_ADMIN') return null;
  const selected = draft;
  const options = [{ value: user.company_id, label: 'Atual' }, ...companies.filter(c => c.id !== user.company_id).map(c => ({ value: c.id, label: c.name }))];
  const filtered = options.filter(c => c.label.toLocaleLowerCase('pt-BR').includes(search.toLocaleLowerCase('pt-BR')));
  const change = (ids: string[]) => { setDraft(ids); };
  return <div className="relative mb-3" data-reporting-companies>
    <button type="button" aria-label="Empresas" aria-expanded={open} onClick={() => { setDraft(companyIds.length ? companyIds : [user.company_id]); setSearch(''); setOpen(!open); }}
      className="flex items-center gap-2 rounded-lg border border-ui-border bg-surface px-3 py-2 text-sm text-content">
      <Building2 size={16} />Empresas: {companyIds.length ? `${companyIds.length} selecionada(s)` : 'Atual'}
    </button>
    {open && <div className="absolute top-full left-0 z-[100] mt-1 w-80 max-w-[calc(100vw-2rem)] rounded-xl border border-ui-border bg-surface p-3 shadow-lg">
      <input aria-label="Buscar empresa" placeholder="Buscar empresa" value={search} onChange={e => setSearch(e.target.value)} className="mb-2 w-full rounded-lg border border-ui-border bg-surface px-3 py-2 text-sm text-content" />
      {error && <p role="alert" className="text-sm text-red-600">{error}</p>}
      {loading ? <p className="text-sm text-content-muted">Carregando empresas…</p> : <CheckboxGroup icon={<Building2 size={16} />} title="Empresas"
        options={filtered} selected={selected.filter(id => filtered.some(c => c.value === id))} onChange={ids => change([...selected.filter(id => !filtered.some(c => c.value === id)), ...ids])}
        onToggle={id => change(selected.includes(id) ? selected.filter(c => c !== id) : [...selected, id])} />}
      <button type="button" onClick={() => { setCompanyIds(draft.length === 1 && draft[0] === user.company_id ? [] : [...draft].sort()); setOpen(false); }} className="mt-2 rounded-lg bg-brand px-4 py-2 text-sm text-white">Concluir</button>
    </div>}
  </div>;
}
