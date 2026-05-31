'use client';

import { use, useMemo } from 'react';
import { useRouter } from 'next/navigation';
import { useMessageContext } from '@/contexts';
import DynamicFormManager from '@/components/form/DynamicForm';
import type { FormStep } from '@/types/types';
import { Building2, Globe, Palette, Image, Type, ToggleLeft } from 'lucide-react';

const API_URL = process.env.NEXT_PUBLIC_URL_API ?? '';

function ColorInput({ value, onChange }: { value: string; onChange: (v: string) => void }) {
  return (
    <div className="flex items-center gap-3">
      <input
        type="color"
        value={value || '#8b5cf6'}
        onChange={e => onChange(e.target.value)}
        className="w-10 h-10 rounded-lg cursor-pointer border border-ui-border"
      />
      <input
        type="text"
        value={value || ''}
        onChange={e => onChange(e.target.value)}
        placeholder="#8b5cf6"
        maxLength={7}
        className="flex-1 h-[46px] text-content bg-surface border border-ui-border rounded-lg px-3 text-sm focus:outline-none focus:border-brand"
      />
    </div>
  );
}

interface Props {
  params: Promise<{ id: string }>;
}

export default function EditarEmpresaPage({ params }: Props) {
  const { id } = use(params);
  const { showMessage } = useMessageContext();
  const router = useRouter();

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
          },
          className: 'col-span-full',
        },
        {
          field: 'company_name',
          label: 'Nome exibido na interface',
          type: 'text',
          placeholder: 'Ex: Nairim Holding',
          icon: <Type size={20} />,
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
      title: 'Identidade Visual',
      icon: <Palette size={20} />,
      fields: [
        {
          field: 'primary_color',
          label: 'Cor primária',
          type: 'custom',
          render: (value, _fv, onChange) => (
            <ColorInput value={value ?? ''} onChange={v => onChange?.(v)} />
          ),
          className: 'col-span-1',
        },
        {
          field: 'secondary_color',
          label: 'Cor secundária',
          type: 'custom',
          render: (value, _fv, onChange) => (
            <ColorInput value={value ?? ''} onChange={v => onChange?.(v)} />
          ),
          className: 'col-span-1',
        },
        {
          field: 'logo_url',
          label: 'URL do logo',
          type: 'text',
          placeholder: 'https://exemplo.com/logo.svg',
          icon: <Image size={20} />,
          className: 'col-span-full',
        },
        {
          field: 'favicon_url',
          label: 'URL do favicon',
          type: 'text',
          placeholder: 'https://exemplo.com/favicon.svg',
          icon: <Image size={20} />,
          className: 'col-span-full',
        },
      ],
    },
  ], []);

  async function handleSubmit(data: any) {
    const res = await fetch(`${API_URL}/company/${id}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        name: data.name,
        slug: data.slug?.toLowerCase().trim(),
        is_active: data.is_active,
        company_name: data.company_name || undefined,
        primary_color: data.primary_color || undefined,
        secondary_color: data.secondary_color || undefined,
        logo_url: data.logo_url || undefined,
        favicon_url: data.favicon_url || undefined,
      }),
    });
    const json = await res.json();
    if (!res.ok) throw new Error(json.message ?? `Erro ${res.status}`);
    return json;
  }

  // Normaliza a resposta para preencher o formulário com dados de company + branding
  function transformResponse(d: any) {
    const company = d?.data ?? d;
    return {
      name: company.name ?? '',
      slug: company.slug ?? '',
      is_active: company.is_active ?? true,
      company_name: company.branding?.company_name ?? '',
      primary_color: company.branding?.primary_color ?? '',
      secondary_color: company.branding?.secondary_color ?? '',
      logo_url: company.branding?.logo_url ?? '',
      favicon_url: company.branding?.favicon_url ?? '',
    };
  }

  return (
    <DynamicFormManager
      resource="company"
      title="Empresa"
      basePath="/dashboard/empresas"
      mode="edit"
      id={id}
      steps={steps}
      onSubmit={handleSubmit}
      onSubmitSuccess={() => {
        showMessage('Empresa atualizada com sucesso!', 'success');
        router.push('/dashboard/empresas');
      }}
      transformData={(d) => d}
      transformResponse={transformResponse}
    />
  );
}
