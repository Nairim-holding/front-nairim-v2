/* eslint-disable @typescript-eslint/no-explicit-any */
'use client';

import { useState, useMemo, useEffect, use } from 'react';
import { useRouter } from 'next/navigation';
import { useMessageContext } from '@/contexts/MessageContext';
import DynamicFormManager from '@/components/form/DynamicForm';
import ContactManager from '@/components/domain/contacts/ContactManager';
import { FormStep } from '@/types/types';
import { createTenantAction, getNextTenantInternalCodeAction } from '@/server/actions/tenant';
import {
  User, MapPin, FileText, Hash,
  Briefcase, Heart, Globe, Phone,
  User as UserIcon, MapPin as MapPinIcon,
  Building as BuildingIcon
} from 'lucide-react';

type TenantType = 'fisica' | 'juridica';

type Props = {
  searchParams: Promise<{
    tipo?: TenantType;
  }>;
};

export default function CadastrarInquilinoPage({ searchParams }: Props) {
  const router = useRouter();
  const params = use(searchParams);
  const { showMessage } = useMessageContext();
  
  const tipoParam = params.tipo;
  const [tipoSelecionado, setTipoSelecionado] = useState<TenantType | null>(null);
  
  // NOVO: Estado para controlar o desbloqueio dos campos de endereço
  const [isManualAddress, setIsManualAddress] = useState(false);
  
  // Estado para armazenar o código interno gerado automaticamente
  const [generatedInternalCode, setGeneratedInternalCode] = useState<string>('');

  useEffect(() => {
    if (!tipoParam || !['fisica', 'juridica'].includes(tipoParam)) {
      showMessage('Selecione o tipo de inquilino primeiro', 'error');
      router.push('/dashboard/inquilinos');
      return;
    }
    setTipoSelecionado(tipoParam);
  }, [tipoParam, router, showMessage]);

  // Buscar próximo código interno no backend (MAX numérico + 1 no escopo da empresa).
  // Substitui o antigo sort[internal_code]=desc, que ordenava a string
  // lexicograficamente ("9" > "12") e sugeria códigos já usados.
  useEffect(() => {
    const fetchNextInternalCode = async () => {
      try {
        const result = await getNextTenantInternalCodeAction();
        const nextCode = result.ok ? result.data?.next_internal_code : undefined;
        setGeneratedInternalCode(nextCode ? String(nextCode) : '1');
      } catch (error) {
        console.error('Erro ao buscar próximo código interno:', error);
        setGeneratedInternalCode('1');
      }
    };

    fetchNextInternalCode();
  }, []);

  const handleFieldChange = async (fieldName: string, value: any) => {
    if (fieldName === 'zip_code' && value) {
      const cleanCEP = value.replace(/\D/g, '');
      
      if (cleanCEP.length === 8) {
        try {
          showMessage('Buscando CEP...', 'info');
          // CORRIGIDO: URL atualizada para o padrão da rota da sua API Next.js
          const response = await fetch(`/api/cep/${cleanCEP}`);
          
          if (!response.ok) {
            // FALLBACK: Se a API retornar 404 (ambos falharam), libera os campos
            if (response.status === 404) {
              setIsManualAddress(true);
              showMessage('CEP não encontrado. Os campos de endereço foram liberados para preenchimento manual.', 'error');
              return null; // Não sobrescreve os campos, apenas libera para edição
            }
            
            const errorData = await response.json().catch(() => ({}));
            throw new Error(errorData.error || errorData.message || 'Não foi possível buscar o CEP no momento.');
          }

          const data = await response.json();
          
          if (data.error || data.erro) {
            throw new Error(data.error || 'CEP não encontrado.');
          } else {
            // SUCESSO: Bloqueia os campos novamente e preenche
            setIsManualAddress(false);
            showMessage('Endereço preenchido automaticamente!', 'success');
            
            // CORRIGIDO: Mapeamento de acordo com a interface CepNormalizado da sua API
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
          // Em caso de erro, libera os campos sem sobrescrever os valores existentes
          setIsManualAddress(true);
          return null; // Não sobrescreve os campos, apenas libera para edição
        }
      }
    }
    return null;
  };

  const handleSubmit = async (data: any) => {
    try {
      const tipo = tipoSelecionado || (data.cpf ? 'fisica' : 'juridica');
      
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
            // Sem isso os telefones/e-mails extras (Etapa 3) somem ao salvar.
            channels: (c.channels || []).map((ch: any) => ({
              ...ch,
              value: ch.kind === 'EMAIL' ? ch.value : String(ch.value ?? '').replace(/\D/g, ''),
            })),
        })) || []
      };

      if (tipo === 'fisica') {
        formattedData.occupation = data.occupation || null;
        formattedData.marital_status = data.marital_status || null;
        formattedData.nationality = data.nationality || null;
        formattedData.cpf = data.cpf ? data.cpf.replace(/\D/g, '') : null;
        formattedData.rg = data.rg || null;
        formattedData.rg_issuing_body = data.rg_issuing_body || null;
        formattedData.rg_issuing_state = data.rg_issuing_state || null;
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

      const result = await createTenantAction(formattedData);

      if (!result.ok) {
        if (result.status === 409) {
          if (result.error?.includes('CPF')) throw new Error('CPF já cadastrado');
          if (result.error?.includes('CNPJ')) throw new Error('CNPJ já cadastrado');
          if (result.error?.includes('internal_code') || result.error?.includes('Código Interno')) {
            throw new Error('Código Interno já está em uso por outro inquilino');
          }
        }
        if (result.status === 400 && result.errors) {
          throw new Error(`Erro de validação: ${result.errors.join(', ')}`);
        }
        throw new Error(result.error || `Erro ${result.status}`);
      }

      return result;

    } catch (error: any) {
      throw new Error(`Erro ao salvar inquilino: ${error.message}`);
    }
  };

  const steps: FormStep[] = useMemo(() => {
    if (!tipoSelecionado) return [];

    return [
      {
        title: 'Dados do Inquilino',
        icon: <User size={20} />,
        fields: [
          {
            field: 'name',
            label: tipoSelecionado === 'fisica' ? 'Nome Completo' : 'Razão Social',
            type: 'text',
            required: true,
            placeholder: tipoSelecionado === 'fisica' ? 'Nome completo' : 'Razão social da empresa',
            autoFocus: true,
            icon: <UserIcon size={20} />,
            validation: { minLength: 3, maxLength: 200 },
            className: 'col-span-full',
          },
          {
            field: 'internal_code',
            label: 'Código Interno',
            type: 'text',
            required: true,
            placeholder: 'Código interno',
            icon: <Hash size={20} />,
            defaultValue: generatedInternalCode,
          },
          ...(tipoSelecionado === 'fisica' ? [
            {
              field: 'nationality',
              label: 'Nacionalidade',
              type: 'text',
              placeholder: 'Brasileira',
              icon: <Globe size={20} />,
            } as any,
            {
              field: 'occupation',
              label: 'Profissão',
              type: 'text',
              placeholder: 'Profissão',
              icon: <Briefcase size={20} />,
              className: 'col-span-full',
            } as any,
            {
              field: 'marital_status',
              label: 'Estado Civil',
              type: 'select',
              options: [
                { value: 'Solteiro(a)', label: 'Solteiro(a)' },
                { value: 'Casado(a)', label: 'Casado(a)' },
                { value: 'Separado(a) judicialmente', label: 'Separado(a) judicialmente' },
                { value: 'Divorciado(a)', label: 'Divorciado(a)' },
                { value: 'Viúvo(a)', label: 'Viúvo(a)' }
              ],
              icon: <Heart size={20} />,
            } as any,
            {
              field: 'cpf',
              label: 'CPF',
              type: 'text',
              required: true,
              placeholder: '000.000.000-00',
              mask: 'cpf',
              icon: <FileText size={20} />,
            } as any,
            {
              field: 'rg',
              label: 'RG',
              type: 'text',
              placeholder: '00.000.000-0',
              mask: 'rg',
              icon: <FileText size={20} />,
            } as any,
            {
              field: 'rg_issuing_body',
              label: 'Órgão Expedidor',
              type: 'text',
              placeholder: 'SSP (Secretaria Segurança Pública)',
              icon: <BuildingIcon size={20} />,
            } as any,
            {
              field: 'rg_issuing_state',
              label: 'UF Expedidor',
              type: 'text',
              placeholder: 'SP',
              icon: <Globe size={20} />,
            } as any,
          ] : []),
          ...(tipoSelecionado === 'juridica' ? [
            {
              field: 'cnpj',
              label: 'CNPJ',
              type: 'text',
              required: true,
              placeholder: '00.000.000/0000-00',
              mask: 'cnpj',
              icon: <FileText size={20} />,
            } as any,
            {
              field: 'state_registration',
              label: 'Inscrição Estadual',
              type: 'text',
              placeholder: 'Inscrição Estadual',
              icon: <BuildingIcon size={20} />,
            } as any,
            {
              field: 'municipal_registration',
              label: 'Inscrição Municipal',
              type: 'text',
              placeholder: 'Inscrição Municipal',
              icon: <BuildingIcon size={20} />,
            } as any,
          ] : []),
        ],
      },
      {
        title: 'Endereço',
        icon: <MapPin size={20} />,
        fields: [
          { field: 'zip_code', label: 'CEP', type: 'text', required: true, placeholder: '00000-000', mask: 'cep', icon: <MapPinIcon size={20} />, className: 'col-span-full' },
          // NOVO: As propriedades disabled e readOnly agora dependem do isManualAddress
          { field: 'street', label: 'Rua', type: 'text', required: true, placeholder: 'Rua das Flores', icon: <MapPinIcon size={20} />, disabled: !isManualAddress, readOnly: !isManualAddress, className: 'col-span-full' },
          { field: 'number', label: 'Número', type: 'text', required: true, placeholder: '123', icon: <Hash size={20} /> },
          { field: 'complement', label: 'Complemento', type: 'text', required: false, placeholder: 'Apto 123, Bloco B', icon: <MapPinIcon size={20} /> },
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
              <ContactManager 
                value={value} 
                onChange={onChange} 
                resourceType="tenants"
              />
            )
          }
        ],
      },
    ];
  }, [tipoSelecionado, isManualAddress, generatedInternalCode]);

  const onSubmitSuccess = () => {
    showMessage('Inquilino criado com sucesso!', 'success');
    router.push('/dashboard/inquilinos');
  };

  if (!tipoSelecionado) {
    return (
      <div className="flex items-center justify-center h-screen">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-purple-600 mx-auto mb-4"></div>
          <p className="text-gray-600">Carregando...</p>
        </div>
      </div>
    );
  }

  return (
    <DynamicFormManager
      resource="tenants"
      title="Inquilino"
      basePath="/dashboard/inquilinos"
      mode="create"
      draftKey="form:tenants:create"
      steps={steps}
      onSubmit={handleSubmit}
      onSubmitSuccess={onSubmitSuccess}
      onFieldChange={handleFieldChange}
    />
  );
}