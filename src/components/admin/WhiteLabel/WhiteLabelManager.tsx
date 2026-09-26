'use client';

import { useCallback, useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { Building2, Image as ImageIcon, Palette, Loader2, Save } from 'lucide-react';
import { useMessageContext } from '@/contexts';
import type { CompanyBranding } from '@/types/branding';
import {
  COMPANY_IDENTITY_FIELDS,
  COMPANY_IDENTITY_FIELD_KEYS,
  type CompanyIdentityKey,
} from '@/lib/companyIdentity';
import ThemeEditor from './ThemeEditor';
import { BRANDING_COLOR_KEYS } from '@/lib/brandingTheme';
export { default as BrandingPreview } from './BrandingPreview';
import AssetUploader from './AssetUploader';
import { getMyBrandingAction, updateBrandingAction } from '@/server/actions/company';
import type { BrandingAssetField } from '@/core/entities/company';

type TabId = 'geral' | 'branding' | 'tema';

const TABS: { id: TabId; label: string; icon: React.ReactNode }[] = [
  { id: 'geral', label: 'Geral', icon: <Building2 size={18} /> },
  { id: 'branding', label: 'Branding', icon: <ImageIcon size={18} /> },
  { id: 'tema', label: 'Tema e aparência', icon: <Palette size={18} /> },
];

const TEXT_FIELDS: { field: keyof FormState; label: string; placeholder?: string; multiline?: boolean }[] = [
  { field: 'company_name', label: 'Nome exibido na interface', placeholder: 'Ex: Nairim Holding' },
  { field: 'trade_name', label: 'Nome fantasia', placeholder: 'Ex: Nairim Imóveis' },
  { field: 'app_title', label: 'Título da aplicação (aba do navegador)', placeholder: 'Ex: Nairim — Gestão Imobiliária' },
  { field: 'app_description', label: 'Descrição (meta description / compartilhamento)', placeholder: 'Breve descrição da plataforma', multiline: true },
];

const COLOR_AND_TEXT_FIELDS = [
  'company_name', 'trade_name', 'app_title', 'app_description',
  ...COMPANY_IDENTITY_FIELD_KEYS,
  ...BRANDING_COLOR_KEYS,
] as const;

type FormState = Record<
  | CompanyIdentityKey
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

  useEffect(() => {
    let cancelled = false;
    async function load() {
      try {
        const result = await getMyBrandingAction();
        if (!result.ok) throw new Error(result.error ?? `Erro ${result.status}`);
        if (!cancelled) setForm(brandingToForm(result.data as CompanyBranding | null));
      } catch (err: unknown) {
        if (!cancelled) showMessage(err instanceof Error ? err.message : 'Erro ao carregar configurações de marca', 'error');
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
        payload[field] = form[field] || ((BRANDING_COLOR_KEYS as readonly string[]).includes(field) ? null : undefined);
      }
      const result = await updateBrandingAction(payload);
      if (!result.ok) throw new Error(result.error ?? `Erro ${result.status}`);
      showMessage('Identidade visual atualizada com sucesso!', 'success');
      router.refresh();
    } catch (err: unknown) {
      showMessage(err instanceof Error ? err.message : 'Erro ao salvar identidade visual', 'error');
    } finally {
      setSaving(false);
    }
  }, [form, showMessage, router]);

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

            {COMPANY_IDENTITY_FIELDS.map(({ field, label, placeholder, span, maxLength }) => (
              <div key={field} className={`flex flex-col gap-1.5 ${span === 'full' ? 'md:col-span-2' : ''}`}>
                <label className="text-sm text-content-secondary" htmlFor={field}>{label}</label>
                <input
                  id={field}
                  type="text"
                  value={form[field]}
                  onChange={e => setField(field, e.target.value)}
                  placeholder={placeholder}
                  maxLength={maxLength}
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

        {activeTab === 'tema' && <ThemeEditor values={form} onChange={(field, value) => setField(field as keyof FormState, value)} />}
      </div>
    </div>
  );
}
