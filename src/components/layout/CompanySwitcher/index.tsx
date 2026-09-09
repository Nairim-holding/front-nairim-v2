'use client';

import { useState, useEffect, useRef, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { Building2, ChevronDown, Check, Plus, Loader2 } from 'lucide-react';
import { useAuth } from '@/contexts';
import { useTheme } from '@/contexts/ThemeContext';
import { useMessageContext } from '@/contexts/MessageContext';
import { getTokenMaxAgeSeconds } from '@/utils/jwt';
import { listCompaniesAction, switchCompanyAction } from '@/server/actions/company';
import Image from 'next/image';

interface Company {
  id: string;
  name: string;
  slug: string;
  is_active: boolean;
  branding?: {
    company_name: string | null;
    trade_name: string | null;
    logo_url: string | null;
    logo_dark_url: string | null;
    primary_color: string | null;
  } | null;
}

interface CompanySwitcherProps {
  isOpen: boolean;
  /** Chamado ao navegar para outra tela (troca de empresa ou "Nova empresa") — fecha a sidebar no mobile. */
  onNavigate?: () => void;
}

function CompanyAvatar({
  company,
  size = 'md',
}: {
  company: Company | undefined;
  size?: 'sm' | 'md';
}) {
  const { isDark } = useTheme();
  const px = size === 'sm' ? 'w-5 h-5' : 'w-7 h-7';
  const text = size === 'sm' ? 'text-[10px]' : 'text-xs';
  const label = company?.branding?.trade_name ?? company?.branding?.company_name ?? company?.name ?? '?';
  const logo = (isDark ? company?.branding?.logo_dark_url : null) ?? company?.branding?.logo_url;
  const color = company?.branding?.primary_color ?? '#8b5cf6';

  if (logo) {
    return (
      <Image
        src={logo}
        alt={label}
        width={size === 'sm' ? 20 : 28}
        height={size === 'sm' ? 20 : 28}
        className={`${px} rounded-md object-contain shrink-0${isDark && !company?.branding?.logo_dark_url ? ' invert' : ''}`}
        unoptimized
      />
    );
  }

  return (
    <div
      className={`${px} rounded-md flex items-center justify-center ${text} font-bold text-white shrink-0`}
      style={{ background: color }}
    >
      {label.charAt(0).toUpperCase()}
    </div>
  );
}

export default function CompanySwitcher({ isOpen, onNavigate }: CompanySwitcherProps) {
  const { login, user } = useAuth();
  const { showMessage } = useMessageContext();
  const router = useRouter();
  const [companies, setCompanies] = useState<Company[]>([]);
  const [dropdownOpen, setDropdownOpen] = useState(false);
  const [switching, setSwitching] = useState<string | null>(null);
  const [currentSlug, setCurrentSlug] = useState('');
  const containerRef = useRef<HTMLDivElement>(null);

  // Busca a lista de empresas — listaCompaniesAction retorna formato flat { data: [...], count }
  const fetchCompanies = useCallback(() => {
    listCompaniesAction({ limit: 100 })
      .then(r => {
        if (!r.ok) { setCompanies([]); return; }
        const list = Array.isArray(r.data?.data) ? (r.data.data as unknown as Company[]) : [];
        setCompanies(list);
      })
      .catch(() => {});
  }, []);

  // Busca inicial ao montar (o Sidebar não remonta ao navegar, então este é o
  // único fetch automático — a lista é refeita novamente ao abrir o dropdown,
  // cobrindo o caso de uma empresa ter sido cadastrada nesse meio-tempo).
  useEffect(() => {
    fetchCompanies();
  }, [fetchCompanies]);

  // Fecha dropdown ao clicar fora
  useEffect(() => {
    function onOutside(e: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setDropdownOpen(false);
      }
    }
    if (dropdownOpen) document.addEventListener('mousedown', onOutside);
    return () => document.removeEventListener('mousedown', onOutside);
  }, [dropdownOpen]);

  async function switchToCompany(slug: string, label: string) {
    if (slug === currentSlug || switching) return;
    setDropdownOpen(false);
    onNavigate?.();
    setSwitching(slug);

    // Atualiza o slug imediatamente para refletir na UI antes do refresh
    setCurrentSlug(slug);
    document.cookie = `company_slug=${slug}; path=/; SameSite=Lax; max-age=7200`;

    try {
      const result = await switchCompanyAction(slug);
      if (!result.ok) throw new Error(result.error ?? 'Erro ao trocar empresa');

      const { token, user } = result.data;

      // O cookie de slug foi reescrito no servidor com o max-age do novo token
      const maxAge = getTokenMaxAgeSeconds(token, 12 * 60 * 60);
      document.cookie = `company_slug=${slug}; path=/; SameSite=Lax; max-age=${maxAge}`;

      // Atualiza sessão com novo JWT (novo company_id)
      login(token, user);

      // Hard navigation (não router.push/refresh): troca de tenant precisa de
      // uma requisição 100% nova ao servidor. O App Router cacheia segmentos
      // de rota no client (Router Cache) sem saber que o cookie de sessão
      // mudou — router.push podia reaproveitar payload da empresa anterior,
      // "misturando" dados entre tenants até alguma interação forçar refetch.
      window.location.href = `/${slug}/dashboard`;
      return;
    } catch (err) {
      console.error('[CompanySwitcher] Erro ao trocar empresa:', err);
      // Reverte se falhar
      const prev = document.cookie.split('; ').find(r => r.startsWith('company_slug='))?.split('=')[1] ?? '';
      setCurrentSlug(prev);
      showMessage(err instanceof Error ? err.message : 'Erro ao trocar empresa', 'error');
    } finally {
      setSwitching(null);
    }
  }

  // Identifica a empresa atual pelo company_id do JWT (confiável) ou slug do cookie (pós-troca)
  const currentCompany = companies.find(c =>
    currentSlug ? c.slug === currentSlug : c.id === user?.company_id
  );
  const displayName = currentCompany?.branding?.trade_name || currentCompany?.branding?.company_name || currentCompany?.name || 'Empresa';

  if (!isOpen) {
    return (
      <div className="flex justify-center mb-3">
        <CompanyAvatar company={currentCompany} />
      </div>
    );
  }

  return (
    <div ref={containerRef} className="relative mb-3 w-full">
      <button
        onClick={() => {
          // Não chamar fetchCompanies (setState) dentro do updater de
          // setDropdownOpen — React pode invocar esse callback durante a
          // renderização, causando "Cannot update a component while
          // rendering a different component".
          const next = !dropdownOpen;
          setDropdownOpen(next);
          if (next) fetchCompanies();
        }}
        className="w-full flex items-center gap-2 px-3 py-2 rounded-lg bg-surface-subtle hover:bg-surface-muted border border-ui-border-soft transition-colors duration-200"
      >
        <CompanyAvatar company={currentCompany} />
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
              const label = c.branding?.trade_name ?? c.branding?.company_name ?? c.name;
              const isActive = c.slug === currentSlug;
              const isLoading = switching === c.slug;
              return (
                <li key={c.id}>
                  <button
                    onClick={() => switchToCompany(c.slug, label)}
                    disabled={!!switching}
                    className={`w-full flex items-center gap-2 px-3 py-2 text-sm transition-colors duration-150 disabled:opacity-60 ${
                      isActive
                        ? 'text-brand font-medium bg-brand/5'
                        : 'text-content-secondary hover:bg-surface-subtle'
                    }`}
                  >
                    {isLoading
                      ? <Loader2 size={14} className="shrink-0 animate-spin text-brand" />
                      : <CompanyAvatar company={c} size="sm" />
                    }
                    <span className="flex-1 text-left truncate">{label}</span>
                    {isActive && !isLoading && <Check size={13} className="text-brand shrink-0" />}
                  </button>
                </li>
              );
            })}
          </ul>

          <div className="border-t border-ui-border-soft py-1">
            <button
              onClick={() => { setDropdownOpen(false); onNavigate?.(); router.push('/dashboard/empresas/cadastrar'); }}
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
