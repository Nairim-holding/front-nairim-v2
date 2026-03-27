/* eslint-disable @typescript-eslint/no-explicit-any */
'use client';

import { useParams } from 'next/navigation';
import { useMemo, useRef, useCallback, useState } from 'react';
import { useMessageContext } from '@/contexts/MessageContext';
import { useRouter } from 'next/navigation';
import DynamicFormManager from '@/components/form/DynamicForm';
import ContactManager from '@/components/domain/contacts/ContactManager';
import { FormStep } from '@/types/types';
import {
  User, MapPin, Phone, FileText, Hash,
  Briefcase, Heart, Globe,
  Building as BuildingIcon,
  MapPin as MapPinIcon
} from 'lucide-react';

export default function EditarProprietarioPage() {
  const params = useParams();
  const id = params.id as string;
  
  const { showMessage } = useMessageContext();
  const router = useRouter();
  
  const lastFetchedCep = useRef('');
  
  // NOVO: Estado para controle de preenchimento manual no modo edição
  const [isManualAddress, setIsManualAddress] = useState(false);

  // 1. Uso do useCallback para evitar recriação da função e recarregamento dos dados
  const handleFieldChange = useCallback(async (fieldName: string, value: any) => {
    if (fieldName === 'zip_code' && value) {
      const cleanCEP = value.replace(/\D/g, '');
      
      if (cleanCEP.length < 8) {
        lastFetchedCep.current = '';
        return null;
      }

      if (cleanCEP.length === 8) {
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
              return { street: '', district: '', city: '', state: '' };
            }
            throw new Error('Erro ao buscar CEP');
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
            };
          }
        } catch (error: any) {
          console.error('Erro ao buscar CEP:', error);
          showMessage(error.message || 'Erro ao buscar CEP.', 'error');
          setIsManualAddress(true);
          return null;
        }
      }
    }
    return null;
  }, [showMessage]);

  // 2. Uso do useCallback para evitar recriação
  const handleSubmit = useCallback(async (data: any) => {
    try {
      const tipo = data.owner_type || (data.cpf ? 'fisica' : 'juridica');
      
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
      } else if (tipo === 'juridica') {
        formattedData.cnpj = data.cnpj ? data.cnpj.replace(/\D/g, '') : null;
        formattedData.state_registration = data.state_registration || null;
        formattedData.municipal_registration = data.municipal_registration || null;
        formattedData.occupation = null;
        formattedData.marital_status = null;
        formattedData.cpf = null;
      }

      const API_URL = process.env.NEXT_PUBLIC_URL_API;
      const response = await fetch(`${API_URL}/owners/${id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(formattedData),
      });

      const result = await response.json();

      if (!response.ok) {
        if (response.status === 400 && result.errors) throw new Error(`Erro de validação: ${result.errors.join(', ')}`);
        if (response.status === 409) {
          if (result.message?.includes('CPF')) throw new Error('CPF já cadastrado');
          if (result.message?.includes('CNPJ')) throw new Error('CNPJ já cadastrado');
          if (result.message?.includes('internal_code')) throw new Error('Código Interno já está em uso por outro proprietário');
        }
        throw new Error(result.message || 'Erro ao atualizar');
      }

      return result;

    } catch (error: any) {
      throw new Error(error.message);
    }
  }, [id]);

  // 3. CRUCIAL: Uso do useCallback no transformData. 
  // Se essa função mudar, o DynamicFormManager recarrega os dados do zero.
  const transformData = useCallback((apiData: any) => {
    if (!apiData) return {};
    
    const address = apiData.addresses?.[0]?.address || {};
    
    // Atualiza o cache apenas se ainda estiver vazio, para não interferir na edição
    if (address.zip_code && !lastFetchedCep.current) {
        lastFetchedCep.current = address.zip_code.replace(/\D/g, '');
    }

    return {
      owner_type: apiData.cpf ? 'fisica' : 'juridica',
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
  }, []); // Array de dependências vazio pois não usa props externas que mudam

  const steps: FormStep[] = useMemo(() => [
    {
      title: 'Dados do Proprietário',
      icon: <User size={20} />,
      fields: [
        {
          field: 'owner_type',
          label: '',
          type: 'text',
          hidden: true,
        },
        {
          field: 'name',
          label: 'Nome/Razão Social',
          type: 'text',
          required: true,
          placeholder: 'Nome ou razão social',
          className: 'col-span-full',
        },
        {
          field: 'internal_code',
          label: 'Código Interno',
          type: 'text',
          required: true,
          placeholder: 'Código interno',
          icon: <Hash size={20} />,
        },
        {
          field: 'occupation',
          label: 'Profissão',
          type: 'text',
          required: true,
          placeholder: 'Profissão',
          icon: <Briefcase size={20} />,
          className: 'col-span-full',
          hidden: (formValues: any) => formValues.owner_type === 'juridica',
        },
        {
          field: 'marital_status',
          label: 'Estado Civil',
          type: 'select',
          required: true,
          options: [
            { value: 'Solteiro(a)', label: 'Solteiro(a)' },
            { value: 'Casado(a)', label: 'Casado(a)' },
            { value: 'Separado(a) judicialmente', label: 'Separado(a) judicialmente' },
            { value: 'Divorciado(a)', label: 'Divorciado(a)' },
            { value: 'Viúvo(a)', label: 'Viúvo(a)' }
          ],
          icon: <Heart size={20} />,
          hidden: (formValues: any) => formValues.owner_type === 'juridica',
        },
        {
          field: 'cpf',
          label: 'CPF',
          type: 'text',
          required: true,
          placeholder: '000.000.000-00',
          mask: 'cpf',
          icon: <FileText size={20} />,
          hidden: (formValues: any) => formValues.owner_type === 'juridica',
        },
        {
          field: 'cnpj',
          label: 'CNPJ',
          type: 'text',
          required: true,
          placeholder: '00.000.000/0000-00',
          mask: 'cnpj',
          icon: <FileText size={20} />,
          hidden: (formValues: any) => formValues.owner_type === 'fisica',
        },
        {
          field: 'state_registration',
          label: 'Inscrição Estadual',
          type: 'text',
          required: false,
          placeholder: 'Inscrição estadual',
          icon: <BuildingIcon size={20} />,
          hidden: (formValues: any) => formValues.owner_type === 'fisica',
        },
        {
          field: 'municipal_registration',
          label: 'Inscrição Municipal',
          type: 'text',
          required: false,
          placeholder: 'Inscrição municipal',
          icon: <BuildingIcon size={20} />,
          hidden: (formValues: any) => formValues.owner_type === 'fisica',
        },
      ],
    },
    {
      title: 'Endereço',
      icon: <MapPin size={20} />,
      fields: [
        { field: 'zip_code', label: 'CEP', type: 'text', required: true, mask: 'cep', className: 'col-span-full' },
        // NOVO: Propriedades disabled e readOnly dinâmicas
        { field: 'street', label: 'Rua', type: 'text', required: true, disabled: !isManualAddress, readOnly: !isManualAddress, className: 'col-span-full' },
        { field: 'number', label: 'Número', type: 'text', required: true, icon: <Hash size={20} /> },
        { field: 'complement', label: 'Complemento', type: 'text', required: false, placeholder: 'Apto 123, Bloco B', icon: <MapPinIcon size={20} /> },
        { field: 'district', label: 'Bairro', type: 'text', required: true, disabled: !isManualAddress, readOnly: !isManualAddress },
        { field: 'city', label: 'Cidade', type: 'text', required: true, disabled: !isManualAddress, readOnly: !isManualAddress },
        { field: 'state', label: 'Estado', type: 'text', required: true, disabled: !isManualAddress, readOnly: !isManualAddress, icon: <Globe size={20} /> },
        { field: 'country', label: 'País', type: 'text', required: true, defaultValue: 'Brasil', disabled: !isManualAddress, readOnly: !isManualAddress, icon: <Globe size={20} /> }
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
              resourceType="owners"
            />
          )
        }
      ],
    },
  ], [isManualAddress]); // Dependência atualizada

  const onSubmitSuccess = useCallback((data: any) => {
    showMessage('Proprietário atualizado com sucesso!', 'success');
    router.push('/dashboard/proprietarios');
  }, [showMessage, router]);

  return (
    <DynamicFormManager
      resource="owners"
      title="Proprietário"
      basePath="/dashboard/proprietarios"
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