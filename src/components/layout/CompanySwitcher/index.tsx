'use client';

import { useState, useEffect, useRef } from 'react';
import { useRouter } from 'next/navigation';
import { Building2, ChevronDown, Check, Plus } from 'lucide-react';
import { useBranding } from '@/contexts/BrandingContext';

interface Company {
  id: string;
  name: string;
  slug: string;
  is_active: boolean;
  branding?: { company_name: string | null; logo_url: string | null } | null;
}

interface CompanySwitcherProps {
  isOpen: boolean;
}

export default function CompanySwitcher({ isOpen }: CompanySwitcherProps) {
  const { companyName } = useBranding();
  const router = useRouter();
  const [companies, setCompanies] = useState<Company[]>([]);
  const [dropdownOpen, setDropdownOpen] = useState(false);
  const [currentSlug] = useState(() =>
    typeof document !== 'undefined'
      ? document.cookie.split('; ').find(r => r.startsWith('company_slug='))?.split('=')[1] ?? ''
      : ''
  );
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const API = process.env.NEXT_PUBLIC_URL_API ?? '';
    fetch(`${API}/company/list?limit=100`)
      .then(r => r.json())
      .then(j => { if (j.success) setCompanies(j.data?.data ?? []); })
      .catch(() => {});
  }, []);

  useEffect(() => {
    function onOutside(e: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setDropdownOpen(false);
      }
    }
    if (dropdownOpen) document.addEventListener('mousedown', onOutside);
    return () => document.removeEventListener('mousedown', onOutside);
  }, [dropdownOpen]);

  function switchToCompany(slug: string) {
    if (slug === currentSlug) { setDropdownOpen(false); return; }
    setDropdownOpen(false);
    // Limpa a sessão atual antes de navegar para o login da outra empresa.
    // Sem isso o middleware detecta o token e redireciona de volta ao /dashboard.
    document.cookie = 'authToken=; expires=Thu, 01 Jan 1970 00:00:00 UTC; path=/;';
    document.cookie = 'company_slug=; expires=Thu, 01 Jan 1970 00:00:00 UTC; path=/;';
    sessionStorage.removeItem('userData');
    router.push(`/${slug}/login`);
  }

  const displayName = companyName || currentSlug || 'Empresa';

  if (!isOpen) {
    return (
      <div className="flex justify-center mb-3">
        <div className="w-9 h-9 rounded-lg bg-gradient-to-br from-brand to-brand-hover flex items-center justify-center text-white text-xs font-bold">
          {displayName.charAt(0).toUpperCase()}
        </div>
      </div>
    );
  }

  return (
    <div ref={containerRef} className="relative mb-3 w-full">
      <button
        onClick={() => setDropdownOpen(v => !v)}
        className="w-full flex items-center gap-2 px-3 py-2 rounded-lg bg-surface-subtle hover:bg-surface-muted border border-ui-border-soft transition-colors duration-200"
      >
        <div className="w-7 h-7 rounded-md bg-gradient-to-br from-brand to-brand-hover flex items-center justify-center text-white text-xs font-bold shrink-0">
          {displayName.charAt(0).toUpperCase()}
        </div>
        <span className="flex-1 text-left text-sm font-medium text-content truncate">{displayName}</span>
        <ChevronDown
          size={14}
          className={`text-content-muted shrink-0 transition-transform duration-200 ${dropdownOpen ? 'rotate-180' : ''}`}
        />
      </button>

      {dropdownOpen && (
        <div className="absolute left-0 right-0 top-full mt-1 z-[200] rounded-xl bg-surface border border-ui-border shadow-lg overflow-hidden">
          <div className="px-3 py-2 border-b border-ui-border-soft">
            <p className="text-[11px] font-semibold text-content-muted uppercase tracking-wider">Empresas</p>
          </div>

          <ul className="max-h-52 overflow-y-auto py-1">
            {companies.length === 0 && (
              <li className="px-3 py-2 text-xs text-content-muted">Nenhuma empresa encontrada</li>
            )}
            {companies.map(c => {
              const label = c.branding?.company_name ?? c.name;
              const isActive = c.slug === currentSlug;
              return (
                <li key={c.id}>
                  <button
                    onClick={() => switchToCompany(c.slug)}
                    className={`w-full flex items-center gap-2 px-3 py-2 text-sm transition-colors duration-150 ${
                      isActive
                        ? 'text-brand font-medium bg-brand/5'
                        : 'text-content-secondary hover:bg-surface-subtle'
                    }`}
                  >
                    <Building2 size={14} className="shrink-0 text-content-muted" />
                    <span className="flex-1 text-left truncate">{label}</span>
                    {isActive && <Check size={13} className="text-brand shrink-0" />}
                  </button>
                </li>
              );
            })}
          </ul>

          <div className="border-t border-ui-border-soft py-1">
            <button
              onClick={() => { setDropdownOpen(false); router.push('/dashboard/empresas/cadastrar'); }}
              className="w-full flex items-center gap-2 px-3 py-2 text-sm text-content-muted hover:bg-surface-subtle transition-colors duration-150"
            >
              <Plus size={14} />
              <span>Nova empresa</span>
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
