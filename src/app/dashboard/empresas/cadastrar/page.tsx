'use client';

import { useMemo, useState, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { useMessageContext } from '@/contexts';
import { useAuth } from '@/contexts/AuthContext';
import DynamicFormManager from '@/components/form/DynamicForm';
import ColorInput from '@/components/admin/WhiteLabel/ColorInput';
import SuperAdminOnly from '@/components/protections/SuperAdminOnly';
import type { FormStep } from '@/types/types';
import { Building2, Globe, Type, Sun, Moon } from 'lucide-react';

const API_URL = process.env.NEXT_PUBLIC_URL_API ?? '';

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
  ...COLOR_FIELDS.map(c => c.key),
  ...COLOR_FIELDS.map(c => `${c.key}_dark`),
];

function colorStep(title: string, icon: React.ReactNode, suffix: ''  | '_dark', helperText?: string): FormStep {
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
        render: (value: any, _fv: any, onChange?: (v: any) => void) => (
          <ColorInput value={value ?? ''} onChange={v => onChange?.(v)} defaultValue={defaultValue} />
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

  const checkSlugUnique = useCallback(async (slug: string) => {
    if (!slug || slug.length < 2) return;
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
    } catch (error) {
      setSlugCheckError(null);
    }
  }, [token]);

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

  const handleFieldChange = useCallback(async (fieldName: string, value: any) => {
    if (fieldName === 'name') {
      if (value) {
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
    colorStep('Tema Light', <Sun size={20} />, ''),
    colorStep('Tema Dark', <Moon size={20} />, '_dark'),
  ], []);

  // Uploads de logo/favicon/etc. exigem um company_id existente — por isso ficam
  // disponíveis na tela de edição, aberta automaticamente após a criação. Todos
  // os demais campos de identidade visual (textos e paletas) já são coletados aqui,
  // pois o backend aceita esses dados diretamente na criação da empresa.
  async function handleSubmit(data: any) {
    const payload: Record<string, any> = {
      name: data.name,
      slug: data.slug?.toLowerCase().trim(),
    };
    for (const key of BRANDING_FIELD_KEYS) {
      if (data[key]) payload[key] = data[key];
    }

    const res = await fetch(`${API_URL}/companies`, {
      method: 'POST',
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
