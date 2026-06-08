'use client';

import { use, useMemo, useState, useCallback, useEffect } from 'react';
import { useMessageContext } from '@/contexts';
import { useAuth } from '@/contexts/AuthContext';
import DynamicFormManager from '@/components/form/DynamicForm';
import ColorInput from '@/components/admin/WhiteLabel/ColorInput';
import AssetUploader from '@/components/admin/WhiteLabel/AssetUploader';
import SuperAdminOnly from '@/components/protections/SuperAdminOnly';
import { BrandingPreview } from '@/components/admin/WhiteLabel/WhiteLabelManager';
import type { FormStep } from '@/types/types';
import type { CompanyBranding } from '@/types/branding';
import { Building2, Globe, ToggleLeft, Type, Sun, Moon, Image as ImageIcon, Eye } from 'lucide-react';

const API_URL = process.env.NEXT_PUBLIC_URL_API ?? '';

interface Props {
  params: Promise<{ id: string }>;
}

const COLOR_FIELDS: { key: string; label: string; defaultValue: string }[] = [
  { key: 'primary_color', label: 'Cor primária', defaultValue: '#8b5cf6' },
  { key: 'secondary_color', label: 'Cor secundária', defaultValue: '#6d28d9' },
  { key: 'accent_color', label: 'Cor de destaque', defaultValue: '#ec4899' },
  { key: 'success_color', label: 'Cor de sucesso', defaultValue: '#10b981' },
  { key: 'warning_color', label: 'Cor de aviso', defaultValue: '#f59e0b' },
  { key: 'error_color', label: 'Cor de erro', defaultValue: '#ef4444' },
  { key: 'info_color', label: 'Cor de informação', defaultValue: '#3b82f6' },
  { key: 'bg_color', label: 'Cor de fundo', defaultValue: '#ffffff' },
  { key: 'card_color', label: 'Cor de cards', defaultValue: '#ffffff' },
  { key: 'border_color', label: 'Cor de bordas', defaultValue: '#cccccc' },
  { key: 'text_color', label: 'Cor de texto', defaultValue: '#171717' },
];

const BRANDING_TEXT_FIELDS = ['company_name', 'trade_name', 'app_title', 'app_description'];
const BRANDING_ASSET_FIELDS = ['logo_url', 'logo_sidebar_url', 'logo_dark_url', 'favicon_url', 'og_image_url'];
const BRANDING_COLOR_FIELDS = [
  ...COLOR_FIELDS.map(c => c.key),
  ...COLOR_FIELDS.map(c => `${c.key}_dark`),
];
const ALL_BRANDING_FIELDS = [...BRANDING_TEXT_FIELDS, ...BRANDING_ASSET_FIELDS, ...BRANDING_COLOR_FIELDS];

function colorStep(title: string, icon: React.ReactNode, suffix: '' | '_dark', helperText?: string): FormStep {
  return {
    title,
    icon,
    fields: [
      ...(helperText ? [{
        field: `__helper_${suffix || 'light'}`,
        label: '',
        type: 'custom' as const,
        className: 'col-span-full',
        render: () => <p className="text-xs text-content-muted -mt-2">{helperText}</p>,
      }] : []),
      ...COLOR_FIELDS.map(({ key, label, defaultValue }) => ({
        field: `${key}${suffix}`,
        label,
        type: 'custom' as const,
        className: 'col-span-1',
        render: (value: any, formValues: any, onChange?: (v: any) => void) => (
          <ColorInput
            value={value ?? ''}
            onChange={v => onChange?.(v)}
            defaultValue={suffix === '_dark' ? (formValues?.[key] || defaultValue) : defaultValue}
          />
        ),
      })),
    ],
  };
}

interface Props {
  params: Promise<{ id: string }>;
}

