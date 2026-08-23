'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import { Building2, Image as ImageIcon, Palette, Moon, Sun, Eye, Loader2, Save } from 'lucide-react';
import { useMessageContext } from '@/contexts';
import type { CompanyBranding } from '@/types/branding';
import { buildBrandingCss } from '@/lib/brandingCss';
import ColorInput from './ColorInput';
import AssetUploader from './AssetUploader';
import { getMyBrandingAction, updateBrandingAction } from '@/server/actions/company';
import type { BrandingAssetField } from '@/core/entities/company';

type TabId = 'geral' | 'branding' | 'tema-light' | 'tema-dark' | 'preview';

const TABS: { id: TabId; label: string; icon: React.ReactNode }[] = [
  { id: 'geral', label: 'Geral', icon: <Building2 size={18} /> },
  { id: 'branding', label: 'Branding', icon: <ImageIcon size={18} /> },
  { id: 'tema-light', label: 'Tema Light', icon: <Sun size={18} /> },
  { id: 'tema-dark', label: 'Tema Dark', icon: <Moon size={18} /> },
  { id: 'preview', label: 'Preview', icon: <Eye size={18} /> },
];

const TEXT_FIELDS: { field: keyof FormState; label: string; placeholder?: string; multiline?: boolean }[] = [
  { field: 'company_name', label: 'Nome exibido na interface', placeholder: 'Ex: Nairim Holding' },
  { field: 'trade_name', label: 'Nome fantasia', placeholder: 'Ex: Nairim Imóveis' },
  { field: 'app_title', label: 'Título da aplicação (aba do navegador)', placeholder: 'Ex: Nairim — Gestão Imobiliária' },
  { field: 'app_description', label: 'Descrição (meta description / compartilhamento)', placeholder: 'Breve descrição da plataforma', multiline: true },
];

/**
 * Dados juridicos do tenant, gravados em `CompanyBranding.company_info` (Json).
 * Alimentam o cabecalho dos relatorios impressos/exportados — antes esses
 * campos vinham da Imobiliaria cadastrada, que e outra pessoa juridica.
 */
const COMPANY_INFO_FIELDS: { field: CompanyInfoKey; label: string; placeholder?: string; wide?: boolean }[] = [
  { field: 'legal_name', label: 'Razão social', placeholder: 'Ex: Nairim Holding LTDA' },
  { field: 'cnpj', label: 'CNPJ', placeholder: 'Ex: 00.000.000/0001-00' },
  { field: 'phone', label: 'Telefone', placeholder: 'Ex: (14) 3471-0000' },
  { field: 'email', label: 'E-mail', placeholder: 'Ex: contato@nairim.com.br' },
  { field: 'address', label: 'Endereço', placeholder: 'Ex: Rua Exemplo, 100 Centro - Garça/SP', wide: true },
];

type CompanyInfoKey = 'legal_name' | 'cnpj' | 'phone' | 'email' | 'address';
type CompanyInfoState = Record<CompanyInfoKey, string>;

const EMPTY_COMPANY_INFO: CompanyInfoState = {
  legal_name: '', cnpj: '', phone: '', email: '', address: '',
};

const COLOR_FIELDS: { key: ColorKey; label: string; defaultValue: string }[] = [
  { key: 'primary', label: 'Cor primária', defaultValue: '#8b5cf6' },
  { key: 'secondary', label: 'Cor secundária', defaultValue: '#6d28d9' },
  { key: 'accent', label: 'Cor de destaque', defaultValue: '#ec4899' },
  { key: 'success', label: 'Cor de sucesso', defaultValue: '#10b981' },
  { key: 'warning', label: 'Cor de aviso', defaultValue: '#f59e0b' },
  { key: 'error', label: 'Cor de erro', defaultValue: '#ef4444' },
  { key: 'info', label: 'Cor de informação', defaultValue: '#3b82f6' },
  { key: 'bg', label: 'Cor de fundo', defaultValue: '#ffffff' },
  { key: 'card', label: 'Cor de cards', defaultValue: '#ffffff' },
  { key: 'border', label: 'Cor de bordas', defaultValue: '#cccccc' },
  { key: 'text', label: 'Cor de texto', defaultValue: '#171717' },
];

