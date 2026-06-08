'use client';

import { useEffect, useMemo, useState } from 'react';
import { useParams } from 'next/navigation';
import { Loader2, Building2, Globe, ToggleLeft } from 'lucide-react';
import DynamicFormManager from '@/components/form/DynamicForm';
import SuperAdminOnly from '@/components/protections/SuperAdminOnly';
import { BrandingPreview } from '@/components/admin/WhiteLabel/WhiteLabelManager';
import { useAuth } from '@/contexts/AuthContext';
import type { FormStep } from '@/types/types';
import type { CompanyBranding } from '@/types/branding';

const API_URL = process.env.NEXT_PUBLIC_URL_API ?? '';

export default function VisualizarEmpresaPage() {
  const params = useParams();
  const id = params.id as string;
  const { token } = useAuth();

  const [branding, setBranding] = useState<CompanyBranding | null>(null);
  const [companyName, setCompanyName] = useState('');
  const [loadingBranding, setLoadingBranding] = useState(true);

  useEffect(() => {
    let cancelled = false;
    async function load() {
      if (!token || !id) return;
      try {
        const res = await fetch(`${API_URL}/companies/${id}`, {
          headers: { Authorization: `Bearer ${token}` },
        });
        const json = await res.json();
        if (!res.ok) throw new Error(json?.message ?? `Erro ${res.status}`);
        if (!cancelled) {
          setBranding(json?.data?.branding ?? null);
          setCompanyName(json?.data?.name ?? '');
        }
      } catch {
        // Silencioso — a seção de Identificação abaixo já trata erros de carregamento.
      } finally {
        if (!cancelled) setLoadingBranding(false);
      }
    }
    load();
    return () => { cancelled = true; };
  }, [token, id]);

  const steps: FormStep[] = useMemo(() => [
    {
      title: 'Identificação',
      icon: <Building2 size={20} />,
      fields: [
        {
          field: 'name',
          label: 'Nome interno',
          type: 'text',
          icon: <Building2 size={20} />,
          className: 'col-span-full',
          readOnly: true,
        },
        {
          field: 'slug',
          label: 'Slug (URL: /slug/login)',
          type: 'text',
          icon: <Globe size={20} />,
          className: 'col-span-full',
          readOnly: true,
        },
        {
          field: 'is_active',
          label: 'Empresa ativa',
          type: 'boolean',
          icon: <ToggleLeft size={20} />,
          className: 'col-span-full',
          readOnly: true,
        },
      ],
    },
  ], []);

  return (
    <SuperAdminOnly>
      {/* [&>section]:min-h-0 evita o vão em branco causado pelo min-h-screen do
          <Section> interno do DynamicFormManager quando empilhado com outro bloco. */}
      <div className="flex flex-col gap-8 [&>section]:min-h-0">
        <DynamicFormManager
          resource="companies"
          title="Empresa"
          basePath="/dashboard/empresas"
          mode="view"
          id={id}
          steps={steps}
          transformData={(d) => ({
            name: d?.name ?? '',
            slug: d?.slug ?? '',
            is_active: d?.is_active ?? true,
          })}
        />

        <div className="bg-surface border border-ui-border rounded-xl p-5 flex flex-col gap-4">
          <div>
            <h2 className="text-lg font-semibold text-content">Identidade Visual</h2>
            <p className="text-sm text-content-muted">
              Pré-visualização do branding configurado para {companyName || 'esta empresa'}.
            </p>
          </div>
          {loadingBranding ? (
            <div className="flex items-center justify-center py-12 text-content-muted gap-2">
              <Loader2 size={20} className="animate-spin" />
              Carregando identidade visual...
            </div>
          ) : branding ? (
            <BrandingPreview branding={branding} />
          ) : (
            <p className="text-sm text-content-muted py-8 text-center">
              Esta empresa ainda não possui identidade visual configurada.
            </p>
          )}
        </div>
      </div>
    </SuperAdminOnly>
  );
}
