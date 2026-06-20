/* eslint-disable @typescript-eslint/no-explicit-any */
'use client';

import { useMemo, useRef, useCallback, useState } from 'react';
import { useMessageContext } from '@/contexts/MessageContext';
import { useRouter } from 'next/navigation';
import DynamicFormManager from '@/components/form/DynamicForm';
import ContactManager from '@/components/domain/contacts/ContactManager';
import { FormStep } from '@/types/types';
import type { SelectOption } from '../../_lib/agencyFinancialOptions';
import {
  Building2, MapPin, Phone, FileText,
  Hash, Globe, Building, Landmark, Percent, MapPin as MapPinIcon, CheckCircle
} from 'lucide-react';

interface Props {
  id: string;
  categoryOptions: SelectOption[];
  subcategoriesRaw: { id: string; name: string; category_id: string }[];
}

export default function EditarImobiliariaForm({ id, categoryOptions, subcategoriesRaw }: Props) {
  const { showMessage } = useMessageContext();
  const router = useRouter();

  const lastFetchedCep = useRef('');

  // NOVO: Estado para controle de preenchimento manual no modo edição
  const [isManualAddress, setIsManualAddress] = useState(false);

  const handleFieldChange = useCallback(async (fieldName: string, value: any) => {
    if (fieldName === 'commission_category_id') return { commission_subcategory_id: '' };

    if (fieldName === 'zip_code' && value) {
      const cleanCEP = value.replace(/\D/g, '');

      // Se apagou, limpa o cache
      if (cleanCEP.length < 8) {
        lastFetchedCep.current = '';
        return null;
      }

      if (cleanCEP.length === 8) {
        // Se já buscou este CEP, ignora
        if (cleanCEP === lastFetchedCep.current) {
            return null;
        }

        lastFetchedCep.current = cleanCEP;

        try {
          showMessage('Buscando CEP...', 'info');
          // CORRIGIDO: Fetch para a rota certa
          const response = await fetch(`/api/cep/${cleanCEP}`);

          if (!response.ok) {
            // FALLBACK
            if (response.status === 404) {
              setIsManualAddress(true);
              showMessage('CEP não encontrado. Os campos de endereço foram liberados para preenchimento manual.', 'error');
              return null; // Não sobrescreve os campos, apenas libera para edição
            }
            throw new Error(`Erro ${response.status}`);
          }

          const data = await response.json();

          if (data.error || data.erro) {
            throw new Error(data.error || 'CEP não encontrado.');
          } else {
            setIsManualAddress(false);
            showMessage('Endereço preenchido automaticamente!', 'success');
            // CORRIGIDO: Normalização de dados
            return {
              street: data.rua || '',
              district: data.bairro || '',
              city: data.cidade || '',
              state: data.estado || '',
              country: data.pais || 'Brasil',
              complement: data.complemento || '',
            };
          }
        } catch (error: any) {
          showMessage(error.message || 'Erro ao buscar CEP.', 'error');
          setIsManualAddress(true);
          return null;
        }
      }
    }
    return null;
  }, [showMessage]);

  const handleSubmit = useCallback(async (data: any) => {
    try {
      const formattedData = {
        trade_name: data.trade_name,
        legal_name: data.legal_name,
        cnpj: data.cnpj?.replace(/\D/g, ''),
        state_registration: data.state_registration || null,
        municipal_registration: data.municipal_registration || null,
        license_number: data.license_number,
        commission_category_id: data.commission_category_id || null,
        commission_subcategory_id: data.commission_subcategory_id || null,
        addresses: [
          {
            zip_code: data.zip_code?.replace(/\D/g, ''),
            street: data.street,
            number: data.number,
            district: data.district,
            city: data.city,
            state: data.state,
            country: data.country || 'Brasil',
            complement: data.complement || null,
          }
        ],
        contacts: data.contacts?.map((c: any) => ({
            contact: c.contact || null,
            phone: c.phone?.replace(/\D/g, '') || null,
            email: c.email || null,
            cellphone: c.cellphone?.replace(/\D/g, '') || null,
        })) || []
      };

      const API_URL = process.env.NEXT_PUBLIC_URL_API;
      const response = await fetch(`${API_URL}/agencies/${id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(formattedData),
      });

      const result = await response.json();

      if (!response.ok) {
        if (response.status === 409 && result.message?.includes('CNPJ')) {
          throw new Error('CNPJ já cadastrado para outra imobiliária');
        }
        throw new Error(result.message || `Erro ${response.status}`);
      }

      return result;

    } catch (error: any) {
      throw new Error(`Erro ao atualizar imobiliária: ${error.message}`);
    }
  }, [id]);

  const transformData = useCallback((apiData: any) => {
    if (!apiData) return {};
    const address = apiData.addresses?.[0]?.address || {};

    // Inicializa o cache com o CEP existente
    if (address.zip_code && !lastFetchedCep.current) {
        lastFetchedCep.current = address.zip_code.replace(/\D/g, '');
    }

    return {
      trade_name: apiData.trade_name || '',
      legal_name: apiData.legal_name || '',
      cnpj: apiData.cnpj || '',
      state_registration: apiData.state_registration || '',
      municipal_registration: apiData.municipal_registration || '',
      license_number: apiData.license_number || '',
      commission_category_id: apiData.commission_category_id || '',
      commission_subcategory_id: apiData.commission_subcategory_id || '',
      zip_code: address.zip_code || '',
      street: address.street || '',
      number: address.number || '',
      district: address.district || '',
      city: address.city || '',
      state: address.state || '',
      country: address.country || 'Brasil',
      complement: address.complement || '',
      contacts: apiData.contacts?.map((c: any) => ({
        contact: c.contact?.contact || c.contact || '',
        phone: c.contact?.phone || c.phone || '',
        cellphone: c.contact?.cellphone || c.cellphone || '',
        email: c.contact?.email || c.email || '',
      })) || []
    };
  }, []);

  const steps: FormStep[] = useMemo(() => [
    {
      title: 'Dados da Imobiliária',
      icon: <Building2 size={20} />,
      fields: [
        {
          field: 'legal_name',
          label: 'Razão Social',
          type: 'text',
          required: true,
          placeholder: 'Nome jurídico',
          icon: <FileText size={20} />,
          validation: { minLength: 3, maxLength: 200 },
          className: 'col-span-full',
        },
        {
          field: 'trade_name',
          label: 'Nome Fantasia',
          type: 'text',
          required: true,
          placeholder: 'Nome comercial',
          autoFocus: true,
          icon: <Building size={20} />,
          validation: { minLength: 3, maxLength: 100 },
          className: 'col-span-full',
        },
        {
          field: 'cnpj',
          label: 'CNPJ',
          type: 'text',
          required: true,
          mask: 'cnpj',
          icon: <Hash size={20} />,
          className: 'col-span-full',
        },
        {
          field: 'state_registration',
          label: 'Inscrição Estadual',
          type: 'text',
          icon: <FileText size={20} />,
        },
        {
          field: 'municipal_registration',
          label: 'Inscrição Municipal',
          type: 'text',
          icon: <FileText size={20} />,
        },
        {
          field: 'license_number',
          label: 'CRECI',
          type: 'text',
          required: true,
          icon: <CheckCircle size={20} />,
          className: 'col-span-full',
        },
      ],
    },
    {
      title: 'Endereço',
      icon: <MapPin size={20} />,
      fields: [
        { field: 'zip_code', label: 'CEP', type: 'text', required: true, mask: 'cep', icon: <MapPinIcon size={20} />, className: 'col-span-full' },
        // NOVO: Propriedades disabled e readOnly dinâmicas
        { field: 'street', label: 'Rua', type: 'text', required: true, icon: <MapPinIcon size={20} />, disabled: !isManualAddress, readOnly: !isManualAddress, className: 'col-span-full' },
        { field: 'number', label: 'Número', type: 'text', required: true, icon: <Hash size={20} /> },
        { field: 'complement', label: 'Complemento', type: 'text', icon: <Hash size={20} /> },
        { field: 'district', label: 'Bairro', type: 'text', required: true, icon: <MapPinIcon size={20} />, disabled: !isManualAddress, readOnly: !isManualAddress },
        { field: 'city', label: 'Cidade', type: 'text', required: true, icon: <MapPinIcon size={20} />, disabled: !isManualAddress, readOnly: !isManualAddress },
        { field: 'state', label: 'Estado', type: 'text', required: true, icon: <Globe size={20} />, disabled: !isManualAddress, readOnly: !isManualAddress },
        { field: 'country', label: 'País', type: 'text', required: true, defaultValue: 'Brasil', icon: <Globe size={20} />, disabled: !isManualAddress, readOnly: !isManualAddress }
      ],
    },
    {
      title: 'Comissão (Financeiro)',
      icon: <Percent size={20} />,
      fields: [
        { field: 'commission_category_id', label: 'Categoria da Comissão', type: 'select', required: false, searchable: true, options: [{ label: 'Nenhuma', value: '' }, ...categoryOptions], icon: <Landmark size={20} />, className: 'col-span-full' } as any,
        {
          field: 'commission_subcategory_id',
          label: 'Subcategoria da Comissão',
          type: 'select',
          required: false,
          searchable: true,
          options: (formValues: any) => {
            const categoryId = formValues?.commission_category_id;
            if (!categoryId) return [{ label: 'Nenhuma', value: '' }];
            return [
              { label: 'Nenhuma', value: '' },
              ...subcategoriesRaw
                .filter((s) => s.category_id === categoryId)
                .map((s) => ({ label: s.name || 'Sem nome', value: s.id })),
            ];
          },
          icon: <Landmark size={20} />,
          className: 'col-span-full',
        } as any,
      ],
    },
    {
      title: 'Contatos',
      icon: <Phone size={20} />,
      fields: [
        {
          field: 'contacts',
          label: 'Lista de Contatos',
          type: 'custom',
          className: 'col-span-full',
          render: (value: any, formValues: any, onChange: any) => (
            <ContactManager
              value={value}
              onChange={onChange}
              resourceType="agencies"
            />
          )
        }
      ],
    },
  ], [isManualAddress, categoryOptions, subcategoriesRaw]);

  const onSubmitSuccess = useCallback(() => {
    showMessage('Imobiliária atualizada com sucesso!', 'success');
    router.push('/dashboard/imobiliarias');
  }, [showMessage, router]);

  return (
    <DynamicFormManager
      resource="agencies"
      title="Imobiliária"
      basePath="/dashboard/imobiliarias"
      mode="edit"
      id={id}
      steps={steps}
      onSubmit={handleSubmit}
      onSubmitSuccess={onSubmitSuccess}
      onFieldChange={handleFieldChange}
      transformData={transformData}
    />
  );
}