type ColorKey = 'primary' | 'secondary' | 'accent' | 'success' | 'warning' | 'error' | 'info' | 'bg' | 'card' | 'border' | 'text';

const LIGHT_FIELD_BY_KEY: Record<ColorKey, keyof FormState> = {
  primary: 'primary_color', secondary: 'secondary_color', accent: 'accent_color',
  success: 'success_color', warning: 'warning_color', error: 'error_color', info: 'info_color',
  bg: 'bg_color', card: 'card_color', border: 'border_color', text: 'text_color',
};

const DARK_FIELD_BY_KEY: Record<ColorKey, keyof FormState> = {
  primary: 'primary_color_dark', secondary: 'secondary_color_dark', accent: 'accent_color_dark',
  success: 'success_color_dark', warning: 'warning_color_dark', error: 'error_color_dark', info: 'info_color_dark',
  bg: 'bg_color_dark', card: 'card_color_dark', border: 'border_color_dark', text: 'text_color_dark',
};

const COLOR_AND_TEXT_FIELDS = [
  'company_name', 'trade_name', 'app_title', 'app_description',
  ...Object.values(LIGHT_FIELD_BY_KEY), ...Object.values(DARK_FIELD_BY_KEY),
] as const;

type FormState = Record<
  | 'company_name' | 'trade_name' | 'app_title' | 'app_description'
  | 'logo_url' | 'logo_sidebar_url' | 'logo_dark_url' | 'favicon_url' | 'og_image_url'
  | 'primary_color' | 'secondary_color' | 'accent_color' | 'success_color' | 'warning_color'
  | 'error_color' | 'info_color' | 'bg_color' | 'card_color' | 'border_color' | 'text_color'
  | 'primary_color_dark' | 'secondary_color_dark' | 'accent_color_dark' | 'success_color_dark'
  | 'warning_color_dark' | 'error_color_dark' | 'info_color_dark' | 'bg_color_dark'
  | 'card_color_dark' | 'border_color_dark' | 'text_color_dark',
  string
>;

const EMPTY_FORM: FormState = COLOR_AND_TEXT_FIELDS.reduce((acc, field) => {
  acc[field] = '';
  return acc;
}, {} as FormState);
EMPTY_FORM.logo_url = '';
EMPTY_FORM.logo_sidebar_url = '';
EMPTY_FORM.logo_dark_url = '';
EMPTY_FORM.favicon_url = '';
EMPTY_FORM.og_image_url = '';

function companyInfoToState(info: Record<string, unknown> | null): CompanyInfoState {
  const state = { ...EMPTY_COMPANY_INFO };
  if (!info || typeof info !== 'object') return state;
  (Object.keys(state) as CompanyInfoKey[]).forEach((key) => {
    const value = info[key];
    if (typeof value === 'string') state[key] = value;
  });
  return state;
}

function brandingToForm(b: CompanyBranding | null): FormState {
  const form = { ...EMPTY_FORM };
  if (!b) return form;
  (Object.keys(form) as (keyof FormState)[]).forEach((key) => {
    const value = b[key as keyof CompanyBranding];
    if (typeof value === 'string') form[key] = value;
  });
  return form;
}

