/* eslint-disable @typescript-eslint/no-explicit-any */
"use client";

import { useParams, useRouter } from 'next/navigation';
import { useMemo, useState, useEffect, useCallback } from 'react';
import { useMessageContext } from '@/contexts/MessageContext';
import { usePopupContext } from '@/contexts/PopupContext';
import { authFetch } from '@/utils/authFetch';
import DynamicFormManager from '@/components/form/DynamicForm';
import GuarantorManager from '@/components/domain/guarantors/GuarantorManager';
import { FormStep } from '@/types/types';
import {
  FileText, Calendar, DollarSign, User, Building,
  Home, File, Percent, Calculator, Hash, AlertCircle, CreditCard, Shield, Users, Trash2
} from 'lucide-react';

const formatMoney = (value: number) => {
  if (!value && value !== 0) return 'R$ 0,00';
  return new Intl.NumberFormat('pt-BR', {
    style: 'currency',
    currency: 'BRL',
    minimumFractionDigits: 2,
    maximumFractionDigits: 2
  }).format(value);
};

export default function VisualizarLocacaoPage() {
  const params = useParams();
  const id = params.id as string;
  
  const { showMessage } = useMessageContext();
  const { showPopup } = usePopupContext();
  const router = useRouter();

  const [properties, setProperties] = useState<any[]>([]);
  const [tenants, setTenants] = useState<any[]>([]);
  const [loadingData, setLoadingData] = useState(true);
  const [isCanceled, setIsCanceled] = useState(false);

  const handlePermanentDelete = useCallback(() => {
    showPopup(
      'Excluir locação definitivamente',
      'Esta ação remove a locação E todos os lançamentos financeiros vinculados a ela. Não pode ser desfeita. Deseja continuar?',
      async () => {
        try {
          const res = await authFetch(`${process.env.NEXT_PUBLIC_URL_API}/leases/${id}/permanent`, {
            method: 'DELETE',
          });
          if (!res.ok) {
            const data = await res.json().catch(() => null);
            throw new Error(data?.message || 'Erro ao excluir locação');
          }
          showMessage('Locação excluída definitivamente com sucesso!', 'success');
          router.push('/dashboard/locacoes');
        } catch (e: any) {
          showMessage(e.message || 'Erro ao excluir locação', 'error');
        }
      },
      () => {}
    );
  }, [id, showPopup, showMessage, router]);

  useEffect(() => {
    const fetchData = async () => {
      try {
        const [propertiesRes, tenantsRes] = await Promise.all([
          fetch(`${process.env.NEXT_PUBLIC_URL_API}/properties?limit=50`),
          fetch(`${process.env.NEXT_PUBLIC_URL_API}/tenants`),
        ]);

        if (!propertiesRes.ok || !tenantsRes.ok) {
          throw new Error('Erro ao buscar dados');
        }

        const propertiesData = await propertiesRes.json();
        const tenantsData = await tenantsRes.json();

        setProperties(propertiesData.data || propertiesData || []);
        setTenants(tenantsData.data || tenantsData || []);
      } catch (_error) {
        showMessage('Erro ao carregar dados iniciais', 'error');
      } finally {
        setLoadingData(false);
      }
    };

    fetchData();
  }, [showMessage]);

  const handleFieldChange = useCallback(async () => {
    return null;
  }, []);

  const handleSubmit = async () => {
    router.push('/dashboard/locacoes');
  };

  const transformData = useCallback((apiData: any) => {
    if (!apiData) return {};
    
    if (apiData.status === 'CANCELED') {
      setIsCanceled(true);
    }
    
    const formatDate = (dateString: string) => {
      if (!dateString) return '';
      const date = new Date(dateString);
      return date.toISOString().split('T')[0];
    };

    const getPaymentConditionLabel = (val: string) => {
      switch (val) {
        case 'IN_FULL_15_DISCOUNT': return 'À vista';
        case 'SECOND_INSTALLMENT_10_DISCOUNT': return 'Segunda parcela';
        case 'INSTALLMENTS': return 'Parcelado';
        default: return val || '';
      }
    };
    
    return {
      contract_number: apiData.contract_number || '',
      start_date: formatDate(apiData.start_date),
      end_date: formatDate(apiData.end_date),
      property_id: apiData.property_id || '',
      type_id: apiData.type_id || '',
      owner_id: apiData.owner_id || '',
      type_display: apiData.property?.type?.description || apiData.type?.description || '',
      owner_display: apiData.property?.owner?.name || apiData.owner?.name || '',
      tenant_id: apiData.tenant_id || '',
      agency_display: apiData.agency?.trade_name || 'Nenhuma',
      financial_institution_display: apiData.financial_institution?.name || 'Nenhuma',
      category_display: apiData.property?.category?.name || 'Sem categoria',
      subcategory_display: apiData.property?.subcategory?.name || 'Sem subcategoria',
      center_display: apiData.property?.center?.name || 'Sem centro de custo',
      notes: apiData.notes || '',
      rent_amount: apiData.rent_amount ? formatMoney(apiData.rent_amount) : 'R$ 0,00',
      condo_fee: apiData.condo_fee ? formatMoney(apiData.condo_fee) : '',
      property_tax: apiData.property_tax ? formatMoney(apiData.property_tax) : '',
      extra_charges: apiData.extra_charges ? formatMoney(apiData.extra_charges) : '',
      agency_commission: apiData.agency_commission ? String(apiData.agency_commission) : '5',
      commission_amount: apiData.commission_amount ? formatMoney(apiData.commission_amount) : 'R$ 0,00',
      rent_due_day: apiData.rent_due_day ? String(apiData.rent_due_day) : '5',
      tax_due_day: apiData.tax_due_day ? String(apiData.tax_due_day) : '10',
      condo_due_day: apiData.condo_due_day ? String(apiData.condo_due_day) : '10',
      
      // Pagamento e Parcelas do IPTU
      payment_condition: apiData.payment_condition || '', // O valor original invisível
      payment_condition_label: getPaymentConditionLabel(apiData.payment_condition), // O label bonitinho
      property_tax_cash: apiData.property_tax_cash ? formatMoney(apiData.property_tax_cash) : '',
      property_tax_first_installment: apiData.property_tax_first_installment ? formatMoney(apiData.property_tax_first_installment) : '',
      property_tax_second_installment: apiData.property_tax_second_installment ? formatMoney(apiData.property_tax_second_installment) : '',
      iptu_installments_count: apiData.iptu_installments_count ? String(apiData.iptu_installments_count) : '',
      iptu_installments: Array.isArray(apiData.iptu_installments)
        ? apiData.iptu_installments.map((val: number, idx: number) => ({
            value: formatMoney(val),
            due_date: apiData.iptu_installments_due_dates?.[idx] || ''
          }))
        : [],

      // Seguro
      insurance_company: apiData.insurance_company || '',
      insurance_type: apiData.insurance_type || '',
      insurance_policy: apiData.insurance_policy || '',

      // Fiadores
      guarantors: apiData.guarantors || [],

      // Cancelamento
      canceled_at: apiData.canceled_at ? formatDate(apiData.canceled_at) : '',
      cancellation_penalty: apiData.cancellation_penalty ? formatMoney(apiData.cancellation_penalty) : '',
      other_cancellation_amounts: apiData.other_cancellation_amounts ? formatMoney(apiData.other_cancellation_amounts) : '',
      cancellation_justification: apiData.cancellation_justification || '',
    };
  }, []);

  const steps: FormStep[] = useMemo(() => {
    const baseSteps: FormStep[] = [
      {
        title: 'Dados da Locação',
        icon: <FileText size={20} />,
        fields: [
          {
            field: 'contract_number',
            label: 'Número do Contrato',
            type: 'text',
            required: true,
            icon: <Hash size={20} />,
            className: 'col-span-full',
            readOnly: true,
            disabled: true,
          },
          {
            field: 'start_date',
            label: 'Data de Início',
            type: 'date',
            required: true,
            icon: <Calendar size={20} />,
            readOnly: true,
            disabled: true,
          },
          {
            field: 'end_date',
            label: 'Data de Término',
            type: 'date',
            required: true,
            icon: <Calendar size={20} />,
            readOnly: true,
            disabled: true,
          },
          {
            field: 'property_id',
            label: 'Imóvel',
            type: 'select',
            required: true,
            options: loadingData 
              ? [{ label: 'Carregando imóveis...', value: '' }]
              : properties.map((property) => ({ 
                  label: property.title, 
                  value: property.id 
                })),
            icon: <Home size={20} />,
            className: 'col-span-full',
            readOnly: true,
            disabled: true,
          },
          {
            field: 'type_id',
            label: '',
            type: 'text',
            hidden: true,
            readOnly: true,
            disabled: true,
          },
          {
            field: 'owner_id',
            label: '',
            type: 'text',
            hidden: true,
            readOnly: true,
            disabled: true,
          },
          {
            field: 'type_display',
            label: 'Tipo do Imóvel',
            type: 'text',
            required: true,
            icon: <Building size={20} />,
            disabled: true,
            readOnly: true,
          },
          {
            field: 'owner_display',
            label: 'Proprietário',
            type: 'text',
            required: true,
            icon: <User size={20} />,
            disabled: true,
            readOnly: true,
          },
          {
            field: 'tenant_id',
            label: 'Inquilino',
            type: 'select',
            required: true,
            options: loadingData
              ? [{ label: 'Carregando inquilinos...', value: '' }]
              : tenants.map((tenant) => ({
                  label: tenant.name,
                  value: tenant.id
                })),
            icon: <User size={20} />,
            className: 'col-span-full',
            readOnly: true,
            disabled: true,
          },
          {
            field: 'agency_display',
            label: 'Imobiliária',
            type: 'text',
            icon: <Building size={20} />,
            readOnly: true,
            disabled: true,
          },
          {
            field: 'notes',
            label: 'Observações Gerais',
            type: 'textarea',
            rows: 3,
            icon: <FileText size={20} />,
            className: 'col-span-full',
            readOnly: true,
            disabled: true,
          },
        ],
      },
      {
        title: 'Valores da Locação',
        icon: <DollarSign size={20} />,
        fields: [
          {
            field: 'category_display',
            label: 'Categoria do Imóvel',
            type: 'text',
            icon: <Building size={20} />,
            readOnly: true,
            disabled: true,
          },
          {
            field: 'subcategory_display',
            label: 'Subcategoria do Imóvel',
            type: 'text',
            icon: <Building size={20} />,
            readOnly: true,
            disabled: true,
          },
          {
            field: 'center_display',
            label: 'Centro de Custo',
            type: 'text',
            icon: <Building size={20} />,
            className: 'col-span-full',
            readOnly: true,
            disabled: true,
          },
          {
            field: 'commission_category_display',
            label: 'Categoria de Comissão',
            type: 'text',
            icon: <Building size={20} />,
            className: 'col-span-full',
            readOnly: true,
            disabled: true,
          },
          {
            field: 'financial_institution_display',
            label: 'Instituição Financeira',
            type: 'text',
            icon: <CreditCard size={20} />,
            className: 'col-span-full',
            readOnly: true,
            disabled: true,
          },
          {
            field: 'rent_amount',
            label: 'Valor do Aluguel',
            type: 'text',
            required: true,
            icon: <DollarSign size={20} />,
            mask: 'money',
            readOnly: true,
            disabled: true,
          },
          {
            field: 'condo_fee',
            label: 'Valor do Condomínio',
            type: 'text',
            icon: <Building size={20} />,
            mask: 'money',
            readOnly: true,
            disabled: true,
          },
          {
            field: 'property_tax',
            label: 'Valor do IPTU (Base)',
            type: 'text',
            required: true,
            icon: <File size={20} />,
            mask: 'money',
            readOnly: true,
            disabled: true,
          },
          {
            field: 'extra_charges',
            label: 'Taxas Extras',
            type: 'text',
            icon: <Calculator size={20} />,
            mask: 'money',
            readOnly: true,
            disabled: true,
          },
          {
            field: 'agency_commission',
            label: 'Comissão Imobiliária (%)',
            type: 'number',
            maxLength: 3,
            icon: <Percent size={20} />,
            readOnly: true,
            disabled: true,
          },
          {
            field: 'commission_amount',
            label: 'Valor Comissão',
            type: 'text',
            icon: <DollarSign size={20} />,
            readOnly: true,
            disabled: true,
            className: 'bg-gray-50',
            mask: 'money',
          },
          {
            field: 'rent_due_day',
            label: 'Vencimento Aluguel',
            type: 'text',
            required: true,
            icon: <Calendar size={20} />,
            readOnly: true,
            disabled: true,
          },
          {
            field: 'tax_due_day',
            label: 'Vencimento IPTU',
            type: 'text',
            icon: <Calendar size={20} />,
            readOnly: true,
            disabled: true,
          },
          {
            field: 'condo_due_day',
            label: 'Vencimento Condomínio',
            type: 'text',
            icon: <Calendar size={20} />,
            readOnly: true,
            disabled: true,
          },
        ],
      },
      {
        title: 'Condição de Pagamento (IPTU)',
        icon: <CreditCard size={20} />,
        fields: [
          {
            field: 'iptu_base_info',
            label: '',
            type: 'custom',
            className: 'col-span-full',
            render: (_: any, fv: any) => (
              <div className="mb-2 p-4 bg-surface border border-ui-border rounded-lg flex items-center gap-4 opacity-80">
                <div className="p-3 bg-brand/10 text-brand rounded-full">
                  <FileText size={24} />
                </div>
                <div>
                  <p className="text-xs text-content-muted uppercase tracking-wider font-semibold">Valor Base do IPTU (Anual)</p>
                  <p className="text-xl font-bold text-content">{fv?.property_tax || 'R$ 0,00'}</p>
                </div>
              </div>
            )
          },
          {
            field: 'payment_condition',
            label: '',
            type: 'text',
            hidden: true // Mantemos a variável original escondida apenas para uso lógico
          },
          {
            field: 'payment_condition_label',
            label: 'Método de Pagamento Escolhido',
            type: 'text',
            icon: <CreditCard size={20} />,
            className: 'col-span-full',
            readOnly: true,
            disabled: true,
          },
          {
            field: 'property_tax_cash',
            label: 'Valor de Cobrança: À vista',
            type: 'text',
            icon: <DollarSign size={20} />,
            mask: 'money',
            readOnly: true,
            disabled: true,
            hidden: (fv) => fv?.payment_condition !== 'IN_FULL_15_DISCOUNT',
          },
          {
            field: 'property_tax_first_installment',
            label: 'Valor de Cobrança: 1ª Parcela',
            type: 'text',
            icon: <DollarSign size={20} />,
            mask: 'money',
            readOnly: true,
            disabled: true,
            hidden: (fv) => fv?.payment_condition !== 'SECOND_INSTALLMENT_10_DISCOUNT',
          },
          {
            field: 'property_tax_second_installment',
            label: 'Valor de Cobrança: 2ª Parcela (com desconto)',
            type: 'text',
            icon: <DollarSign size={20} />,
            mask: 'money',
            readOnly: true,
            disabled: true,
            hidden: (fv) => fv?.payment_condition !== 'SECOND_INSTALLMENT_10_DISCOUNT',
          },
          {
            field: 'iptu_installments_count',
            label: 'Número de Parcelas',
            type: 'text',
            icon: <Hash size={20} />,
            readOnly: true,
            disabled: true,
            hidden: (fv) => fv?.payment_condition !== 'INSTALLMENTS',
          },
          {
            field: 'iptu_installments',
            label: '',
            type: 'custom',
            hidden: (fv) => fv?.payment_condition !== 'INSTALLMENTS',
            render: (value: any) => {
              const arr = Array.isArray(value) ? value : [];
              if (arr.length === 0) return null;

              const titleText = arr.length === 1 
                ? 'Detalhamento de 1 Parcela' 
                : `Detalhamento das ${arr.length} Parcelas`;

              return (
                <div className="flex flex-col gap-4 col-span-full border p-5 rounded-xl bg-surface-subtle shadow-sm mt-2 w-full opacity-80">
                  <div className="flex flex-col sm:flex-row sm:justify-between sm:items-center gap-3">
                    <span className="text-[15px] font-semibold text-content border-l-4 border-brand pl-3">
                      {titleText}
                    </span>
                  </div>
                  <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-3">
                    {arr.map((item: any, idx: number) => (
                      <div key={`inst-${idx}`} className="bg-surface p-3 rounded-lg border border-ui-border">
                        <label className="block text-xs text-content-muted mb-1.5 font-medium">{idx + 1}ª Parcela</label>
                        <input 
                          type="text" 
                          value={item.value || item} 
                          readOnly
                          disabled
                          className="w-full h-10 px-3 border border-ui-border rounded-md text-sm bg-surface-muted cursor-not-allowed mb-2"
                        />
                        {item.due_date && (
                          <div className="text-xs text-content-muted">
                            <span className="font-medium">Vencimento:</span> {item.due_date}
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                </div>
              );
            }
          }
        ]
      },
      {
        title: 'Seguro',
        icon: <Shield size={20} />,
        fields: [
          {
            field: 'insurance_company',
            label: 'Nome da Seguradora',
            type: 'text',
            icon: <Building size={20} />,
            readOnly: true,
            disabled: true,
            className: 'col-span-full',
          },
          {
            field: 'insurance_type',
            label: 'Tipo de Seguro',
            type: 'text',
            icon: <Shield size={20} />,
            readOnly: true,
            disabled: true,
            className: 'col-span-full',
          },
          {
            field: 'insurance_policy',
            label: 'Apólice',
            type: 'text',
            icon: <FileText size={20} />,
            readOnly: true,
            disabled: true,
            className: 'col-span-full',
          },
        ],
      },
      {
        title: 'Fiadores',
        icon: <Users size={20} />,
        fields: [
          {
            field: 'guarantors',
            label: 'Lista de Fiadores',
            type: 'custom',
            defaultValue: [],
            className: 'col-span-full',
            render: (value: any, formValues: any, onChange: any) => (
              <GuarantorManager 
                value={value} 
                onChange={onChange} 
                readOnly={true}
              />
            )
          }
        ],
      }
    ];

    if (isCanceled) {
      baseSteps.push({
        title: 'Cancelamento',
        icon: <AlertCircle size={20} />,
        fields: [
          {
            field: 'canceled_at',
            label: 'Data de Cancelamento',
            type: 'date',
            required: true,
            icon: <Calendar size={20} />,
            readOnly: true,
            disabled: true,
          },
          {
            field: 'cancellation_penalty',
            label: 'Valor da Multa',
            type: 'text',
            icon: <DollarSign size={20} />,
            mask: 'money',
            readOnly: true,
            disabled: true,
          },
          {
            field: 'other_cancellation_amounts',
            label: 'Outros Valores',
            type: 'text',
            icon: <DollarSign size={20} />,
            mask: 'money',
            readOnly: true,
            disabled: true,
          },
          {
            field: 'cancellation_justification',
            label: 'Justificativa',
            type: 'textarea',
            rows: 3,
            icon: <FileText size={20} />,
            className: 'col-span-full',
            readOnly: true,
            disabled: true,
          },
        ]
      });
    }

    return baseSteps;
  }, [properties, tenants, loadingData, isCanceled]);

  if (loadingData) {
    return (
      <div className="flex justify-center items-center h-64">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-brand"></div>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-4">
      <DynamicFormManager
        resource="leases"
        title="Locação"
        basePath="/dashboard/locacoes"
        mode="view"
        id={id}
        steps={steps}
        onSubmit={handleSubmit}
        onFieldChange={handleFieldChange}
        transformData={transformData}
      />
    </div>
  );
}