export default function EditarEmpresaPage({ params }: Props) {
  const { id } = use(params);
  const { showMessage } = useMessageContext();
  const { token } = useAuth();
  const [slugCheckError, setSlugCheckError] = useState<string | null>(null);
  const [initialSlug, setInitialSlug] = useState<string | null>(null);

  useEffect(() => {
    async function fetchCompany() {
      try {
        const res = await fetch(`${API_URL}/companies/${id}`, {
          headers: { Authorization: `Bearer ${token}` },
        });
        const json = await res.json();
        if (json.data?.slug) {
          setInitialSlug(json.data.slug);
        }
      } catch {
        // Silencioso
      }
    }
    if (token && id) fetchCompany();
  }, [token, id]);

  const checkSlugUnique = useCallback(async (slug: string) => {
    if (!slug || slug.length < 2) return;
    if (slug === initialSlug) {
      setSlugCheckError(null);
      return;
    }
    try {
      const res = await fetch(`${API_URL}/companies/check-slug/${slug.toLowerCase().trim()}`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      const json = await res.json();
      if (!json.data?.available) {
        setSlugCheckError('Esta slug já está em uso');
      } else {
        setSlugCheckError(null);
      }
    } catch {
      setSlugCheckError(null);
    }
  }, [token, initialSlug]);

  const steps: FormStep[] = useMemo(() => [
    {
      title: 'Identificação',
      icon: <Building2 size={20} />,
      fields: [
        {
          field: 'name',
          label: 'Nome interno',
          type: 'text',
          required: true,
          placeholder: 'Ex: Nairim Holding',
          icon: <Building2 size={20} />,
          validation: { minLength: 2, maxLength: 100 },
          className: 'col-span-full',
        },
        {
          field: 'slug',
          label: 'Slug (URL: /slug/login)',
          type: 'text',
          required: true,
          placeholder: 'Ex: nairim-holding',
          icon: <Globe size={20} />,
          validation: {
            minLength: 2,
            maxLength: 60,
            pattern: /^[a-z0-9-]+$/,
            patternMessage: 'Apenas letras minúsculas, números e hífens',
            custom: () => slugCheckError,
          },
          onBlur: async (value: string) => checkSlugUnique(value),
          className: 'col-span-full',
        },
        {
          field: 'is_active',
          label: 'Empresa ativa',
          type: 'boolean',
          defaultValue: true,
          icon: <ToggleLeft size={20} />,
          className: 'col-span-full',
        },
      ],
    },
    {
      title: 'Geral',
      icon: <Type size={20} />,
      fields: [
        { field: 'company_name', label: 'Nome exibido na interface', type: 'text', placeholder: 'Ex: Nairim Holding', className: 'col-span-full' },
        { field: 'trade_name', label: 'Nome fantasia', type: 'text', placeholder: 'Ex: Nairim Imóveis', className: 'col-span-full' },
        { field: 'app_title', label: 'Título da aplicação (aba do navegador)', type: 'text', placeholder: 'Ex: Nairim — Gestão Imobiliária', className: 'col-span-full' },
        { field: 'app_description', label: 'Descrição (meta description / compartilhamento)', type: 'textarea', placeholder: 'Breve descrição da plataforma', className: 'col-span-full' },
      ],
    },
    {
      title: 'Branding',
      icon: <ImageIcon size={20} />,
      fields: [
        {
          field: 'logo_url',
          label: '',
          type: 'custom',
          className: 'col-span-1',
          render: (value, _fv, onChange) => (
            <AssetUploader label="Logo principal" hint="PNG, JPG, SVG ou WebP — até 5MB" endpoint={`/company/branding/logo`} currentUrl={value || null} onUploaded={url => onChange?.(url)} />
          ),
        },
        {
          field: 'logo_sidebar_url',
          label: '',
          type: 'custom',
          className: 'col-span-1',
          render: (value, _fv, onChange) => (
            <AssetUploader label="Logo da sidebar" hint="Usado no menu lateral — opcional, usa o logo principal se vazio" endpoint={`/company/branding/logo-sidebar`} currentUrl={value || null} onUploaded={url => onChange?.(url)} />
          ),
        },
        {
          field: 'logo_dark_url',
          label: '',
          type: 'custom',
          className: 'col-span-1',
          render: (value, _fv, onChange) => (
            <AssetUploader label="Logo modo escuro" hint="Exibido quando o tema escuro está ativo" endpoint={`/company/branding/logo-dark`} currentUrl={value || null} onUploaded={url => onChange?.(url)} />
          ),
        },
        {
          field: 'favicon_url',
          label: '',
          type: 'custom',
          className: 'col-span-1',
          render: (value, _fv, onChange) => (
            <AssetUploader label="Favicon" hint="Ícone exibido na aba do navegador — até 5MB" endpoint={`/company/branding/favicon`} currentUrl={value || null} onUploaded={url => onChange?.(url)} previewClassName="w-16 h-16" />
          ),
        },
        {
          field: 'og_image_url',
          label: '',
          type: 'custom',
          className: 'col-span-1',
          render: (value, _fv, onChange) => (
            <AssetUploader label="Imagem OG / redes sociais" hint="Exibida ao compartilhar links — recomendado 1200x630px, até 10MB" endpoint={`/company/branding/og-image`} currentUrl={value || null} onUploaded={url => onChange?.(url)} previewClassName="w-48 h-28" />
          ),
        },
      ],
    },
    colorStep('Tema Light', <Sun size={20} />, ''),
    colorStep('Tema Dark', <Moon size={20} />, '_dark'),
    {
      title: 'Preview',
      icon: <Eye size={20} />,
      fields: [
        {
          field: '__preview',
          label: '',
          type: 'custom',
          className: 'col-span-full',
          render: (_value, formValues) => (
            <BrandingPreview
              branding={{
                ...Object.fromEntries(ALL_BRANDING_FIELDS.map(key => [key, formValues?.[key] || null])),
                company_info: null,
              } as unknown as CompanyBranding}
            />
          ),
        },
      ],
    },
  ], [id]);

  function transformData(d: any) {
    const branding = d?.branding ?? {};
    const result: Record<string, any> = {
      name: d?.name ?? '',
      slug: d?.slug ?? '',
      is_active: d?.is_active ?? true,
    };
    for (const key of ALL_BRANDING_FIELDS) {
      result[key] = branding?.[key] ?? '';
    }
    return result;
  }

  async function handleSubmit(data: any) {
    const payload: Record<string, any> = {
      name: data.name,
      slug: data.slug?.toLowerCase().trim(),
      is_active: data.is_active,
    };
    for (const key of ALL_BRANDING_FIELDS) {
      if (data[key]) payload[key] = data[key];
    }

    const res = await fetch(`${API_URL}/companies/${id}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });
    const json = await res.json();
    if (!res.ok) throw new Error(json.message ?? `Erro ${res.status}`);
    return json;
  }

  return (
    <SuperAdminOnly>
      <DynamicFormManager
        resource="companies"
        title="Empresa"
        basePath="/dashboard/empresas"
        mode="edit"
        id={id}
        steps={steps}
        onSubmit={handleSubmit}
        onSubmitSuccess={() => showMessage('Empresa atualizada com sucesso!', 'success')}
        transformData={transformData}
      />
    </SuperAdminOnly>
  );
}
