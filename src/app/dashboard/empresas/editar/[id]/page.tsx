'use client';

import { use, useMemo, useState, useCallback, useEffect, useRef } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { useMessageContext } from '@/contexts';
import DynamicFormManager from '@/components/form/DynamicForm';
import ColorInput from '@/components/admin/WhiteLabel/ColorInput';
import AssetUploader from '@/components/admin/WhiteLabel/AssetUploader';
import SuperAdminOnly from '@/components/protections/SuperAdminOnly';
import { BrandingPreview } from '@/components/admin/WhiteLabel/WhiteLabelManager';
import type { FormStep } from '@/types/types';
import type { CompanyBranding } from '@/types/branding';
import { Building2, Globe, ToggleLeft, Type, Sun, Moon, Image as ImageIcon, Eye, Database, MapPin } from 'lucide-react';
import { COMPANY_IDENTITY_FIELDS, COMPANY_IDENTITY_FIELD_KEYS } from '@/lib/companyIdentity';
import { generateDarkColorsFromLight } from '@/lib/colorUtils';
import { getCompanyByIdAction, updateCompanyAction, checkSlugAction } from '@/server/actions/company';

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
const ALL_BRANDING_FIELDS = [
  ...BRANDING_TEXT_FIELDS,
  ...COMPANY_IDENTITY_FIELD_KEYS,
  ...BRANDING_ASSET_FIELDS,
  ...BRANDING_COLOR_FIELDS,
];

const IDENTITY_SPAN_CLASS: Record<'full' | 'half' | 'third', string> = {
  full: 'col-span-full',
  half: 'col-span-full sm:col-span-6',
  third: 'col-span-full sm:col-span-4',
};

