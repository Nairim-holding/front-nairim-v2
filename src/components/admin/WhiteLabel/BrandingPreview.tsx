'use client';

import { useId, useState } from 'react';
import { Bell, Building2, CheckCircle2, CircleAlert, House, LayoutDashboard, Plus, Search, Users } from 'lucide-react';
import type { CompanyBranding } from '@/types/branding';
import { buildBrandingPreviewCss } from '@/lib/brandingCss';
import Input from '@/components/ui/Input';
import Checkbox from '@/components/ui/Checkbox';
import Toggle from '@/components/ui/Toggle';
import NumericCard from '@/components/charts/MetricCard';

/** Scoped tokens reuse the live theme defaults and the same tenant CSS generator. */
export default function BrandingPreview({ branding, mode }: { branding: Partial<CompanyBranding>; mode?: 'light' | 'dark' }) {
  const [localDark, setLocalDark] = useState(false);
  const [search, setSearch] = useState('');
  const [checked, setChecked] = useState(true);
  const [notifications, setNotifications] = useState(true);
  const rawId = useId();
  const id = `branding-preview-${rawId.replace(/[^a-zA-Z0-9_-]/g, '')}`;
  const activeMode = mode ?? (localDark ? 'dark' : 'light');
  const css = buildBrandingPreviewCss(branding, id, activeMode);
  const name = branding.trade_name || branding.company_name || 'Sua Empresa';
  const logo = activeMode === 'dark' ? branding.logo_dark_url || branding.logo_sidebar_url || branding.logo_url : branding.logo_sidebar_url || branding.logo_url;

  return <div className="space-y-3">
    {!mode && <Toggle checked={localDark} onChange={setLocalDark} label="Modo noturno" />}
    {css && <style>{css}</style>}
    <section id={id} data-theme={activeMode} aria-label="Prévia do tema da empresa"
      className="branding-preview overflow-hidden rounded-xl border border-ui-border bg-page text-content shadow-sm" style={{ colorScheme: activeMode }}>
      <header className="flex items-center justify-between gap-3 border-b border-ui-border bg-surface p-4">
        <div className="flex min-w-0 items-center gap-3">
          {logo ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={logo} alt={name} className="h-9 max-w-28 object-contain" />
          ) : <span className="rounded-lg bg-brand p-2 text-content-inverse"><Building2 size={20} /></span>}
          <div className="min-w-0"><p className="truncate text-sm font-semibold">{name}</p><p className="text-xs text-content-muted">Gestão imobiliária</p></div>
        </div>
        <Bell size={18} className="shrink-0 text-content-muted" />
      </header>
      <div className="flex flex-wrap gap-2 border-b border-ui-border bg-surface p-3 text-xs">
        <span className="flex items-center gap-1.5 rounded-lg bg-brand px-3 py-2 font-medium text-content-inverse"><LayoutDashboard size={14} />Resumo</span>
        <span className="flex items-center gap-1.5 px-3 py-2 text-content-muted"><House size={14} />Imóveis</span>
        <span className="flex items-center gap-1.5 px-3 py-2 text-content-muted"><Users size={14} />Proprietários</span>
      </div>
      <div className="space-y-4 p-4">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div><h4 className="text-lg font-semibold">Visão geral</h4><p className="text-xs text-content-muted">Acompanhe sua carteira de imóveis</p></div>
          <button type="button" className="flex items-center gap-1.5 rounded-lg bg-brand px-3 py-2 text-xs font-medium text-content-inverse transition-colors hover:bg-brand-hover"><Plus size={15} />Novo imóvel</button>
        </div>
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 [&>div]:min-w-0 [&_h3]:text-sm [&_h3]:pr-0">
          <NumericCard value={24} label="Imóveis cadastrados" />
          <NumericCard value={18} label="Locações ativas" />
        </div>
        <div className="space-y-4 rounded-xl border border-ui-border bg-surface p-4">
          <Input id={`${id}-search`} label="Buscar imóvel" value={search} onChange={event => setSearch(event.target.value)} placeholder="Nome ou endereço" svg={<Search size={16} />} full />
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs text-content">
              <thead className="bg-surface-subtle text-content-secondary"><tr><th className="rounded-l-lg p-3 font-medium">Imóvel</th><th className="rounded-r-lg p-3 font-medium">Situação</th></tr></thead>
              <tbody className="divide-y divide-ui-border">
                {[['Residencial Aurora', 'Disponível', 'bg-state-success/15 text-state-success'], ['Sala Comercial Centro', 'Ocupado', 'bg-state-info/15 text-state-info']].filter(([title]) => title.toLocaleLowerCase('pt-BR').includes(search.toLocaleLowerCase('pt-BR'))).map(([title, status, color]) => (
                  <tr key={title}><td className="p-3">{title}</td><td className="p-3"><span className={`inline-block rounded-full px-2 py-1 ${color}`}>{status}</span></td></tr>
                ))}
              </tbody>
            </table>
          </div>
          <div className="flex flex-wrap gap-4 border-t border-ui-border pt-4">
            <Checkbox checked={checked} onChange={setChecked} label="Somente ativos" />
            <Toggle checked={notifications} onChange={setNotifications} label="Notificações" />
          </div>
        </div>
        <div className="grid gap-2 text-xs">
          <p className="flex items-center gap-2 rounded-lg bg-state-success/10 p-3 text-state-success"><CheckCircle2 size={16} />Cadastro atualizado com sucesso.</p>
          <p className="flex items-center gap-2 rounded-lg bg-state-warning/10 p-3 text-state-warning"><CircleAlert size={16} />Há contratos próximos do vencimento.</p>
          <p className="flex items-center gap-2 rounded-lg bg-state-error/10 p-3 text-state-error"><CircleAlert size={16} />Confira os campos obrigatórios.</p>
        </div>
        <p className="border-l-2 border-brand-accent pl-3 text-xs text-brand-accent">Sua marca em cada detalhe.</p>
      </div>
    </section>
  </div>;
}
