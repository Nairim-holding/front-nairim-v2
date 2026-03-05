/* eslint-disable @typescript-eslint/no-explicit-any */
"use client";

import { useParams, useRouter } from 'next/navigation';
import { useMemo, useState, useEffect, useCallback } from 'react';
import { useMessageContext } from '@/contexts/MessageContext';
import DynamicFormManager from '@/components/DynamicFormManager';
import { FormStep } from '@/types/types';
import {
  FileText, Calendar, DollarSign, User, Building, 
  Home, File, Percent, Calculator, Hash, AlertCircle, CreditCard
} from 'lucide-react';

const parseMoney = (value: string | number) => {
  if (!value && value !== 0) return 0;
  if (typeof value === 'number') return value;
  const strValue = String(value).trim();
  if (!strValue.includes(',') && strValue.includes('.')) {
    const parsed = parseFloat(strValue);
    if (!isNaN(parsed)) return parsed;
  }
  const cleaned = strValue.replace(/[^\d,-]/g, '').replace(',', '.');
  const parsed = parseFloat(cleaned);
  if (isNaN(parsed)) return 0;
  return parsed;
};

const formatMoney = (value: number) => {
  if (!value && value !== 0) return 'R$ 0,00';
  return new Intl.NumberFormat('pt-BR', {
    style: 'currency',
    currency: 'BRL',
    minimumFractionDigits: 2,
    maximumFractionDigits: 2
  }).format(value);
};

