'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { useParams } from 'next/navigation';
import { Loader2, Building2, Globe, ToggleLeft } from 'lucide-react';
import DynamicFormManager from '@/components/form/DynamicForm';
import SuperAdminOnly from '@/components/protections/SuperAdminOnly';
import { BrandingPreview } from '@/components/admin/WhiteLabel/WhiteLabelManager';
import type { FormStep } from '@/types/types';
import type { CompanyBranding } from '@/types/branding';
import { getCompanyByIdAction } from '@/server/actions/company';
import { COMPANY_IDENTITY_FIELDS, formatCompanyAddress } from '@/lib/companyIdentity';

/** Componentes do endereço — exibidos juntos numa linha só, não individualmente. */
const ADDRESS_PART_FIELDS = new Set<string>([
  'zip_code', 'street', 'number', 'complement', 'district', 'city', 'state',
]);

export default function VisualizarEmpresaPage() {
  const params = useParams();
  const id = params.id as string;

  const [branding, setBranding] = useState<CompanyBranding | null>(null);
  const [companyName, setCompanyName] = useState('');
  const [loadingBranding, setLoadingBranding] = useState(true);

  useEffect(() => {
    let cancelled = false;
    async function load() {
      if (!id) return;
      try {
        const result = await getCompanyByIdAction(id);
        if (!result.ok) throw new Error(result.error ?? `Erro ${result.status}`);
        if (!cancelled) {
          setBranding((result.data?.branding as CompanyBranding | null) ?? null);
          setCompanyName(result.data?.name ?? '');
        }
      } catch {
        // Silencioso — a seção de Identificação abaixo já trata erros de carregamento.
      } finally {
        if (!cancelled) setLoadingBranding(false);
      }
    }
    load();
    return () => { cancelled = true; };
  }, [id]);

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

  // Só os campos preenchidos viram linha — empresa sem endereço não rende uma
  // lista de rótulos vazios.
  const identityRows = useMemo(() => {
    if (!branding) return [];

    const rows: { label: string; value: string }[] = [];
    for (const { field, label } of COMPANY_IDENTITY_FIELDS) {
      // O endereço é montado numa linha só logo abaixo; seus componentes
      // individuais não viram linha própria.
      if (ADDRESS_PART_FIELDS.has(field)) continue;
      const value = (branding[field] ?? '').trim();
      if (value) rows.push({ label, value });
    }

    const address = formatCompanyAddress(branding);
    if (address) rows.push({ label: 'Endereço', value: address });

    return rows;
  }, [branding]);

  // `useCallback`: está nas dependências do useEffect de fetch do
  // DynamicForm — sem memoizar, disparava refetch em loop a cada render.
  const transformData = useCallback((d: any) => ({
    name: d?.name ?? '',
    slug: d?.slug ?? '',
    is_active: d?.is_active ?? true,
  }), []);

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
          fetchResource={getCompanyByIdAction}
          transformData={transformData}
        />

        {/* Identidade jurídica + endereço do tenant — os mesmos dados que saem
            no cabeçalho dos relatórios impressos/exportados. */}
        <div className="bg-surface border border-ui-border rounded-xl p-5 flex flex-col gap-4">
          <div>
            <h2 className="text-lg font-semibold text-content">Dados da Empresa</h2>
            <p className="text-sm text-content-muted">
              Usados no cabeçalho dos relatórios impressos e exportados.
            </p>
          </div>
          {loadingBranding ? (
            <div className="flex items-center justify-center py-8 text-content-muted gap-2">
              <Loader2 size={20} className="animate-spin" />
              Carregando dados da empresa...
            </div>
          ) : identityRows.length > 0 ? (
            <dl className="grid grid-cols-1 sm:grid-cols-2 gap-x-6 gap-y-3">
              {identityRows.map(({ label, value }) => (
                <div key={label} className="flex flex-col gap-0.5 min-w-0">
                  <dt className="text-xs text-content-muted">{label}</dt>
                  <dd className="text-sm text-content break-words">{value}</dd>
                </div>
              ))}
            </dl>
          ) : (
            <p className="text-sm text-content-muted py-6 text-center">
              Nenhum dado cadastrado. Preencha em Editar &gt; Dados da Empresa para que apareçam
              no cabeçalho dos relatórios.
            </p>
          )}
        </div>

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
