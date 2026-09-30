'use client';

import { useMemo, useState, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { useMessageContext } from '@/contexts';
import DynamicFormManager from '@/components/form/DynamicForm';
import { companyThemeStep } from '@/components/admin/WhiteLabel/themeFields';
import { BRANDING_COLOR_KEYS } from '@/lib/brandingTheme';
import SuperAdminOnly from '@/components/protections/SuperAdminOnly';
import type { FormStep } from '@/types/types';
import { Building2, Globe, Type, Database, MapPin } from 'lucide-react';
import { COMPANY_IDENTITY_FIELDS, COMPANY_IDENTITY_FIELD_KEYS } from '@/lib/companyIdentity';
import { createCompanyAction, checkSlugAction } from '@/server/actions/company';

const BRANDING_FIELD_KEYS = [
  'company_name', 'trade_name', 'app_title', 'app_description',
  ...COMPANY_IDENTITY_FIELD_KEYS,
  ...BRANDING_COLOR_KEYS,
];

const IDENTITY_SPAN_CLASS: Record<'full' | 'half' | 'third', string> = {
  full: 'col-span-full',
  half: 'col-span-full sm:col-span-6',
  third: 'col-span-full sm:col-span-4',
};

export default function CadastrarEmpresaPage() {
  const { showMessage } = useMessageContext();
  const router = useRouter();
  const [slugCheckError, setSlugCheckError] = useState<string | null>(null);

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
          placeholder: 'Em branco = sem limite de banco de dados',
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
          // basis-full: força este item a ocupar a linha inteira no layout
          // flex-wrap do formulário — "col-span-full" não tem efeito aqui,
          // é classe de CSS Grid e o container é flex.
          className: 'basis-full w-full',
          render: () => (
            <p className="text-xs text-content-muted mb-2">
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
    companyThemeStep(),
  ], [checkSlugUnique, slugCheckError]);

  // Uploads de logo/favicon/etc. exigem um company_id existente — por isso ficam
  // disponíveis na tela de edição, aberta automaticamente após a criação. Todos
  // os demais campos de identidade visual (textos e paletas) já são coletados aqui,
  // pois o backend aceita esses dados diretamente na criação da empresa.
  async function handleSubmit(data: Record<string, unknown>) {
    const payload: Record<string, unknown> = {
      name: data.name,
      slug: typeof data.slug === 'string' ? data.slug.toLowerCase().trim() : data.slug,
      // Em branco vai como null: a empresa fica sem limite de banco de dados.
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
