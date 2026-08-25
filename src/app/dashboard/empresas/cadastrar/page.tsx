'use client';

import { useMemo, useState, useCallback, useRef } from 'react';
import { useRouter } from 'next/navigation';
import { useMessageContext } from '@/contexts';
import { useAuth } from '@/contexts/AuthContext';
import DynamicFormManager from '@/components/form/DynamicForm';
import ColorInput from '@/components/admin/WhiteLabel/ColorInput';
import SuperAdminOnly from '@/components/protections/SuperAdminOnly';
import type { FormStep } from '@/types/types';
import { Building2, Globe, Type, Sun, Moon, Database, MapPin } from 'lucide-react';
import { COMPANY_IDENTITY_FIELDS, COMPANY_IDENTITY_FIELD_KEYS } from '@/lib/companyIdentity';
import { generateDarkColorsFromLight } from '@/lib/colorUtils';
import { createCompanyAction, checkSlugAction } from '@/server/actions/company';

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

const BRANDING_FIELD_KEYS = [
  'company_name', 'trade_name', 'app_title', 'app_description',
  ...COMPANY_IDENTITY_FIELD_KEYS,
  ...COLOR_FIELDS.map(c => c.key),
  ...COLOR_FIELDS.map(c => `${c.key}_dark`),
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

function colorStep(
  title: string,
  icon: React.ReactNode,
  suffix: '' | '_dark',
  helperText?: string
): FormStep {
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
        // Step dark não tem defaultValue pois será preenchido automaticamente
        defaultValue: suffix === '_dark' ? undefined : defaultValue,
        render: (
          value: unknown,
          _fv: unknown,
          onChange?: (value: unknown) => void,
        ) => (
          <ColorInput
            value={typeof value === 'string' ? value : ''}
            onChange={v => onChange?.(v)}
            defaultValue={suffix === '_dark' ? undefined : defaultValue}
          />
        ),
      })),
    ],
  };
}

export default function CadastrarEmpresaPage() {
  const { showMessage } = useMessageContext();
  const { token } = useAuth();
  const router = useRouter();
  const [slugCheckError, setSlugCheckError] = useState<string | null>(null);
  const lastSuggestedDarkColors = useRef<Record<string, string>>({});

  const checkSlugUnique = useCallback(async (slug: string) => {
    if (!slug || slug.length < 2) return;
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
  }, []);

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
    // Step 2 é o "Tema Light" (índice 2: Identificação, Geral, Tema Light, Tema Dark)
    if (stepIndex !== 2) return;

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
          label: 'Nome interno (identificação no sistema)',
          type: 'text',
          required: true,
          placeholder: 'Ex: Nairim Holding',
          autoFocus: true,
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
          onBlur: (value: string) => checkSlugUnique(value),
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
      ],
    },
    {
      title: 'Geral',
      icon: <Type size={20} />,
      fields: [
        {
          field: 'company_name',
          label: 'Nome exibido na interface',
          type: 'text',
          placeholder: 'Ex: Nairim Holding',
          className: 'col-span-full',
        },
        {
          field: 'trade_name',
          label: 'Nome fantasia',
          type: 'text',
          placeholder: 'Ex: Nairim Imóveis',
          className: 'col-span-full',
        },
        {
          field: 'app_title',
          label: 'Título da aplicação (aba do navegador)',
          type: 'text',
          placeholder: 'Ex: Nairim — Gestão Imobiliária',
          className: 'col-span-full',
        },
        {
          field: 'app_description',
          label: 'Descrição (meta description / compartilhamento)',
          type: 'textarea',
          placeholder: 'Breve descrição da plataforma',
          className: 'col-span-full',
        },
      ],
    },
    {
      // Identidade jurídica + endereço: alimentam o cabeçalho dos relatórios
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
              Usados no cabeçalho dos relatórios impressos e exportados.
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
    colorStep('Tema Light', <Sun size={20} />, ''),
    colorStep('Tema Dark', <Moon size={20} />, '_dark'),
  ], [checkSlugUnique, slugCheckError]);

  // Uploads de logo/favicon/etc. exigem um company_id existente — por isso ficam
  // disponíveis na tela de edição, aberta automaticamente após a criação. Todos
  // os demais campos de identidade visual (textos e paletas) já são coletados aqui,
  // pois o backend aceita esses dados diretamente na criação da empresa.
  async function handleSubmit(data: Record<string, unknown>) {
    const payload: Record<string, unknown> = {
      name: data.name,
      slug: typeof data.slug === 'string' ? data.slug.toLowerCase().trim() : data.slug,
      // Em branco vai como null: a empresa usa o limite padrão do ambiente.
      db_quota_mb:
        data.db_quota_mb === '' || data.db_quota_mb === null || data.db_quota_mb === undefined
          ? null
          : Number(data.db_quota_mb),
    };
    for (const key of BRANDING_FIELD_KEYS) {
      if (data[key]) payload[key] = data[key];
    }

    const result = await createCompanyAction(payload);
    if (!result.ok) throw new Error(result.error ?? `Erro ${result.status}`);
    return result;
  }

  return (
    <SuperAdminOnly>
      <DynamicFormManager
        resource="companies"
        title="Empresa"
        basePath="/dashboard/empresas"
        mode="create"
        steps={steps}
        onSubmit={handleSubmit}
        onFieldChange={handleFieldChange}
        onStepComplete={handleStepComplete}
        onSubmitSuccess={(result) => {
          showMessage('Empresa criada! Configurando marca...', 'success');
          const id = result?.id ?? result?.data?.id;
          router.push(id ? `/dashboard/empresas/editar/${id}?new=true` : '/dashboard/empresas');
        }}
        transformData={(d) => d}
      />
    </SuperAdminOnly>
  );
}
