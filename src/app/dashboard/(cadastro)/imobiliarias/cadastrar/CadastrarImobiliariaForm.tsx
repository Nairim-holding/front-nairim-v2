/* eslint-disable @typescript-eslint/no-explicit-any */
'use client';

import { useMemo, useState, useCallback } from 'react';
import { useMessageContext } from '@/contexts/MessageContext';
import { useRouter } from 'next/navigation';
import DynamicFormManager from '@/components/form/DynamicForm';
import ContactManager from '@/components/domain/contacts/ContactManager';
import { FormStep } from '@/types/types';
import type { SelectOption } from '../_lib/agencyFinancialOptions';
import {
  Building2, MapPin, Phone, FileText,
  Hash, Globe, Building, Landmark, Percent,
  MapPin as MapPinIcon, CheckCircle
} from 'lucide-react';

interface Props {
  categoryOptions: SelectOption[];
  subcategoriesRaw: { id: string; name: string; category_id: string }[];
}

export default function CadastrarImobiliariaForm({ categoryOptions, subcategoriesRaw }: Props) {
  const { showMessage } = useMessageContext();
  const router = useRouter();

  // NOVO: Estado para controle de fallback do endereço
  const [isManualAddress, setIsManualAddress] = useState(false);

  const handleFieldChange = useCallback(async (fieldName: string, value: any) => {
    if (fieldName === 'commission_category_id') return { commission_subcategory_id: '' };

    if (fieldName === 'zip_code' && value) {
      const cleanCEP = value.replace(/\D/g, '');

      if (cleanCEP.length === 8) {
        try {
          showMessage('Buscando CEP...', 'info');

          // CORRIGIDO: URL para o padrão da API Next.js e fetch
          const response = await fetch(`/api/cep/${cleanCEP}`);

          if (!response.ok) {
            // FALLBACK: Libera os campos caso dê erro 404
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
            // SUCESSO: Bloqueia e preenche
            setIsManualAddress(false);
            showMessage('Endereço preenchido automaticamente!', 'success');

            // CORRIGIDO: Mapeamento para sua interface CepNormalizado
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
          showMessage(error.message || 'Erro ao buscar CEP. Tente novamente.', 'error');
          setIsManualAddress(true); // Fallback em caso de erro de rede
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
      const url = `${API_URL}/agencies`;

      const response = await fetch(url, {
        method: 'POST',
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
      throw new Error(`Erro ao salvar imobiliária: ${error.message}`);
    }
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
          placeholder: 'Nome jurídico completo',
          icon: <FileText size={20} />,
          validation: { minLength: 3, maxLength: 200 },
          className: 'col-span-full',
        },
        {
          field: 'trade_name',
          label: 'Nome Fantasia',
          type: 'text',
          required: true,
          placeholder: 'Nome comercial da imobiliária',
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
          placeholder: '00.000.000/0000-00',
          mask: 'cnpj',
          icon: <Hash size={20} />,
          className: 'col-span-full',
        },
        {
          field: 'state_registration',
          label: 'Inscrição Estadual',
          type: 'text',
          placeholder: 'Inscrição estadual',
          icon: <FileText size={20} />,
        },
        {
          field: 'municipal_registration',
          label: 'Inscrição Municipal',
          type: 'text',
          placeholder: 'Inscrição municipal',
          icon: <FileText size={20} />,
        },
        {
          field: 'license_number',
          label: 'CRECI',
          type: 'text',
          required: true,
          placeholder: 'Número do registro CRECI',
          icon: <CheckCircle size={20} />,
          className: 'col-span-full',
        },
      ],
    },
    {
      title: 'Endereço',
      icon: <MapPin size={20} />,
      fields: [
        { field: 'zip_code', label: 'CEP', type: 'text', required: true, placeholder: '00000-000', mask: 'cep', icon: <MapPinIcon size={20} />, className: 'col-span-full' },
        // NOVO: As propriedades disabled e readOnly agora dependem de isManualAddress
        { field: 'street', label: 'Rua', type: 'text', required: true, placeholder: 'Rua das Flores', icon: <MapPinIcon size={20} />, disabled: !isManualAddress, readOnly: !isManualAddress, className: 'col-span-full' },
        { field: 'number', label: 'Número', type: 'text', required: true, placeholder: '123', icon: <Hash size={20} /> },
        { field: 'complement', label: 'Complemento', type: 'text', icon: <Hash size={20} /> },
        { field: 'district', label: 'Bairro', type: 'text', required: true, placeholder: 'Centro', icon: <MapPinIcon size={20} />, disabled: !isManualAddress, readOnly: !isManualAddress },
        { field: 'city', label: 'Cidade', type: 'text', required: true, placeholder: 'São Paulo', icon: <MapPinIcon size={20} />, disabled: !isManualAddress, readOnly: !isManualAddress },
        { field: 'state', label: 'Estado', type: 'text', required: true, placeholder: 'SP', icon: <Globe size={20} />, disabled: !isManualAddress, readOnly: !isManualAddress },
        { field: 'country', label: 'País', type: 'text', required: true, placeholder: 'Brasil', defaultValue: 'Brasil', icon: <Globe size={20} />, disabled: !isManualAddress, readOnly: !isManualAddress }
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
          defaultValue: [],
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
    showMessage('Imobiliária salva com sucesso!', 'success');
    router.push('/dashboard/imobiliarias');
  }, [showMessage, router]);

  return (
    <DynamicFormManager
      resource="agencies"
      title="Imobiliária"
      basePath="/dashboard/imobiliarias"
      mode="create"
      draftKey="form:agencies:create"
      steps={steps}
      onSubmit={handleSubmit}
      onSubmitSuccess={onSubmitSuccess}
      onFieldChange={handleFieldChange}
    />
  );
}
