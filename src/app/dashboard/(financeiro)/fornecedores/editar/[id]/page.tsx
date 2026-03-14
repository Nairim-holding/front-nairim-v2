/* eslint-disable @typescript-eslint/no-explicit-any */
'use client';

import { useParams, useRouter } from 'next/navigation';
import { useMemo, useRef, useCallback, useState } from 'react';
import { useMessageContext } from '@/contexts/MessageContext';
import DynamicFormManager from '@/components/DynamicFormManager';
import ContactManager from '@/components/ContactManager';
import { FormStep } from '@/types/types';
import {
  User, MapPin, Phone, FileText, Hash,
  Building as BuildingIcon, Globe, MapPin as MapPinIcon, User as UserIcon
} from 'lucide-react';

export default function EditarFornecedorPage() {
  const params = useParams();
  const id = params.id as string;
  const router = useRouter();
  const { showMessage } = useMessageContext();

  const lastFetchedCep = useRef('');
  const [isManualAddress, setIsManualAddress] = useState(false);

  const handleFieldChange = useCallback(async (fieldName: string, value: any) => {
    if (fieldName === 'zip_code' && value) {
      const cleanCEP = value.replace(/\D/g, '');
      
      if (cleanCEP.length < 8) {
        lastFetchedCep.current = '';
        return null;
      }

      if (cleanCEP.length === 8) {
        if (cleanCEP === lastFetchedCep.current) return null;
        lastFetchedCep.current = cleanCEP;

        try {
          showMessage('Buscando CEP...', 'info');
          const response = await fetch(`/api/cep/${cleanCEP}`);
          
          if (!response.ok) {
            if (response.status === 404) {
              setIsManualAddress(true);
              showMessage('CEP não encontrado. Os campos foram liberados.', 'error');
              return { street: '', district: '', city: '', state: '' };
            }
            throw new Error(`Erro ${response.status}`);
          }
          
          const data = await response.json();
          
          if (data.error) {
            showMessage(data.error, 'error');
            return null;
          } else {
            setIsManualAddress(false);
            showMessage('Endereço atualizado!', 'success');
            return {
              street: data.rua || '',
              district: data.bairro || '',
              city: data.cidade || '',
              state: data.estado || '',
              country: 'Brasil',
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
      const response = await fetch(`${API_URL}/financial-supplier/${id}`, {
        method: 'PUT',
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
        throw new Error(result.message || `Erro ao atualizar fornecedor`);
      }

      return result;

    } catch (error: any) {
      throw new Error(error.message);
    }
  }, [id]);

  const transformData = useCallback((apiData: any) => {
    if (!apiData) return {};
    const address = apiData.addresses?.[0]?.address || {};
    
    if (address.zip_code && !lastFetchedCep.current) {
        lastFetchedCep.current = address.zip_code.replace(/\D/g, '');
    }

    return {
      legal_name: apiData.legal_name || '',
      trade_name: apiData.trade_name || '',
      cnpj: apiData.cnpj || '',
      municipal_registration: apiData.municipal_registration || '',
      state_registration: apiData.state_registration || '',
      zip_code: address.zip_code || '',
      street: address.street || '',
      number: address.number || '',
      complement: address.complement || '',
      district: address.district || '',
      city: address.city || '',
      state: address.state || '',
      country: address.country || 'Brasil',
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
      title: 'Dados do Fornecedor',
      icon: <BuildingIcon size={20} />,
      fields: [
        { field: 'legal_name', label: 'Razão Social', type: 'text', required: true, icon: <BuildingIcon size={20} />, className: 'col-span-full' },
        { field: 'trade_name', label: 'Nome Fantasia', type: 'text', required: false, icon: <BuildingIcon size={20} />, className: 'col-span-full' },
        { field: 'cnpj', label: 'CNPJ', type: 'text', required: false, mask: 'cnpj', icon: <FileText size={20} />, className: 'col-span-full' },
        { field: 'state_registration', label: 'Inscrição Estadual', type: 'text', required: false, icon: <Hash size={20} /> },
        { field: 'municipal_registration', label: 'Inscrição Municipal', type: 'text', required: false, icon: <Hash size={20} /> },
      ],
    },
    {
      title: 'Endereço',
      icon: <MapPin size={20} />,
      fields: [
        { field: 'zip_code', label: 'CEP', type: 'text', required: true, mask: 'cep', icon: <MapPinIcon size={20} />, className: 'col-span-full' },
        { field: 'street', label: 'Rua', type: 'text', required: true, icon: <MapPinIcon size={20} />, disabled: !isManualAddress, readOnly: !isManualAddress, className: 'col-span-full' },
        { field: 'number', label: 'Número', type: 'text', required: true, icon: <Hash size={20} /> },
        { field: 'complement', label: 'Complemento', type: 'text', required: false, icon: <MapPinIcon size={20} /> },
        { field: 'district', label: 'Bairro', type: 'text', required: true, icon: <MapPinIcon size={20} />, disabled: !isManualAddress, readOnly: !isManualAddress },
        { field: 'city', label: 'Cidade', type: 'text', required: true, icon: <MapPinIcon size={20} />, disabled: !isManualAddress, readOnly: !isManualAddress },
        { field: 'state', label: 'Estado', type: 'text', required: true, icon: <Globe size={20} />, disabled: !isManualAddress, readOnly: !isManualAddress },
        { field: 'country', label: 'País', type: 'text', required: true, defaultValue: 'Brasil', icon: <Globe size={20} />, disabled: !isManualAddress, readOnly: !isManualAddress }
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
            <ContactManager value={value} onChange={onChange} resourceType="financial-supplier" />
          )
        }
      ],
    },
  ], [isManualAddress]);

  const onSubmitSuccess = useCallback(() => {
    showMessage('Fornecedor atualizado com sucesso!', 'success');
    router.push('/dashboard/fornecedores');
  }, [showMessage, router]);

  return (
    <DynamicFormManager
      resource="financial-supplier"
      title="Fornecedor"
      basePath="/dashboard/fornecedores"
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