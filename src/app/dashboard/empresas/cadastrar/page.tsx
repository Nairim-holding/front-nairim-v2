'use client';

import { useMemo } from 'react';
import { useRouter } from 'next/navigation';
import { useMessageContext } from '@/contexts';
import DynamicFormManager from '@/components/form/DynamicForm';
import type { FormStep } from '@/types/types';
import { Building2, Globe } from 'lucide-react';

const API_URL = process.env.NEXT_PUBLIC_URL_API ?? '';

export default function CadastrarEmpresaPage() {
  const { showMessage } = useMessageContext();
  const router = useRouter();

  const steps: FormStep[] = useMemo(() => [
    {
      title: 'Dados da Empresa',
      icon: <Building2 size={20} />,
      fields: [
        {
          field: 'name',
          label: 'Nome da Empresa',
          type: 'text',
          required: true,
          placeholder: 'Ex: Nairim Holding',
          autoFocus: true,
          icon: <Building2 size={20} />,
          validation: { minLength: 2, maxLength: 100 },
          maxLength: 100,
          className: 'col-span-full',
        },
        {
          field: 'slug',
          label: 'Slug (identificador único na URL)',
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
          maxLength: 60,
          className: 'col-span-full',
        },
      ],
    },
  ], []);

  async function handleSubmit(data: any) {
    const res = await fetch(`${API_URL}/company`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name: data.name, slug: data.slug.toLowerCase().trim() }),
    });
    const json = await res.json();
    if (!res.ok) throw new Error(json.message ?? `Erro ${res.status}`);
    return json;
  }

  return (
    <DynamicFormManager
      resource="company"
      title="Empresa"
      basePath="/dashboard/empresas"
      mode="create"
      steps={steps}
      onSubmit={handleSubmit}
      onSubmitSuccess={() => {
        showMessage('Empresa criada com sucesso!', 'success');
        router.push('/dashboard/empresas');
      }}
      transformData={(d) => d}
    />
  );
}
