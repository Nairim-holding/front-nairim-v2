/* eslint-disable @typescript-eslint/no-explicit-any */
'use client';

import { useState, useMemo } from 'react';
import { useRouter } from 'next/navigation';
import { useMessageContext } from '@/contexts/MessageContext';
import DynamicFormManager from '@/components/form/DynamicForm';
import ContactManager from '@/components/domain/contacts/ContactManager';
import { FormStep } from '@/types/types';
import {
  User, MapPin, Phone, FileText, Hash,
  Building as BuildingIcon, Globe, MapPin as MapPinIcon, User as UserIcon
} from 'lucide-react';

export default function CadastrarFornecedorPage() {
  const router = useRouter();
  const { showMessage } = useMessageContext();
  
  // Estado para controlar o desbloqueio dos campos de endereço
  const [isManualAddress, setIsManualAddress] = useState(false);

  const handleFieldChange = async (fieldName: string, value: any) => {
    if (fieldName === 'zip_code' && value) {
      const cleanCEP = value.replace(/\D/g, '');
      
      if (cleanCEP.length === 8) {
        try {
          showMessage('Buscando CEP...', 'info');
          const response = await fetch(`/api/cep/${cleanCEP}`);
          
          if (!response.ok) {
            if (response.status === 404) {
              setIsManualAddress(true);
              showMessage('CEP não encontrado. Os campos de endereço foram liberados para preenchimento manual.', 'error');
              return { street: '', district: '', city: '', state: '' }; 
            }
            
            const errorData = await response.json().catch(() => ({}));
            throw new Error(errorData.error || errorData.message || 'Não foi possível buscar o CEP.');
          }

          const data = await response.json();
          
          if (data.error || data.erro) {
            throw new Error(data.error || 'CEP não encontrado.');
          } else {
            setIsManualAddress(false);
            showMessage('Endereço preenchido automaticamente!', 'success');
            
            return {
              street: data.rua || '',
              complement: data.complemento || '',
              district: data.bairro || '',
              city: data.cidade || '',
              state: data.estado || '',
              country: data.pais || 'Brasil',
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
  };

  const handleSubmit = async (data: any) => {
    try {
      const formattedData: any = {
        legal_name: data.legal_name,
        trade_name: data.trade_name || null,
        cnpj: data.cnpj ? data.cnpj.replace(/\D/g, '') : null,
        state_registration: data.state_registration || null,
        municipal_registration: data.municipal_registration || null,
        addresses: [
          {
            zip_code: data.zip_code?.replace(/\D/g, ''),
            street: data.street,
            number: data.number,
            complement: data.complement || null,
            district: data.district,
            city: data.city,
            state: data.state,
            country: data.country || 'Brasil',
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
      const response = await fetch(`${API_URL}/financial-supplier`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(formattedData),
      });

      const result = await response.json();

      if (!response.ok) {
        if (response.status === 409 && result.message?.includes('CNPJ')) {
            throw new Error('CNPJ já está cadastrado para outro fornecedor');
        }
        if (response.status === 400 && result.errors) {
            throw new Error(`Erro de validação: ${result.errors.join(', ')}`);
        }
        throw new Error(result.message || `Erro ${response.status}`);
      }

      return result;

    } catch (error: any) {
      throw new Error(`Erro ao salvar fornecedor: ${error.message}`);
    }
  };

  const steps: FormStep[] = useMemo(() => [
    {
      title: 'Dados do Fornecedor',
      icon: <BuildingIcon size={20} />,
      fields: [
        { field: 'legal_name', label: 'Razão Social', type: 'text', required: true, placeholder: 'Razão Social', autoFocus: true, icon: <BuildingIcon size={20} />, className: 'col-span-full' },
        { field: 'trade_name', label: 'Nome Fantasia', type: 'text', required: false, placeholder: 'Nome Fantasia', icon: <BuildingIcon size={20} />, className: 'col-span-full' },
        { field: 'cnpj', label: 'CNPJ', type: 'text', required: false, placeholder: '00.000.000/0000-00', mask: 'cnpj', icon: <FileText size={20} />, className: 'col-span-full' },
        { field: 'state_registration', label: 'Inscrição Estadual', type: 'text', required: false, placeholder: 'Inscrição Estadual', icon: <Hash size={20} /> },
        { field: 'municipal_registration', label: 'Inscrição Municipal', type: 'text', required: false, placeholder: 'Inscrição Municipal', icon: <Hash size={20} /> },
      ],
    },
    {
      title: 'Endereço',
      icon: <MapPin size={20} />,
      fields: [
        { field: 'zip_code', label: 'CEP', type: 'text', required: true, placeholder: '00000-000', mask: 'cep', icon: <MapPinIcon size={20} />, className: 'col-span-full' },
        { field: 'street', label: 'Rua', type: 'text', required: true, placeholder: 'Rua das Flores', icon: <MapPinIcon size={20} />, disabled: !isManualAddress, readOnly: !isManualAddress, className: 'col-span-full' },
        { field: 'number', label: 'Número', type: 'text', required: true, placeholder: '123', icon: <Hash size={20} /> },
        { field: 'complement', label: 'Complemento', type: 'text', required: false, placeholder: 'Sala 1', icon: <MapPinIcon size={20} /> },
        { field: 'district', label: 'Bairro', type: 'text', required: true, placeholder: 'Centro', icon: <MapPinIcon size={20} />, disabled: !isManualAddress, readOnly: !isManualAddress },
        { field: 'city', label: 'Cidade', type: 'text', required: true, placeholder: 'São Paulo', icon: <MapPinIcon size={20} />, disabled: !isManualAddress, readOnly: !isManualAddress },
        { field: 'state', label: 'Estado', type: 'text', required: true, placeholder: 'SP', icon: <Globe size={20} />, disabled: !isManualAddress, readOnly: !isManualAddress },
        { field: 'country', label: 'País', type: 'text', required: true, placeholder: 'Brasil', defaultValue: 'Brasil', icon: <Globe size={20} />, disabled: !isManualAddress, readOnly: !isManualAddress }
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
            <ContactManager value={value} onChange={onChange} resourceType="financial-supplier" />
          )
        }
      ],
    },
  ], [isManualAddress]);

  const onSubmitSuccess = () => {
    showMessage('Fornecedor criado com sucesso!', 'success');
    router.push('/dashboard/fornecedores');
  };

  return (
    <DynamicFormManager
      resource="financial-supplier"
      title="Fornecedor"
      basePath="/dashboard/fornecedores"
      mode="create"
      steps={steps}
      onSubmit={handleSubmit}
      onSubmitSuccess={onSubmitSuccess}
      onFieldChange={handleFieldChange}
    />
  );
}