export default function EditarLocacaoPage() {
  const params = useParams();
  const id = params.id as string;
  
  const { showMessage } = useMessageContext();
  const router = useRouter();
  
  const [properties, setProperties] = useState<any[]>([]);
  const [tenants, setTenants] = useState<any[]>([]);
  const [loadingData, setLoadingData] = useState(true);
  const [formValues, setFormValues] = useState<any>({});
  const [isCanceled, setIsCanceled] = useState(false);

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
      } catch (error) {
        showMessage('Erro ao carregar dados', 'error');
      } finally {
        setLoadingData(false);
      }
    };

    fetchData();
  }, [showMessage]);

  const handleFieldChange = useCallback(async (fieldName: string, value: any) => {
    if (fieldName === 'property_id' && value) {
      try {
        showMessage('Carregando dados do imóvel...', 'info');
        
        const response = await fetch(`${process.env.NEXT_PUBLIC_URL_API}/properties/${value}`);
        
        if (!response.ok) {
          throw new Error('Erro ao buscar dados do imóvel');
        }

        const result = await response.json();
        const property = result.data || result;
        const propertyValues = property.values?.[0] || {};
        
        const updates: any = {
          type_id: property.type_id,
          owner_id: property.owner_id,
          type_display: property.type?.description || 'Tipo não encontrado',
          owner_display: property.owner?.name || 'Proprietário não encontrado',
          rent_amount: propertyValues.rental_value ? formatMoney(parseMoney(propertyValues.rental_value)) : '',
          condo_fee: propertyValues.condo_fee ? formatMoney(parseMoney(propertyValues.condo_fee)) : '',
          property_tax: propertyValues.property_tax ? formatMoney(parseMoney(propertyValues.property_tax)) : '',
          extra_charges: propertyValues.extra_charges ? formatMoney(parseMoney(propertyValues.extra_charges)) : '',
        };

        if (propertyValues.rental_value) {
          updates.agency_commission = '5';
          const rentValue = parseMoney(propertyValues.rental_value);
          updates.commission_amount = formatMoney(rentValue * 0.05);
        }

        showMessage('Dados do imóvel carregados com sucesso!', 'success');
        return updates;

      } catch (error: any) {
        showMessage(error.message || 'Erro ao buscar dados do imóvel', 'error');
        return null;
      }
    }

    if (fieldName === 'agency_commission' || fieldName === 'rent_amount') {
      const rentAmount = fieldName === 'rent_amount' 
        ? parseMoney(value) 
        : parseMoney(formValues?.rent_amount || 0);
      
      const commissionPercent = fieldName === 'agency_commission'
        ? parseFloat(value) || 0
        : parseFloat(formValues?.agency_commission || 0);
      
      const commissionAmount = rentAmount * (commissionPercent / 100);
      
      return {
        commission_amount: formatMoney(commissionAmount)
      };
    }

    if (fieldName === 'property_tax') {
      if (!value) {
        return { payment_condition: '' };
      }
    }

    return null;
  }, [formValues, showMessage]);

  const handleSubmit = async (data: any) => {
    try {
      if (!data.property_id) {
        throw new Error('Selecione um imóvel para continuar');
      }

      const formattedData: any = {
        property_id: data.property_id,
        type_id: data.type_id,
        owner_id: data.owner_id,
        tenant_id: data.tenant_id,
        contract_number: data.contract_number,
        start_date: data.start_date,
        end_date: data.end_date,
        rent_amount: parseMoney(data.rent_amount || 0),
        condo_fee: data.condo_fee ? parseMoney(data.condo_fee) : null,
        property_tax: data.property_tax ? parseMoney(data.property_tax) : null,
        extra_charges: data.extra_charges ? parseMoney(data.extra_charges) : null,
        agency_commission: data.agency_commission ? parseFloat(data.agency_commission) : null,
        commission_amount: data.commission_amount ? parseMoney(data.commission_amount) : null,
        rent_due_day: parseInt(data.rent_due_day) || 5,
        tax_due_day: data.tax_due_day ? parseInt(data.tax_due_day) : null,
        condo_due_day: data.condo_due_day ? parseInt(data.condo_due_day) : null,
        payment_condition: data.payment_condition || null,
      };

      if (isCanceled) {
        formattedData.status = 'CANCELED';
        formattedData.canceled_at = data.canceled_at ? new Date(data.canceled_at).toISOString() : null;
        formattedData.cancellation_penalty = data.cancellation_penalty ? parseMoney(data.cancellation_penalty) : null;
        formattedData.other_cancellation_amounts = data.other_cancellation_amounts ? parseMoney(data.other_cancellation_amounts) : null;
        formattedData.cancellation_justification = data.cancellation_justification || null;
      }

      const API_URL = process.env.NEXT_PUBLIC_URL_API;
      const response = await fetch(`${API_URL}/leases/${id}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(formattedData),
      });

      const responseText = await response.text();

      let result;
      try {
        result = JSON.parse(responseText);
      } catch (e) {
        throw new Error('Resposta inválida do servidor');
      }

      if (!response.ok) {
        if (response.status === 400 && result.errors) {
          const validationErrors = Object.entries(result.errors)
            .map(([field, messages]) => `${field}: ${Array.isArray(messages) ? messages.join(', ') : messages}`)
            .join('; ');
          throw new Error(`Erros de validação: ${validationErrors}`);
        }
        throw new Error(result.message || `Erro ${response.status}`);
      }

      return result;

    } catch (error: any) {
      throw new Error(`Erro ao atualizar locação: ${error.message}`);
    }
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
      payment_condition: apiData.payment_condition || '',
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
            placeholder: 'Ex: 2024/001',
            autoFocus: true,
            icon: <Hash size={20} />,
            className: 'col-span-full',
          },
          {
            field: 'start_date',
            label: 'Data de Início',
            type: 'date',
            required: true,
            icon: <Calendar size={20} />,
          },
          {
            field: 'end_date',
            label: 'Data de Término',
            type: 'date',
            required: true,
            icon: <Calendar size={20} />,
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
          },
          {
            field: 'type_id',
            label: '',
            type: 'text',
            hidden: true,
          },
          {
            field: 'owner_id',
            label: '',
            type: 'text',
            hidden: true,
          },
          {
            field: 'type_display',
            label: 'Tipo do Imóvel',
            type: 'text',
            required: true,
            icon: <Building size={20} />,
            disabled: true,
            readOnly: true,
            placeholder: 'Selecione um imóvel primeiro',
          },
          {
            field: 'owner_display',
            label: 'Proprietário',
            type: 'text',
            required: true,
            icon: <User size={20} />,
            disabled: true,
            readOnly: true,
            placeholder: 'Selecione um imóvel primeiro',
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
          },
          {
            field: 'notes',
            label: 'Observações Gerais',
            type: 'textarea',
            placeholder: 'Observações sobre a locação',
            rows: 3,
            icon: <FileText size={20} />,
            className: 'col-span-full',
          },
        ],
      },
      {
        title: 'Valores da Locação',
        icon: <DollarSign size={20} />,
        fields: [
          {
            field: 'rent_amount',
            label: 'Valor do Aluguel',
            type: 'text',
            required: true,
            placeholder: 'R$ 0,00',
            icon: <DollarSign size={20} />,
            mask: 'money',
          },
          {
            field: 'condo_fee',
            label: 'Valor do Condomínio',
            type: 'text',
            placeholder: 'R$ 0,00',
            icon: <Building size={20} />,
            mask: 'money',
          },
          {
            field: 'property_tax',
            label: 'Valor do IPTU',
            type: 'text',
            required: true,
            placeholder: 'R$ 0,00',
            icon: <File size={20} />,
            mask: 'money',
          },
          {
            field: 'extra_charges',
            label: 'Taxas Extras',
            type: 'text',
            placeholder: 'R$ 0,00',
            icon: <Calculator size={20} />,
            mask: 'money',
          },
          {
            field: 'agency_commission',
            label: 'Comissão Imobiliária (%)',
            type: 'number',
            placeholder: '5',
            maxLength: 3,
            icon: <Percent size={20} />,
          },
          {
            field: 'commission_amount',
            label: 'Valor Comissão',
            type: 'text',
            placeholder: 'R$ 0,00',
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
            placeholder: 'Dia 5',
            icon: <Calendar size={20} />,
          },
          {
            field: 'tax_due_day',
            label: 'Vencimento IPTU',
            type: 'text',
            placeholder: 'Dia 10',
            icon: <Calendar size={20} />,
          },
          {
            field: 'condo_due_day',
            label: 'Vencimento Condomínio',
            type: 'text',
            placeholder: 'Dia 10',
            icon: <Calendar size={20} />,
          },
        ],
      },
      {
        title: 'Condição de Pagamento (IPTU)',
        icon: <CreditCard size={20} />,
        fields: [
          {
            field: 'payment_simulator',
            label: '',
            type: 'custom',
            className: 'col-span-full',
            render: (_: any, formValues: any) => {
              const taxVal = parseMoney(formValues?.property_tax || 0);
              
              if (!taxVal) {
                return (
                  <div className="p-4 bg-amber-50 border border-amber-200 rounded-lg text-amber-700 text-sm">
                    ⚠️ Preencha o <strong>Valor do IPTU</strong> na etapa anterior para habilitar e visualizar as opções de pagamento.
                  </div>
                );
              }

              const aVista = taxVal * 0.85;
              const segParcela = taxVal * 0.90;
              const parcelado = taxVal / 12;

              return (
                <div className="flex flex-col gap-3">
                  <h4 className="text-sm font-medium text-content-secondary">Simulação de Valores (Base: {formatMoney(taxVal)})</h4>
                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                    <div className={`p-4 rounded-lg border transition-all ${formValues?.payment_condition === 'IN_FULL_15_DISCOUNT' ? 'border-brand bg-brand/5 shadow-sm' : 'border-ui-border bg-surface hover:bg-surface-subtle'}`}>
                      <div className="text-xs text-content-muted mb-1">À vista (15% desc.)</div>
                      <div className="text-lg font-bold text-content">{formatMoney(aVista)}</div>
                    </div>
                    <div className={`p-4 rounded-lg border transition-all ${formValues?.payment_condition === 'SECOND_INSTALLMENT_10_DISCOUNT' ? 'border-brand bg-brand/5 shadow-sm' : 'border-ui-border bg-surface hover:bg-surface-subtle'}`}>
                      <div className="text-xs text-content-muted mb-1">2ª Parcela (10% desc.)</div>
                      <div className="text-lg font-bold text-content">{formatMoney(segParcela)}</div>
                    </div>
                    <div className={`p-4 rounded-lg border transition-all ${formValues?.payment_condition === 'INSTALLMENTS_12X' ? 'border-brand bg-brand/5 shadow-sm' : 'border-ui-border bg-surface hover:bg-surface-subtle'}`}>
                      <div className="text-xs text-content-muted mb-1">Parcelado (12x)</div>
                      <div className="text-lg font-bold text-content">{formatMoney(parcelado)} <span className="text-xs font-normal">/mês</span></div>
                      <div className="text-xs text-content-muted mt-1">Total: {formatMoney(taxVal)}</div>
                    </div>
                  </div>
                </div>
              );
            }
          },
          {
            field: 'payment_condition',
            label: 'Selecione o Método de Pagamento',
            type: 'select',
            required: true,
            options: [
              { label: 'À vista com 15% de desconto', value: 'IN_FULL_15_DISCOUNT' },
              { label: 'Segunda parcela com 10% de desconto', value: 'SECOND_INSTALLMENT_10_DISCOUNT' },
              { label: 'Parcelado em 12x', value: 'INSTALLMENTS_12X' }
            ],
            icon: <CreditCard size={20} />,
            className: 'col-span-full',
          },
        ]
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
          },
          {
            field: 'cancellation_penalty',
            label: 'Valor da Multa',
            type: 'text',
            icon: <DollarSign size={20} />,
            mask: 'money',
          },
          {
            field: 'other_cancellation_amounts',
            label: 'Outros Valores',
            type: 'text',
            icon: <DollarSign size={20} />,
            mask: 'money',
          },
          {
            field: 'cancellation_justification',
            label: 'Justificativa',
            type: 'textarea',
            rows: 3,
            icon: <FileText size={20} />,
            className: 'col-span-full',
          },
        ]
      });
    }

    return baseSteps;
  }, [properties, tenants, loadingData, isCanceled]);

  const onSubmitSuccess = () => {
    showMessage('Locação atualizada com sucesso!', 'success');
    router.push('/dashboard/locacoes');
  };

  if (loadingData) {
    return (
      <div className="flex justify-center items-center h-64">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-brand"></div>
      </div>
    );
  }

  return (
    <DynamicFormManager
      resource="leases"
      title="Locação"
      basePath="/dashboard/locacoes"
      mode="edit"
      id={id}
      steps={steps}
      onSubmit={handleSubmit}
      onSubmitSuccess={onSubmitSuccess}
      onFieldChange={handleFieldChange}
      transformData={transformData}
      onFormValuesChange={setFormValues}
    />
  );
}