export default function WhiteLabelManager() {
  const { showMessage } = useMessageContext();
  const router = useRouter();

  const assetField = useCallback((name: string): BrandingAssetField => name as BrandingAssetField, []);

  const [activeTab, setActiveTab] = useState<TabId>('geral');
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState<FormState>(EMPTY_FORM);
  const [companyInfo, setCompanyInfo] = useState<CompanyInfoState>(EMPTY_COMPANY_INFO);

  useEffect(() => {
    let cancelled = false;
    async function load() {
      try {
        const result = await getMyBrandingAction();
        if (!result.ok) throw new Error(result.error ?? `Erro ${result.status}`);
        if (!cancelled) {
          const branding = result.data as CompanyBranding | null;
          setForm(brandingToForm(branding));
          setCompanyInfo(companyInfoToState(branding?.company_info ?? null));
        }
      } catch (err: any) {
        if (!cancelled) showMessage(err?.message ?? 'Erro ao carregar configurações de marca', 'error');
      } finally {
        if (!cancelled) setLoading(false);
      }
    }
    load();
    return () => { cancelled = true; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const setField = useCallback((field: keyof FormState, value: string) => {
    setForm(prev => ({ ...prev, [field]: value }));
  }, []);

  const handleAssetUploaded = useCallback((field: keyof FormState) => (url: string) => {
    setForm(prev => ({ ...prev, [field]: url }));
  }, []);

  const handleSave = useCallback(async () => {
    setSaving(true);
    try {
      const payload: Record<string, unknown> = {};
      for (const field of COLOR_AND_TEXT_FIELDS) {
        payload[field] = form[field] || undefined;
      }
      // Dados juridicos do tenant vao juntos, num objeto so (coluna Json).
      // Campos em branco saem do objeto para nao gravar string vazia.
      const info = Object.fromEntries(
        (Object.keys(companyInfo) as CompanyInfoKey[])
          .map((key) => [key, companyInfo[key].trim()])
          .filter(([, value]) => value.length > 0)
      );
      // Objeto vazio (e nao `null`) quando tudo esta em branco: a coluna e Json
      // e o Prisma exige `DbNull`/`JsonNull` para gravar null — um `null` cru
      // faria a API estourar ao limpar os campos.
      payload.company_info = info;

      const result = await updateBrandingAction(payload);
      if (!result.ok) throw new Error(result.error ?? `Erro ${result.status}`);
      showMessage('Identidade visual atualizada com sucesso!', 'success');
      router.refresh();
    } catch (err: any) {
      showMessage(err?.message ?? 'Erro ao salvar identidade visual', 'error');
    } finally {
      setSaving(false);
    }
  }, [form, companyInfo, showMessage, router]);

  // Monta um objeto compatível com CompanyBranding para gerar o preview ao vivo
  const previewBranding = useMemo<CompanyBranding>(() => ({
    company_name: form.company_name || null,
    logo_url: form.logo_url || null,
    favicon_url: form.favicon_url || null,
    company_info: null,
    trade_name: form.trade_name || null,
    app_title: form.app_title || null,
    app_description: form.app_description || null,
    logo_sidebar_url: form.logo_sidebar_url || null,
    logo_dark_url: form.logo_dark_url || null,
    og_image_url: form.og_image_url || null,
    ...Object.fromEntries(COLOR_FIELDS.flatMap(({ key }) => ([
      [LIGHT_FIELD_BY_KEY[key], form[LIGHT_FIELD_BY_KEY[key]] || null],
      [DARK_FIELD_BY_KEY[key], form[DARK_FIELD_BY_KEY[key]] || null],
    ]))),
  } as unknown as CompanyBranding), [form]);

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20 text-content-muted gap-2">
        <Loader2 size={20} className="animate-spin" />
        Carregando configurações de marca...
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-6">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-xl font-semibold text-content">Identidade Visual (White Label)</h1>
          <p className="text-sm text-content-muted">
            Personalize a identidade visual da sua empresa — alterações são aplicadas em tempo real, sem necessidade de deploy.
          </p>
        </div>
        <button
          type="button"
          onClick={handleSave}
          disabled={saving}
          className="flex items-center gap-2 h-11 px-5 rounded-lg bg-brand text-content-inverse text-sm font-medium hover:bg-brand-hover transition-colors disabled:opacity-60"
        >
          {saving ? <Loader2 size={16} className="animate-spin" /> : <Save size={16} />}
          {saving ? 'Salvando...' : 'Salvar alterações'}
        </button>
      </div>

      <div className="flex items-center gap-1 border-b border-ui-border overflow-x-auto">
        {TABS.map(tab => (
          <button
            key={tab.id}
            type="button"
            onClick={() => setActiveTab(tab.id)}
            className={`flex items-center gap-2 px-4 py-2.5 text-sm font-medium whitespace-nowrap border-b-2 transition-colors ${
              activeTab === tab.id
                ? 'border-brand text-brand'
                : 'border-transparent text-content-muted hover:text-content'
            }`}
          >
            {tab.icon}
            {tab.label}
          </button>
        ))}
      </div>

      <div className="bg-surface border border-ui-border rounded-xl p-5">
        {activeTab === 'geral' && (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {TEXT_FIELDS.map(({ field, label, placeholder, multiline }) => (
              <div key={field} className={`flex flex-col gap-1.5 ${multiline ? 'md:col-span-2' : ''}`}>
                <label className="text-sm text-content-secondary" htmlFor={field}>{label}</label>
                {multiline ? (
                  <textarea
                    id={field}
                    value={form[field]}
                    onChange={e => setField(field, e.target.value)}
                    placeholder={placeholder}
                    rows={3}
                    className="text-content bg-surface border border-ui-border rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-brand resize-none"
                  />
                ) : (
                  <input
                    id={field}
                    type="text"
                    value={form[field]}
                    onChange={e => setField(field, e.target.value)}
                    placeholder={placeholder}
                    className="h-[46px] text-content bg-surface border border-ui-border rounded-lg px-3 text-sm focus:outline-none focus:border-brand"
                  />
                )}
              </div>
            ))}

            <div className="md:col-span-2 mt-2 pt-4 border-t border-ui-border-soft">
              <h2 className="text-sm font-semibold text-content">Dados da Empresa</h2>
              <p className="text-xs text-content-muted mt-0.5">
                Usados no cabeçalho dos relatórios impressos e exportados.
              </p>
            </div>

            {COMPANY_INFO_FIELDS.map(({ field, label, placeholder, wide }) => (
              <div key={field} className={`flex flex-col gap-1.5 ${wide ? 'md:col-span-2' : ''}`}>
                <label className="text-sm text-content-secondary" htmlFor={`company_info_${field}`}>{label}</label>
                <input
                  id={`company_info_${field}`}
                  type="text"
                  value={companyInfo[field]}
                  onChange={e => setCompanyInfo(prev => ({ ...prev, [field]: e.target.value }))}
                  placeholder={placeholder}
                  className="h-[46px] text-content bg-surface border border-ui-border rounded-lg px-3 text-sm focus:outline-none focus:border-brand"
                />
              </div>
            ))}
          </div>
        )}

        {activeTab === 'branding' && (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <AssetUploader
              label="Logo principal"
              hint="PNG, JPG, SVG ou WebP — até 5MB"
              field={assetField('logo_url')}
              currentUrl={form.logo_url || null}
              onUploaded={handleAssetUploaded('logo_url')}
            />
            <AssetUploader
              label="Logo da sidebar"
              hint="Usado no menu lateral — opcional, usa o logo principal se vazio"
              field={assetField('logo_sidebar_url')}
              currentUrl={form.logo_sidebar_url || null}
              onUploaded={handleAssetUploaded('logo_sidebar_url')}
            />
            <AssetUploader
              label="Logo modo escuro"
              hint="Exibido quando o tema escuro está ativo"
              field={assetField('logo_dark_url')}
              currentUrl={form.logo_dark_url || null}
              onUploaded={handleAssetUploaded('logo_dark_url')}
            />
            <AssetUploader
              label="Favicon"
              hint="Ícone exibido na aba do navegador — até 5MB"
              field={assetField('favicon_url')}
              currentUrl={form.favicon_url || null}
              onUploaded={handleAssetUploaded('favicon_url')}
              previewClassName="w-16 h-16"
            />
            <AssetUploader
              label="Imagem OG / redes sociais"
              hint="Exibida ao compartilhar links — recomendado 1200x630px, até 10MB"
              field={assetField('og_image_url')}
              currentUrl={form.og_image_url || null}
              onUploaded={handleAssetUploaded('og_image_url')}
              previewClassName="w-48 h-28"
            />
          </div>
        )}

        {activeTab === 'tema-light' && (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {COLOR_FIELDS.map(({ key, label, defaultValue }) => (
              <ColorInput
                key={`light-${key}`}
                label={label}
                value={form[LIGHT_FIELD_BY_KEY[key]]}
                onChange={v => setField(LIGHT_FIELD_BY_KEY[key], v)}
                defaultValue={defaultValue}
              />
            ))}
          </div>
        )}

        {activeTab === 'tema-dark' && (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {COLOR_FIELDS.map(({ key, label, defaultValue }) => (
              <ColorInput
                key={`dark-${key}`}
                label={label}
                value={form[DARK_FIELD_BY_KEY[key]]}
                onChange={v => setField(DARK_FIELD_BY_KEY[key], v)}
                defaultValue={form[LIGHT_FIELD_BY_KEY[key]] || defaultValue}
              />
            ))}
          </div>
        )}

        {activeTab === 'preview' && <BrandingPreview branding={previewBranding} />}
      </div>
    </div>
  );
}

export function BrandingPreview({ branding }: { branding: CompanyBranding }) {
  const css = useMemo(() => buildBrandingCss(branding), [branding]);
  const name = branding.trade_name || branding.company_name || 'Sua Empresa';

  return (
    <div className="flex flex-col gap-4">
      <p className="text-xs text-content-muted">
        Pré-visualização ao vivo — reflete exatamente as variáveis CSS que serão aplicadas ao sistema.
      </p>
      {css && <style dangerouslySetInnerHTML={{ __html: css.replace(/:root/g, '.wl-preview-light').replace(/\.dark/g, '.wl-preview-dark') }} />}

      <PreviewMockup className="wl-preview-light" title={`${name} — Tema Light`} logoUrl={branding.logo_url} />
      <PreviewMockup className="wl-preview-dark" title={`${name} — Tema Dark`} logoUrl={branding.logo_dark_url ?? branding.logo_url} />
    </div>
  );
}

function PreviewMockup({ className, title, logoUrl }: { className: string; title: string; logoUrl: string | null }) {
  return (
    <div
      className={`${className} rounded-xl border p-5 flex flex-col gap-4`}
      style={{
        background: 'var(--color-bg-page)',
        borderColor: 'var(--color-border-default)',
        color: 'var(--color-text-primary)',
      }}
    >
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          {logoUrl ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={logoUrl} alt={title} className="h-8 w-auto object-contain" />
          ) : (
            <div className="h-8 w-8 rounded-md" style={{ background: 'var(--color-brand-primary)' }} />
          )}
          <span className="font-medium">{title}</span>
        </div>
        <div className="flex gap-2">
          <span className="px-3 py-1 rounded-full text-xs font-medium text-white" style={{ background: 'var(--color-brand-primary)' }}>Primária</span>
          <span className="px-3 py-1 rounded-full text-xs font-medium text-white" style={{ background: 'var(--color-brand-primary-hover)' }}>Secundária</span>
        </div>
      </div>

      <div
        className="rounded-lg p-4 flex flex-col gap-3"
        style={{ background: 'var(--color-bg-surface)', border: '1px solid var(--color-border-default)' }}
      >
        <span className="text-sm" style={{ color: 'var(--color-text-primary)' }}>Card de exemplo com texto e ações</span>
        <div className="flex flex-wrap gap-2">
          <PreviewBadge color="var(--color-success)" label="Sucesso" />
          <PreviewBadge color="var(--color-warning)" label="Aviso" />
          <PreviewBadge color="var(--color-error)" label="Erro" />
          <PreviewBadge color="var(--color-info)" label="Info" />
          <PreviewBadge color="var(--color-accent)" label="Destaque" />
        </div>
        <button
          type="button"
          className="self-start px-4 py-2 rounded-lg text-sm font-medium text-white"
          style={{ background: 'var(--color-brand-primary)' }}
        >
          Botão de ação
        </button>
      </div>
    </div>
  );
}

function PreviewBadge({ color, label }: { color: string; label: string }) {
  return (
    <span className="px-2.5 py-1 rounded-md text-xs font-medium text-white" style={{ background: color }}>
      {label}
    </span>
  );
}
