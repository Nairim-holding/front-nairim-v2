/* eslint-disable @typescript-eslint/no-explicit-any */
"use client";

import { useParams, useRouter } from 'next/navigation';
import { useMemo, useState, useEffect, useCallback, useRef } from 'react';
import { useMessageContext } from '@/contexts/MessageContext';
import { useAuth } from '@/contexts/AuthContext';
import { useUploadSSE } from '@/hooks/useUploadSSE';
import DynamicFormManager from '@/components/form/DynamicForm';
import GuarantorManager from '@/components/domain/guarantors/GuarantorManager';
import LeaseCancellationModal from '@/components/domain/leases/LeaseCancellationModal';
import { FormStep } from '@/types/types';
import {
  FileText, Calendar, DollarSign, User, Building,
  Home, File as FileIcon, Percent, Calculator, Hash, AlertCircle, CreditCard, Copy, Shield, Users, Upload
} from 'lucide-react';

// Extrai um nome de arquivo legível do caminho salvo (remove diretórios e o
// prefixo de timestamp gerado no upload). Espelha o padrão de Imóveis.
const extractFileName = (filePath: string): string => {
  if (!filePath) return 'Arquivo';
  const parts = filePath.split('/');
  return decodeURIComponent(parts[parts.length - 1].replace(/^\d+-/, ''));
};

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const mapLeaseDocument = (doc: any) => ({
  id: doc.id,
  file_name: doc.description && doc.description !== 'Lease Contract' && doc.description !== 'Lease Document'
    ? doc.description
    : extractFileName(doc.file_path),
  file_url: doc.file_path,
  type: doc.type,
  mime_type: doc.file_type,
  is_featured: doc.is_featured ?? false,
});

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
  const { user, token } = useAuth();
  const { uploadAndTrack } = useUploadSSE();
  const router = useRouter();

  // Documentos originais (mídias) carregados da API — usados para calcular quais
  // foram removidos ao salvar. Populado no transformData.
  const originalDocumentsRef = useRef<any[]>([]);

  const [properties, setProperties] = useState<any[]>([]);
  const [tenants, setTenants] = useState<any[]>([]);
  const [agencies, setAgencies] = useState<any[]>([]);
  const [institutions, setInstitutions] = useState<any[]>([]);
  // Instituição vinculada à locação que não consta entre as ativas (foi
  // inativada depois). Mantida nas opções para não sumir o dado já salvo.
  const [linkedInstitution, setLinkedInstitution] = useState<any>(null);
  const [loadingData, setLoadingData] = useState(true);
  const [formValues, setFormValues] = useState<any>({});
  const [isCanceled, setIsCanceled] = useState(false);
  const [cancelModalOpen, setCancelModalOpen] = useState(false);

  useEffect(() => {
    const fetchData = async () => {
      try {
        const [propertiesRes, tenantsRes, agenciesRes, institutionsRes] = await Promise.all([
          fetch(`${process.env.NEXT_PUBLIC_URL_API}/properties?limit=50`),
          fetch(`${process.env.NEXT_PUBLIC_URL_API}/tenants`),
          fetch(`${process.env.NEXT_PUBLIC_URL_API}/agencies?limit=1000`),
          // Só instituições ativas — mesmo critério do filtro de Lançamentos.
          // A instituição já vinculada à locação é reinserida abaixo, mesmo inativa.
          fetch(`${process.env.NEXT_PUBLIC_URL_API}/financial-institution?limit=1000&filter[is_active]=true`),
        ]);

        if (!propertiesRes.ok || !tenantsRes.ok) throw new Error('Erro ao buscar dados');

        const propertiesData = await propertiesRes.json();
        const tenantsData = await tenantsRes.json();
        const agenciesData = agenciesRes.ok ? await agenciesRes.json() : { data: [] };
        const institutionsData = institutionsRes.ok ? await institutionsRes.json() : { data: [] };

        setProperties(propertiesData.data || propertiesData || []);
        setTenants(tenantsData.data || tenantsData || []);
        setAgencies(agenciesData.data || agenciesData || []);
        setInstitutions(institutionsData.data || institutionsData || []);
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
        if (!response.ok) throw new Error('Erro ao buscar dados do imóvel');

        const result = await response.json();
        const property = result.data || result;
        const propertyValues = property.values?.[0] || {};
        
        const propertyAgency = property.agency_id ? agencies.find((a) => a.id === property.agency_id) : null;

        const updates: any = {
          type_id: property.type_id,
          owner_id: property.owner_id,
          agency_id: property.agency_id || '',
          type_display: property.type?.description || 'Tipo não encontrado',
          owner_display: property.owner?.name || 'Proprietário não encontrado',
          category_display: property.category?.name || 'Sem categoria',
          subcategory_display: property.subcategory?.name || 'Sem subcategoria',
          center_display: property.center?.name || 'Sem centro de custo',
          commission_category_display: propertyAgency?.commission_category
            ? `${propertyAgency.commission_category.name}${propertyAgency.commission_subcategory ? ' › ' + propertyAgency.commission_subcategory.name : ''}`
            : (property.agency_id ? 'Sem categoria de comissão' : ''),
          rent_amount: propertyValues.rental_value ? formatMoney(parseMoney(propertyValues.rental_value)) : '',
          condo_fee: propertyValues.condo_fee ? formatMoney(parseMoney(propertyValues.condo_fee)) : '',
          property_tax: propertyValues.property_tax ? formatMoney(parseMoney(propertyValues.property_tax)) : '',
          extra_charges: propertyValues.extra_charges ? formatMoney(parseMoney(propertyValues.extra_charges)) : '',
        };

        if (propertyValues.rental_value) {
          updates.agency_commission = '5';
          updates.commission_amount = formatMoney(parseMoney(propertyValues.rental_value) * 0.05);
        }
        showMessage('Dados do imóvel carregados com sucesso!', 'success');
        return updates;
      } catch (error: any) {
        showMessage(error.message || 'Erro ao buscar dados do imóvel', 'error');
        return null;
      }
    }

    if (fieldName === 'agency_id' && value) {
      const agency = agencies.find(a => a.id === value);
      if (agency?.commission_category) {
        return {
          commission_category_display: `${agency.commission_category.name}${agency.commission_subcategory ? ' › ' + agency.commission_subcategory.name : ''}`,
        };
      }
      return { commission_category_display: 'Sem categoria de comissão' };
    }

    if (fieldName === 'agency_commission' || fieldName === 'rent_amount') {
      const rentAmount = fieldName === 'rent_amount' ? parseMoney(value) : parseMoney(formValues?.rent_amount || 0);
      const commissionPercent = fieldName === 'agency_commission' ? parseFloat(value) || 0 : parseFloat(formValues?.agency_commission || 0);
      return { commission_amount: formatMoney(rentAmount * (commissionPercent / 100)) };
    }

    if (fieldName === 'iptu_installments_count') {
      const count = parseInt(value) || 0;
      const currentArr = Array.isArray(formValues.iptu_installments) ? formValues.iptu_installments : [];
      let newArr = [...currentArr];

      if (newArr.length < count) {
        // Cria novos itens com estrutura { value, due_date }
        const itemsToAdd = Array(count - newArr.length).fill(null).map(() => ({ value: '', due_date: '' }));
        newArr = [...newArr, ...itemsToAdd];
      } else {
        newArr = newArr.slice(0, count);
      }
      return { iptu_installments: newArr };
    }

    return null;
  }, [formValues, showMessage, agencies]);

  const handleSubmit = async (data: any) => {
    try {
      if (!data.property_id) throw new Error('Selecione um imóvel para continuar');
      if (!data.category_display || data.category_display === 'Sem categoria') throw new Error('O imóvel deve ter uma categoria selecionada');
      if (!data.center_display || data.center_display === 'Sem centro de custo') throw new Error('O imóvel deve ter um centro de custo selecionado');
      if (!data.agency_id) throw new Error('Selecione uma imobiliária para continuar');
      if (!data.commission_category_display || data.commission_category_display === 'Sem categoria de comissão') throw new Error('A imobiliária selecionada deve ter uma categoria de comissão');
      if (!data.financial_institution_id) throw new Error('Selecione a Instituição Financeira na aba Valores da Locação');

      const formattedData: any = {
        property_id: data.property_id,
        type_id: data.type_id,
        owner_id: data.owner_id,
        tenant_id: data.tenant_id,
        agency_id: data.agency_id || null,
        financial_institution_id: data.financial_institution_id || null,
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
        iptu_year: data.iptu_year ? parseInt(data.iptu_year) : new Date().getFullYear(),

        property_tax_cash: data.property_tax_cash ? parseMoney(data.property_tax_cash) : null,
        property_tax_cash_due_date: data.property_tax_cash_due_date || null,
        property_tax_first_installment: data.property_tax_first_installment ? parseMoney(data.property_tax_first_installment) : null,
        property_tax_first_installment_due_date: data.property_tax_first_installment_due_date || null,
        property_tax_second_installment: data.property_tax_second_installment ? parseMoney(data.property_tax_second_installment) : null,
        property_tax_second_installment_due_date: data.property_tax_second_installment_due_date || null,
        iptu_installments_count: data.iptu_installments_count ? parseInt(data.iptu_installments_count) : null,
        iptu_installments: data.iptu_installments 
          ? data.iptu_installments
              .map((inst: any) => typeof inst === 'string' ? parseMoney(inst) : parseMoney(inst?.value || 0))
              .filter((val: number) => val > 0)
          : null,
        iptu_installments_due_dates: data.iptu_installments
          ? data.iptu_installments
              .filter((inst: any) => {
                const val = typeof inst === 'string' ? parseMoney(inst) : parseMoney(inst?.value || 0);
                return val > 0;
              })
              .map((inst: any) => inst?.due_date || null)
          : null,

        insurance_company: data.insurance_company || null,
        insurance_type: data.insurance_type || null,
        insurance_policy: data.insurance_policy || null,

        guarantors: data.guarantors || null,
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
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(formattedData),
      });

      const responseText = await response.text();
      let result;
      try { result = JSON.parse(responseText); } catch (e) { throw new Error('Resposta inválida do servidor'); }

      if (!response.ok) {
        if (response.status === 400 && result.errors) {
          const validationErrors = Object.entries(result.errors).map(([field, messages]) => `${field}: ${Array.isArray(messages) ? messages.join(', ') : messages}`).join('; ');
          throw new Error(`Erros de validação: ${validationErrors}`);
        }
        throw new Error(result.message || `Erro ${response.status}`);
      }

      // Sincroniza as mídias da locação (arquivos novos + remoções), reaproveitando
      // o mesmo mecanismo de upload de Imóveis (useUploadSSE → multipart). Só dispara
      // quando há mudança. Falha aqui não invalida a locação já salva.
      const currentDocs: any[] = Array.isArray(data.arquivosLocacao) ? data.arquivosLocacao : [];
      const newFiles = currentDocs.filter((f: any) => f instanceof globalThis.File) as File[];
      const keptIds = new Set(
        currentDocs.filter((f: any) => f && !(f instanceof globalThis.File) && f.id).map((f: any) => String(f.id)),
      );
      const removedIds = originalDocumentsRef.current
        .map((d: any) => String(d.id))
        .filter((docId: string) => !keptIds.has(docId));

      if (newFiles.length > 0 || removedIds.length > 0) {
        try {
          const fd = new FormData();
          newFiles.forEach((file) => fd.append('arquivosLocacao', file, file.name));
          if (removedIds.length > 0) fd.append('removedDocuments', JSON.stringify(removedIds));
          fd.append('userId', user?.id ?? '');

          await uploadAndTrack({
            url: `${API_URL}/leases/${id}/documents`,
            method: 'PUT',
            body: fd,
            headers: token ? { Authorization: `Bearer ${token}` } : undefined,
            compressImages: false,
          });
        } catch (mediaError: any) {
          showMessage(
            `Locação salva, mas houve erro ao sincronizar os arquivos: ${mediaError?.message ?? 'falha no upload'}`,
            'error',
            6000,
          );
        }
      }

      return result;
    } catch (error: any) {
      throw new Error(`Erro ao atualizar locação: ${error.message}`);
    }
  };

  const transformData = useCallback((apiData: any) => {
    if (!apiData) return {};
    if (apiData.status === 'CANCELED') setIsCanceled(true);

    // O GET da locação já traz o relacionamento completo, então a instituição
    // inativa é recuperada daqui mesmo, sem requisição extra.
    if (apiData.financial_institution?.is_active === false) {
      setLinkedInstitution(apiData.financial_institution);
    }

    originalDocumentsRef.current = Array.isArray(apiData.documents) ? apiData.documents : [];

    const formatDate = (dateString: string) => {
      if (!dateString) return '';
      return new Date(dateString).toISOString().split('T')[0];
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
      category_display: apiData.property?.category?.name || 'Sem categoria',
      subcategory_display: apiData.property?.subcategory?.name || 'Sem subcategoria',
      center_display: apiData.property?.center?.name || 'Sem centro de custo',
      tenant_id: apiData.tenant_id || '',
      agency_id: apiData.agency_id || '',
      commission_category_display: apiData.agency?.commission_category
        ? `${apiData.agency.commission_category.name}${apiData.agency.commission_subcategory ? ' › ' + apiData.agency.commission_subcategory.name : ''}`
        : 'Sem categoria de comissão',
      financial_institution_id: apiData.financial_institution_id || '',
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
      iptu_year: apiData.iptu_year ? String(apiData.iptu_year) : new Date().getFullYear().toString(),
      canceled_at: apiData.canceled_at ? formatDate(apiData.canceled_at) : '',
      cancellation_penalty: apiData.cancellation_penalty ? formatMoney(apiData.cancellation_penalty) : '',
      other_cancellation_amounts: apiData.other_cancellation_amounts ? formatMoney(apiData.other_cancellation_amounts) : '',
      cancellation_justification: apiData.cancellation_justification || '',
      
      property_tax_cash: apiData.property_tax_cash ? formatMoney(apiData.property_tax_cash) : '',
      property_tax_cash_due_date: apiData.property_tax_cash_due_date ? apiData.property_tax_cash_due_date.split('T')[0] : '',
      property_tax_first_installment: apiData.property_tax_first_installment ? formatMoney(apiData.property_tax_first_installment) : '',
      property_tax_first_installment_due_date: apiData.property_tax_first_installment_due_date ? apiData.property_tax_first_installment_due_date.split('T')[0] : '',
      property_tax_second_installment: apiData.property_tax_second_installment ? formatMoney(apiData.property_tax_second_installment) : '',
      property_tax_second_installment_due_date: apiData.property_tax_second_installment_due_date ? apiData.property_tax_second_installment_due_date.split('T')[0] : '',
      iptu_installments_count: apiData.iptu_installments_count ? String(apiData.iptu_installments_count) : '',
      iptu_installments: Array.isArray(apiData.iptu_installments)
        ? apiData.iptu_installments.map((val: number, idx: number) => ({
            value: formatMoney(val),
            due_date: apiData.iptu_installments_due_dates?.[idx] || ''
          }))
        : [],
      insurance_company: apiData.insurance_company || '',
      insurance_type: apiData.insurance_type || '',
      insurance_policy: apiData.insurance_policy || '',
      guarantors: apiData.guarantors || [],
      arquivosLocacao: (apiData.documents ?? []).map(mapLeaseDocument),
    };
  }, []);

  // Ativas + a instituição já vinculada à locação, ainda que inativa, para que o
  // valor salvo continue visível e identificável na edição.
  const institutionOptions = useMemo(() => {
    const options = institutions.map((i) => ({ label: i.name, value: i.id }));
    if (linkedInstitution && !institutions.some((i) => i.id === linkedInstitution.id)) {
      options.push({ label: `${linkedInstitution.name} (inativa)`, value: linkedInstitution.id });
    }
    return options;
  }, [institutions, linkedInstitution]);

  const steps: FormStep[] = useMemo(() => {
    const baseSteps: FormStep[] = [
      {
        title: 'Dados da Locação',
        icon: <FileText size={20} />,
        fields: [
          { field: 'contract_number', label: 'Número do Contrato', type: 'text', required: true, autoFocus: true, icon: <Hash size={20} />, className: 'col-span-full' },
          { field: 'start_date', label: 'Data de Início', type: 'date', required: true, icon: <Calendar size={20} /> },
          { field: 'end_date', label: 'Data de Término', type: 'date', required: true, icon: <Calendar size={20} /> },
          { field: 'property_id', label: 'Imóvel', type: 'select', required: true, options: loadingData ? [{ label: 'Carregando imóveis...', value: '' }] : properties.map((property) => ({ label: property.title, value: property.id })), icon: <Home size={20} />, className: 'col-span-full' },
          { field: 'type_id', label: '', type: 'text', hidden: true },
          { field: 'owner_id', label: '', type: 'text', hidden: true },
          { field: 'type_display', label: 'Tipo do Imóvel', type: 'text', required: true, icon: <Building size={20} />, disabled: true, readOnly: true, placeholder: 'Selecione um imóvel primeiro' },
          { field: 'owner_display', label: 'Proprietário', type: 'text', required: true, icon: <User size={20} />, disabled: true, readOnly: true, placeholder: 'Selecione um imóvel primeiro' },
          { field: 'tenant_id', label: 'Inquilino', type: 'select', required: true, options: loadingData ? [{ label: 'Carregando inquilinos...', value: '' }] : tenants.map((tenant) => ({ label: tenant.name, value: tenant.id })), icon: <User size={20} />, className: 'col-span-full' },
          { field: 'agency_id', label: 'Imobiliária', type: 'select', options: [{ label: 'Nenhuma', value: '' }, ...agencies.map((a) => ({ label: a.trade_name, value: a.id }))], icon: <Building size={20} /> },
          { field: 'notes', label: 'Observações Gerais', type: 'textarea', rows: 3, icon: <FileText size={20} />, className: 'col-span-full' },
        ],
      },
      {
        title: 'Valores da Locação',
        icon: <DollarSign size={20} />,
        fields: [
          { field: 'category_display', label: 'Categoria do Imóvel', type: 'text', required: true, icon: <Building size={20} />, disabled: true, readOnly: true, placeholder: 'Selecione um imóvel' },
          { field: 'subcategory_display', label: 'Subcategoria do Imóvel', type: 'text', icon: <Building size={20} />, disabled: true, readOnly: true, placeholder: 'Selecione um imóvel' },
          { field: 'center_display', label: 'Centro de Custo', type: 'text', required: true, icon: <Building size={20} />, disabled: true, readOnly: true, placeholder: 'Selecione um imóvel', className: 'col-span-full' },
          { field: 'commission_category_display', label: 'Categoria de Comissão', type: 'text', required: true, full: true, icon: <Building size={20} />, disabled: true, readOnly: true, placeholder: 'Selecione uma imobiliária', className: 'col-span-full' },
          { field: 'financial_institution_id', label: 'Instituição Financeira', type: 'select', required: true, options: [{ label: 'Selecione...', value: '' }, ...institutionOptions], icon: <CreditCard size={20} />, className: 'col-span-full' },
          { field: 'rent_amount', label: 'Valor do Aluguel', type: 'text', required: true, icon: <DollarSign size={20} />, mask: 'money' },
          { field: 'condo_fee', label: 'Valor do Condomínio', type: 'text', icon: <Building size={20} />, mask: 'money' },
          { field: 'property_tax', label: 'Valor do IPTU (Base)', type: 'text', required: false, icon: <FileIcon size={20} />, mask: 'money' },
          { field: 'extra_charges', label: 'Taxas Extras', type: 'text', icon: <Calculator size={20} />, mask: 'money' },
          { field: 'agency_commission', label: 'Comissão Imobiliária (%)', type: 'number', maxLength: 3, icon: <Percent size={20} /> },
          { field: 'commission_amount', label: 'Valor Comissão', type: 'text', icon: <DollarSign size={20} />, readOnly: true, disabled: true, className: 'bg-gray-50', mask: 'money' },
          { field: 'rent_due_day', label: 'Vencimento Aluguel', type: 'text', required: true, icon: <Calendar size={20} /> },
          { field: 'tax_due_day', label: 'Vencimento IPTU', type: 'text', icon: <Calendar size={20} /> },
          { field: 'condo_due_day', label: 'Vencimento Condomínio', type: 'text', icon: <Calendar size={20} /> },
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
              <div className="mb-2 p-4 bg-surface border border-ui-border rounded-lg flex items-center gap-4">
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
            field: 'iptu_year',
            label: 'Ano do Exercício (IPTU)',
            type: 'number',
            required: false,
            icon: <Calendar size={20} />,
            placeholder: new Date().getFullYear().toString(),
            defaultValue: new Date().getFullYear().toString(),
            maxLength: 4,
            min: 2000,
            max: 2100,
          },
          {
            field: 'payment_condition',
            label: 'Selecione o Método de Pagamento Desta Locação',
            type: 'select',
            required: false,
            options: [
              { label: 'À vista (com 15% de desconto)', value: 'IN_FULL_15_DISCOUNT' },
              { label: 'Parcelado na 2ª (com 10% de desconto)', value: 'SECOND_INSTALLMENT_10_DISCOUNT' },
              { label: 'Parcelado (Livre)', value: 'INSTALLMENTS' }
            ],
            icon: <CreditCard size={20} />,
            className: 'col-span-full',
          },
          {
            field: 'property_tax_cash',
            label: 'Valor de Cobrança: À vista',
            type: 'text',
            required: true,
            icon: <DollarSign size={20} />,
            mask: 'money',
            hidden: (fv) => fv?.payment_condition !== 'IN_FULL_15_DISCOUNT',
          },
          {
            field: 'property_tax_cash_due_date',
            label: 'Data de Vencimento (À vista)',
            type: 'date',
            required: true,
            icon: <Calendar size={20} />,
            hidden: (fv) => fv?.payment_condition !== 'IN_FULL_15_DISCOUNT',
          },
          {
            field: 'property_tax_first_installment',
            label: 'Valor de Cobrança: 1ª Parcela',
            type: 'text',
            required: true,
            icon: <DollarSign size={20} />,
            mask: 'money',
            hidden: (fv) => fv?.payment_condition !== 'SECOND_INSTALLMENT_10_DISCOUNT',
          },
          {
            field: 'property_tax_first_installment_due_date',
            label: 'Data de Vencimento: 1ª Parcela',
            type: 'date',
            required: true,
            icon: <Calendar size={20} />,
            hidden: (fv) => fv?.payment_condition !== 'SECOND_INSTALLMENT_10_DISCOUNT',
          },
          {
            field: 'property_tax_second_installment',
            label: 'Valor de Cobrança: 2ª Parcela (com desconto)',
            type: 'text',
            required: true,
            icon: <DollarSign size={20} />,
            mask: 'money',
            hidden: (fv) => fv?.payment_condition !== 'SECOND_INSTALLMENT_10_DISCOUNT',
          },
          {
            field: 'property_tax_second_installment_due_date',
            label: 'Data de Vencimento: 2ª Parcela',
            type: 'date',
            required: true,
            icon: <Calendar size={20} />,
            hidden: (fv) => fv?.payment_condition !== 'SECOND_INSTALLMENT_10_DISCOUNT',
          },
          {
            field: 'iptu_installments_count',
            label: 'Número de Parcelas (Ex: 10, 12, 14)',
            type: 'number',
            icon: <Hash size={20} />,
            required: true,
            hidden: (fv) => fv?.payment_condition !== 'INSTALLMENTS',
          },
          {
            field: 'iptu_installments',
            label: '',
            type: 'custom',
            hidden: (fv) => fv?.payment_condition !== 'INSTALLMENTS',
            render: (value: any, fv: any, onChange: any) => {
              const arr = Array.isArray(value) ? value : [];
              if (arr.length === 0) return null;

              // Estrutura: cada item tem { value, due_date }
              const normalizedArr = arr.map((item: any) => {
                if (typeof item === 'string') {
                  return { value: item, due_date: '' };
                }
                return item || { value: '', due_date: '' };
              });

              const handleValChange = (index: number, val: string) => {
                const newArr = [...normalizedArr];
                newArr[index] = { ...newArr[index], value: val };
                onChange(newArr);
              };

              const handleDateChange = (index: number, date: string) => {
                const newArr = [...normalizedArr];
                newArr[index] = { ...newArr[index], due_date: date };
                onChange(newArr);
              };

              const repeatFirst = () => {
                if (normalizedArr.length > 0 && normalizedArr[0].value) {
                  const firstValue = normalizedArr[0].value;
                  const firstDate = normalizedArr[0].due_date;
                  const newArr = normalizedArr.map((item, idx) => {
                    let newDate = firstDate;
                    if (firstDate) {
                      const date = new Date(firstDate);
                      date.setMonth(date.getMonth() + idx);
                      newDate = date.toISOString().split('T')[0];
                    }
                    return { value: firstValue, due_date: newDate };
                  });
                  onChange(newArr);
                }
              };

              const titleText = arr.length === 1
                ? 'Detalhamento de 1 Parcela'
                : `Detalhamento das ${arr.length} Parcelas`;

              return (
                <div className="flex flex-col gap-4 col-span-full border p-5 rounded-xl bg-surface-subtle shadow-sm mt-2 w-full">
                  <div className="flex flex-col sm:flex-row sm:justify-between sm:items-center gap-3">
                    <span className="text-[15px] font-semibold text-content border-l-4 border-brand pl-3">
                      {titleText}
                    </span>
                    {normalizedArr.length > 1 && (
                      <button
                        type="button"
                        onClick={repeatFirst}
                        className="flex items-center justify-center gap-2 text-sm bg-brand text-white px-4 py-2 rounded-lg hover:bg-brand-hover shadow-md transition-all active:scale-95 font-medium"
                      >
                        <Copy size={16} />
                        Repetir 1ª Parcela
                      </button>
                    )}
                  </div>
                  <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-3">
                    {normalizedArr.map((item, idx) => (
                      <div key={`inst-${idx}`} className="bg-surface p-3 rounded-lg border border-ui-border space-y-2">
                        <label className="block text-xs text-content-muted font-medium">{idx + 1}ª Parcela</label>
                        <input
                          type="text"
                          value={item.value || ''}
                          onChange={(e) => {
                            const raw = e.target.value.replace(/\D/g, '');
                            if (!raw) { handleValChange(idx, ''); return; }
                            const num = (parseFloat(raw) / 100).toFixed(2);
                            const formatted = new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(parseFloat(num));
                            handleValChange(idx, formatted);
                          }}
                          placeholder="R$ 0,00"
                          className="w-full h-9 px-3 border border-ui-border rounded-md text-sm outline-none focus:ring-2 focus:ring-brand focus:border-brand"
                        />
                        <input
                          type="date"
                          value={item.due_date || ''}
                          onChange={(e) => handleDateChange(idx, e.target.value)}
                          className="w-full h-9 px-3 border border-ui-border rounded-md text-sm outline-none focus:ring-2 focus:ring-brand focus:border-brand"
                        />
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
            required: false,
            icon: <Building size={20} />,
            placeholder: 'Ex: Porto Seguro CIA de Seguros Gerais',
            className: 'col-span-full',
          },
          {
            field: 'insurance_type',
            label: 'Tipo de Seguro',
            type: 'text',
            required: false,
            icon: <Shield size={20} />,
            placeholder: 'Ex: Seguro Aluguel',
            className: 'col-span-full',
          },
          {
            field: 'insurance_policy',
            label: 'Apólice',
            type: 'text',
            required: false,
            icon: <FileText size={20} />,
            placeholder: 'Ex: PAC – Nº 102216180',
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
          { field: 'canceled_at', label: 'Data de Cancelamento', type: 'date', required: true, icon: <Calendar size={20} /> },
          { field: 'cancellation_penalty', label: 'Valor da Multa', type: 'text', icon: <DollarSign size={20} />, mask: 'money' },
          { field: 'other_cancellation_amounts', label: 'Outros Valores', type: 'text', icon: <DollarSign size={20} />, mask: 'money' },
          { field: 'cancellation_justification', label: 'Justificativa', type: 'textarea', rows: 3, icon: <FileText size={20} />, className: 'col-span-full' },
        ]
      });
    }

    // Mídias — sempre a ÚLTIMA aba. Anexa arquivos (ex.: contrato) à locação.
    baseSteps.push({
      title: 'Mídias',
      icon: <Upload size={20} />,
      fields: [
        {
          field: 'arquivosLocacao',
          label: 'Arquivos da Locação (ex.: contrato)',
          type: 'file',
          accept: '.pdf',
          multiple: true,
          maxFiles: 10,
          textButton: 'Escolher arquivos',
          placeholder: 'Nenhum arquivo selecionado',
          icon: <FileText size={20} />,
          className: 'col-span-full w-full',
        } as any,
      ],
    });

    // Cancelamento — botão que abre o modal de cancelamento. Fica DEPOIS de Mídias
    // e só para locações ainda não canceladas (a locação cancelada exibe a aba de
    // detalhes do cancelamento acima). Fase 1: apenas abre o formulário do modal.
    if (!isCanceled) {
      baseSteps.push({
        title: 'Cancelamento',
        icon: <AlertCircle size={20} />,
        fields: [
          {
            field: 'cancellation_action',
            label: '',
            type: 'custom',
            className: 'col-span-full',
            render: () => (
              <div className="flex flex-col items-start gap-3 rounded-xl border border-ui-border-soft bg-surface-subtle p-5">
                <div className="flex items-center gap-2">
                  <div className="p-2 rounded-lg bg-red-50 text-red-600">
                    <AlertCircle size={20} />
                  </div>
                  <div>
                    <p className="text-[15px] font-semibold text-content">Cancelamento antecipado</p>
                    <p className="text-[13px] text-content-secondary">
                      Encerre a locação antes do vencimento, revise os lançamentos futuros e lance encargos (se houver).
                    </p>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => setCancelModalOpen(true)}
                  className="px-5 py-2 text-sm font-medium text-white bg-red-600 rounded-lg hover:bg-red-700 transition-colors"
                >
                  Iniciar Cancelamento
                </button>
              </div>
            ),
          } as any,
        ],
      });
    }

    return baseSteps;
  }, [properties, tenants, agencies, institutionOptions, loadingData, isCanceled]);

  const onSubmitSuccess = (result?: any) => {
    showMessage('Locação atualizada com sucesso!', 'success');
    const warnings: string[] = result?.warnings || [];
    warnings.forEach((w) => showMessage(w, 'info'));
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
    <>
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

      {cancelModalOpen && (
        <LeaseCancellationModal
          leaseId={id}
          contractNumber={formValues?.contract_number}
          startDate={formValues?.start_date}
          endDate={formValues?.end_date}
          onClose={() => setCancelModalOpen(false)}
          onCancelled={() => {
            setCancelModalOpen(false);
            showMessage('Locação cancelada. Redirecionando...', 'success');
            router.push('/dashboard/locacoes');
          }}
        />
      )}
    </>
  );
}