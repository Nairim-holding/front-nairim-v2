/* eslint-disable @typescript-eslint/no-explicit-any */
'use client';

import { useParams } from 'next/navigation';
import { useMemo, useRef, useCallback, useState } from 'react';
import { useMessageContext } from '@/contexts/MessageContext';
import { useRouter } from 'next/navigation';
import DynamicFormManager from '@/components/form/DynamicForm';
import ContactManager from '@/components/domain/contacts/ContactManager';
import { FormStep } from '@/types/types'
import {
  User, MapPin, Phone, FileText, Hash,
  Briefcase, Heart, User as UserIcon,
  MapPin as MapPinIcon,
  Building as BuildingIcon, Globe
} from 'lucide-react';

export default function EditarInquilinoPage() {
  const params = useParams();
  const id = params.id as string;
  
  const { showMessage } = useMessageContext();
  const router = useRouter();

  // Cache para o CEP
  const lastFetchedCep = useRef('');
  
  // NOVO: Estado para controlar se o usuário precisa preencher manualmente
  const [isManualAddress, setIsManualAddress] = useState(false);

  const handleFieldChange = useCallback(async (fieldName: string, value: any) => {
    if (fieldName === 'zip_code' && value) {
      const cleanCEP = value.replace(/\D/g, '');
      
      // Se apagou, limpa o cache para permitir nova busca futura
      if (cleanCEP.length < 8) {
        lastFetchedCep.current = '';
        return null;
      }

      if (cleanCEP.length === 8) {
        // Se é o mesmo CEP já buscado, para aqui (evita loop)
        if (cleanCEP === lastFetchedCep.current) {
            return null;
        }

        lastFetchedCep.current = cleanCEP;

        try {
          showMessage('Buscando CEP...', 'info');
          // CORRIGIDO: URL para bater com a rota da API
          const response = await fetch(`/api/cep/${cleanCEP}`);
          
          if (!response.ok) {
            if (response.status === 404) {
              // FALLBACK: Libera os campos
              setIsManualAddress(true);
              showMessage('CEP não encontrado. Os campos foram liberados para preenchimento manual.', 'error');
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
            // CORRIGIDO: Mapeamento dos campos da CepNormalizado
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
          setIsManualAddress(true); // Libera os campos em caso de falha de rede também
          return null;
        }
      }
    }
    return null;
  }, [showMessage]);

  const handleSubmit = useCallback(async (data: any) => {
    try {
      const tipo = data.tenant_type || (data.cpf ? 'fisica' : 'juridica');
      
      const formattedData: any = {
        name: data.name,
        internal_code: data.internal_code || null,
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

      if (tipo === 'fisica') {
        formattedData.occupation = data.occupation || null;
        formattedData.marital_status = data.marital_status || null;
        formattedData.cpf = data.cpf ? data.cpf.replace(/\D/g, '') : null;
        formattedData.cnpj = null;
        formattedData.state_registration = null;
        formattedData.municipal_registration = null;
      } else {
        formattedData.cnpj = data.cnpj ? data.cnpj.replace(/\D/g, '') : null;
        formattedData.state_registration = data.state_registration || null;
        formattedData.municipal_registration = data.municipal_registration || null;
        formattedData.occupation = null;
        formattedData.marital_status = null;
        formattedData.cpf = null;
      }

      const API_URL = process.env.NEXT_PUBLIC_URL_API;
      const response = await fetch(`${API_URL}/tenants/${id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(formattedData),
      });

      const result = await response.json();

      if (!response.ok) {
        if (response.status === 409) {
          if (result.message?.includes('CPF')) throw new Error('CPF já cadastrado');
          if (result.message?.includes('CNPJ')) throw new Error('CNPJ já cadastrado');
          if (result.message?.includes('internal_code') || result.message?.includes('Código Interno')) {
            throw new Error('Código Interno já está em uso por outro inquilino');
          }
        }
        if (response.status === 400 && result.errors && result.errors.length > 0) {
            throw new Error(`Erro de validação: ${result.errors.join(', ')}`);
        }
        throw new Error(result.message || `Erro ao salvar inquilino (${response.status})`);
      }

      return result;

    } catch (error: any) {
      throw new Error(error.message);
    }
  }, [id]);

  const transformData = useCallback((apiData: any) => {
    if (!apiData) return {};
    const address = apiData.addresses?.[0]?.address || {};
    
    // Inicializa o cache com o CEP do banco de dados para evitar re-fetch imediato
    if (address.zip_code && !lastFetchedCep.current) {
        lastFetchedCep.current = address.zip_code.replace(/\D/g, '');
    }

    return {
      tenant_type: apiData.cpf ? 'fisica' : 'juridica',
      name: apiData.name || '',
      internal_code: apiData.internal_code || '',
      occupation: apiData.occupation || '',
      marital_status: apiData.marital_status || '',
      cnpj: apiData.cnpj || '',
      cpf: apiData.cpf || '',
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
      title: 'Dados do Inquilino',
      icon: <User size={20} />,
      fields: [
        { field: 'tenant_type', label: '', type: 'text', hidden: true },
        { field: 'name', label: 'Nome/Razão Social', type: 'text', required: true, placeholder: 'Nome', icon: <UserIcon size={20} />, className: 'col-span-full' },
        { field: 'internal_code', label: 'Código Interno', type: 'text', required: true, icon: <Hash size={20} /> },
        { field: 'occupation', label: 'Profissão', type: 'text', required: true, icon: <Briefcase size={20} />, className: 'col-span-full', hidden: (formValues: any) => formValues.tenant_type === 'juridica' },
        {
          field: 'marital_status', label: 'Estado Civil', type: 'select', required: true,
          options: [
            { value: 'Solteiro(a)', label: 'Solteiro(a)' },
            { value: 'Casado(a)', label: 'Casado(a)' },
            { value: 'Separado(a) judicialmente', label: 'Separado(a) judicialmente' },
            { value: 'Divorciado(a)', label: 'Divorciado(a)' },
            { value: 'Viúvo(a)', label: 'Viúvo(a)' }
          ],
          icon: <Heart size={20} />, hidden: (formValues: any) => formValues.tenant_type === 'juridica'
        },
        { field: 'cpf', label: 'CPF', type: 'text', required: true, mask: 'cpf', icon: <FileText size={20} />, hidden: (formValues: any) => formValues.tenant_type === 'juridica' },
        { field: 'cnpj', label: 'CNPJ', type: 'text', required: true, mask: 'cnpj', icon: <FileText size={20} />, hidden: (formValues: any) => formValues.tenant_type === 'fisica' },
        { field: 'state_registration', label: 'Inscrição Estadual', type: 'text', required: false, icon: <BuildingIcon size={20} />, hidden: (formValues: any) => formValues.tenant_type === 'fisica' },
        { field: 'municipal_registration', label: 'Inscrição Municipal', type: 'text', required: false, icon: <BuildingIcon size={20} />, hidden: (formValues: any) => formValues.tenant_type === 'fisica' },
      ],
    },
    {
      title: 'Endereço',
      icon: <MapPin size={20} />,
      fields: [
        { field: 'zip_code', label: 'CEP', type: 'text', required: true, mask: 'cep', icon: <MapPinIcon size={20} />, className: 'col-span-full' },
        // NOVO: As propriedades readOnly e disabled dinâmicas
        { field: 'street', label: 'Rua', type: 'text', required: true, icon: <MapPinIcon size={20} />, disabled: !isManualAddress, readOnly: !isManualAddress, className: 'col-span-full' },
        { field: 'number', label: 'Número', type: 'text', required: true, icon: <Hash size={20} /> },
        { field: 'complement', label: 'Complemento', type: 'text', required: false, placeholder: 'Apto 123, Bloco B', icon: <MapPinIcon size={20} /> },
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
            <ContactManager 
              value={value} 
              onChange={onChange} 
              resourceType="tenants"
            />
          )
        }
      ],
    },
  ], [isManualAddress]); // Dependência isManualAddress adicionada

  const onSubmitSuccess = useCallback(() => {
    showMessage('Inquilino atualizado com sucesso!', 'success');
    router.push('/dashboard/inquilinos');
  }, [showMessage, router]);

  return (
    <DynamicFormManager
      resource="tenants"
      title="Inquilino"
      basePath="/dashboard/inquilinos"
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