const isEmptyColorValue = (value: unknown): boolean => (
  value === undefined ||
  value === null ||
  value === '' ||
  (Array.isArray(value) && value.length === 0)
);

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
        defaultValue: suffix === '_dark' ? undefined : defaultValue,
        render: (
          value: unknown,
          formValues: Record<string, unknown> | undefined,
          onChange?: (value: unknown) => void,
        ) => (
          <ColorInput
            value={typeof value === 'string' ? value : ''}
            onChange={v => onChange?.(v)}
            defaultValue={
              suffix === '_dark' && typeof formValues?.[key] === 'string'
                ? formValues[key]
                : defaultValue
            }
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
  const router = useRouter();
  const searchParams = useSearchParams();
  const { showMessage } = useMessageContext();
  const [slugCheckError, setSlugCheckError] = useState<string | null>(null);
  const [initialSlug, setInitialSlug] = useState<string | null>(null);
  const defaultStep = searchParams?.get('new') === 'true' ? 2 : 0;
  const lastSuggestedDarkColors = useRef<Record<string, string>>({});

  useEffect(() => {
    async function fetchCompany() {
      try {
        const result = await getCompanyByIdAction(id);
        if (result.ok && result.data?.slug) {
          setInitialSlug(result.data.slug);
        }
      } catch {
        // Silencioso
      }
    }
    if (id) fetchCompany();
  }, [id]);

  const checkSlugUnique = useCallback(async (slug: string) => {
    if (!slug || slug.length < 2) return;
    if (slug === initialSlug) {
      setSlugCheckError(null);
      return;
    }
    try {
      const result = await checkSlugAction(slug.toLowerCase().trim());
      if (!result.ok || !result.data?.available) {
        setSlugCheckError('Esta slug já está em uso');
      } else {
        setSlugCheckError(null);
      }
    } catch {
      setSlugCheckError(null);
    }
  }, [initialSlug]);

  const generateSlug = useCallback((name: string): string => {
    return name
      .toLowerCase()
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .replace(/[^a-z0-9\s-]/g, '')
      .trim()
      .replace(/\s+/g, '-')
      .replace(/-+/g, '-');
  }, []);

  const handleFieldChange = useCallback(async (fieldName: string, value: unknown) => {
    if (fieldName === 'name') {
      if (typeof value === 'string' && value) {
        return { slug: generateSlug(value) };
      } else {
        return { slug: '' };
      }
    }
    return null;
  }, [generateSlug]);

  const handleStepComplete = useCallback((stepIndex: number, formValues: Record<string, unknown>) => {
    // Step 3 é o "Tema Light" na edição: Identificação, Geral, Branding, Tema Light, Tema Dark, Preview.
    if (stepIndex !== 3) return;

    const lightColors: Record<string, string> = {};
    COLOR_FIELDS.forEach(({ key }) => {
      const value = formValues[key];
      if (typeof value === 'string' && value) {
        lightColors[key] = value;
      }
    });

    const generatedDarkColors = generateDarkColorsFromLight(lightColors);
    const suggestedPatch: Record<string, string> = {};

    for (const [field, suggestedColor] of Object.entries(generatedDarkColors)) {
      const currentValue = formValues[field];
      const previousSuggestion = lastSuggestedDarkColors.current[field];

      if (isEmptyColorValue(currentValue) || currentValue === previousSuggestion) {
        suggestedPatch[field] = suggestedColor;
      }
    }

    lastSuggestedDarkColors.current = generatedDarkColors;

    if (Object.keys(suggestedPatch).length > 0) {
      showMessage('Cores do tema dark sugeridas com base nas cores light!', 'info');
      return suggestedPatch;
    }
  }, [showMessage]);

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
          field: 'db_quota_mb',
          label: 'Limite de banco de dados (MB)',
          type: 'number',
          placeholder: 'Em branco = limite padrão do sistema',
          icon: <Database size={20} />,
          showIncrementButtons: false,
          validation: {
            custom: (value: unknown) => {
              if (value === '' || value === null || value === undefined) return null;
              const parsed = Number(value);
              if (!Number.isInteger(parsed) || parsed <= 0) {
                return 'Informe um número inteiro de MB maior que zero';
              }
              return null;
            },
          },
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
      // Identidade juridica + endereco: alimentam o cabecalho dos relatorios
      // impressos/exportados.
      title: 'Dados da Empresa',
      icon: <MapPin size={20} />,
      fields: [
        {
          field: '__helper_identity',
          label: '',
          type: 'custom' as const,
          className: 'col-span-full',
          render: () => (
            <p className="text-xs text-content-muted -mt-2">
              Usados no cabecalho dos relatorios impressos e exportados.
            </p>
          ),
        },
        ...COMPANY_IDENTITY_FIELDS.map(({ field, label, placeholder, span, maxLength }) => ({
          field,
          label,
          type: 'text' as const,
          placeholder,
          className: IDENTITY_SPAN_CLASS[span],
          full: span === 'full',
          ...(maxLength ? { validation: { maxLength } } : {}),
        })),
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
            <AssetUploader label="Logo principal" hint="PNG, JPG, SVG ou WebP — até 5MB" field="logo_url" companyId={id} currentUrl={value || null} onUploaded={url => onChange?.(url)} />
          ),
        },
        {
          field: 'logo_sidebar_url',
          label: '',
          type: 'custom',
          className: 'col-span-1',
          render: (value, _fv, onChange) => (
            <AssetUploader label="Logo da sidebar" hint="Usado no menu lateral — opcional, usa o logo principal se vazio" field="logo_sidebar_url" companyId={id} currentUrl={value || null} onUploaded={url => onChange?.(url)} />
          ),
        },
        {
          field: 'logo_dark_url',
          label: '',
          type: 'custom',
          className: 'col-span-1',
          render: (value, _fv, onChange) => (
            <AssetUploader label="Logo modo escuro" hint="Exibido quando o tema escuro está ativo" field="logo_dark_url" companyId={id} currentUrl={value || null} onUploaded={url => onChange?.(url)} />
          ),
        },
        {
          field: 'favicon_url',
          label: '',
          type: 'custom',
          className: 'col-span-1',
          render: (value, _fv, onChange) => (
            <AssetUploader label="Favicon" hint="Ícone exibido na aba do navegador — até 5MB" field="favicon_url" companyId={id} currentUrl={value || null} onUploaded={url => onChange?.(url)} previewClassName="w-16 h-16" />
          ),
        },
        {
          field: 'og_image_url',
          label: '',
          type: 'custom',
          className: 'col-span-1',
          render: (value, _fv, onChange) => (
            <AssetUploader label="Imagem OG / redes sociais" hint="Exibida ao compartilhar links — recomendado 1200x630px, até 10MB" field="og_image_url" companyId={id} currentUrl={value || null} onUploaded={url => onChange?.(url)} previewClassName="w-48 h-28" />
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
  ], [checkSlugUnique, slugCheckError]);

  // `useCallback`: está nas dependências do useEffect de fetch do
  // DynamicForm — sem memoizar, disparava refetch em loop a cada render.
  const transformData = useCallback((d: Record<string, unknown>) => {
    const branding = d?.branding && typeof d.branding === 'object'
      ? d.branding as Record<string, unknown>
      : {};
    const result: Record<string, unknown> = {
      name: d?.name ?? '',
      slug: d?.slug ?? '',
      is_active: d?.is_active ?? true,
      // Sem limite próprio, o campo fica vazio (usa o padrão do ambiente) —
      // não zero, que o backend rejeitaria como cota inválida.
      db_quota_mb: d?.db_quota_mb ?? '',
    };
    for (const key of ALL_BRANDING_FIELDS) {
      result[key] = branding?.[key] ?? '';
    }
    return result;
  }, []);

  async function handleSubmit(data: Record<string, unknown>) {
    const payload: Record<string, unknown> = {
      name: data.name,
      slug: typeof data.slug === 'string' ? data.slug.toLowerCase().trim() : data.slug,
      is_active: data.is_active,
      // Em branco vai como null: a empresa volta ao limite padrão do ambiente.
      db_quota_mb:
        data.db_quota_mb === '' || data.db_quota_mb === null || data.db_quota_mb === undefined
          ? null
          : Number(data.db_quota_mb),
    };
    for (const key of ALL_BRANDING_FIELDS) {
      if (data[key]) payload[key] = data[key];
    }

    const result = await updateCompanyAction(id, payload);
    if (!result.ok) throw new Error(result.error ?? `Erro ${result.status}`);
    return result;
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
        fetchResource={getCompanyByIdAction}
        onSubmit={handleSubmit}
        onFieldChange={handleFieldChange}
        onStepComplete={handleStepComplete}
        onSubmitSuccess={() => {
          showMessage('Empresa atualizada com sucesso!', 'success');
          router.push('/dashboard/empresas');
        }}
        transformData={transformData}
        defaultStep={defaultStep}
      />
    </SuperAdminOnly>
  );
}
