/* eslint-disable @typescript-eslint/no-explicit-any */
'use client';

import { useState, useEffect, useMemo } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import DynamicFormManager from '@/components/DynamicFormManager';
import IptuManager from '@/components/IptuManager';
import { FormStep } from '@/types/types';
import { useMessageContext } from '@/contexts/MessageContext';
import { useRouter } from 'next/navigation';
import { 
  Home, MapPin, DollarSign, Upload, Building2, 
  Key, FileText, BedDouble, Bath, Car, Ruler, Sofa,
  HomeIcon, User, Building, DollarSign as Dollar,
  Calendar, File, MapPinIcon, Hash, Globe, Landmark
} from 'lucide-react';

const parseMetric = (value: string | number) => {
  if (!value) return 0;
  if (typeof value === 'number') return value;

  const cleanValue = value.toString().replace(/\./g, '').replace(',', '.');
  
  const numericValue = parseFloat(cleanValue.replace(/[^\d.]/g, ''));
  
  return isNaN(numericValue) ? 0 : numericValue;
};

const parseMoney = (value: string | number) => {
  if (!value && value !== 0 && value !== '0' && value !== '000') return 0;
  const numericValue = typeof value === 'string' ? value.replace(/\D/g, '') : value.toString();
  if (!numericValue) return 0;
  return parseFloat(numericValue) / 100;
};

export default function CadastrarImovelPage() {
  const { user } = useAuth();
  const { showMessage } = useMessageContext();
  const router = useRouter();
  
  const [owners, setOwners] = useState<any[]>([]);
  const [propertyTypes, setPropertyTypes] = useState<any[]>([]);
  const [agencies, setAgencies] = useState<any[]>([]);
  const [loadingData, setLoadingData] = useState(true);
  const [completedSteps, setCompletedSteps] = useState<number[]>([]);
  const [isManualAddress, setIsManualAddress] = useState(false);

  useEffect(() => {
    const fetchInitialData = async () => {
      try {
        const [ownersRes, typesRes, agenciesRes] = await Promise.all([
          fetch(`${process.env.NEXT_PUBLIC_URL_API}/owners`),
          fetch(`${process.env.NEXT_PUBLIC_URL_API}/property-types`),
          fetch(`${process.env.NEXT_PUBLIC_URL_API}/agencies`),
        ]);

        if (!ownersRes.ok || !typesRes.ok || !agenciesRes.ok) throw new Error('Erro ao buscar dados iniciais');

        setOwners((await ownersRes.json()).data || []);
        setPropertyTypes((await typesRes.json()).data || []);
        setAgencies((await agenciesRes.json()).data || []);
      } catch (error) {
        showMessage('Erro ao carregar dados iniciais', 'error');
      } finally {
        setLoadingData(false);
      }
    };
    fetchInitialData();
  }, [showMessage]);

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
              showMessage('CEP não encontrado. Preencha manualmente.', 'error');
              return { street: '', district: '', city: '', state: '', latitude: '', longitude: '' };
            }
            throw new Error('Erro ao buscar CEP');
          }
          const data = await response.json();
          if (data.error || data.erro) throw new Error(data.error || 'CEP não encontrado.');
          
          setIsManualAddress(false);
          showMessage('Endereço preenchido automaticamente!', 'success');
          return {
            street: data.rua || '', district: data.bairro || '', city: data.cidade || '',
            state: data.estado || '', country: data.pais || 'Brasil', latitude: data.latitude || '', longitude: data.longitude || '',
          };
        } catch (error: any) {
          showMessage('Erro ao buscar CEP. Preencha manualmente.', 'error');
          setIsManualAddress(true);
          return null;
        }
      } else if (cleanCEP.length < 8) {
        return { street: '', district: '', city: '', state: '', country: 'Brasil', latitude: '', longitude: '' };
      }
    }
    return null;
  };

  const steps: FormStep[] = useMemo(() => [
    {
      title: 'Dados do Imóvel',
      icon: <Home size={20} />,
      fields: [
        { field: 'title', label: 'Nome Fantasia', type: 'text', required: true, placeholder: 'Nome para o imóvel', autoFocus: true, icon: <HomeIcon size={20} />, className: 'col-span-full' },
        { field: 'bedrooms', label: 'Quartos', type: 'number', required: true, placeholder: 'Quantidade de quartos', showIncrementButtons: true, min: 0, icon: <BedDouble size={20} /> },
        { field: 'bathrooms', label: 'Banheiros', type: 'number', required: true, placeholder: 'Quantidade de banheiros', showIncrementButtons: true, min: 0, icon: <Bath size={20} /> },
        { field: 'half_bathrooms', label: 'Lavabos', type: 'number', required: true, placeholder: 'Quantidade de lavabos', showIncrementButtons: true, min: 0, icon: <Bath size={20} /> },
        { field: 'garage_spaces', label: 'Vagas na Garagem', type: 'number', required: true, placeholder: 'Quantidade de vagas', showIncrementButtons: true, min: 0, icon: <Car size={20} /> },
        { field: 'floor_number', label: 'Número do Andar', type: 'number', required: false, placeholder: 'Número do andar', showIncrementButtons: true, min: 0, icon: <Building size={20} /> },
        { field: 'area_total', label: 'Área Total (m²)', type: 'text', required: true, placeholder: 'Área total', mask: 'metros2', icon: <Ruler size={20} /> },
        { field: 'area_built', label: 'Área Edificada (m²)', type: 'text', required: true, placeholder: 'Área construída', mask: 'metros2', icon: <Ruler size={20} /> },
        { field: 'frontage', label: 'Testada (m)', type: 'text', required: true, placeholder: 'Testada', mask: 'metros', icon: <Ruler size={20} /> },
        { field: 'tax_registration', label: 'Registro Fiscal', type: 'text', required: true, placeholder: 'Número do registro fiscal', icon: <FileText size={20} />, className: 'col-span-full' },
        { field: 'owner_id', label: 'Proprietário', type: 'select', required: true, options: loadingData ? [{ label: 'Carregando...', value: '' }] : owners.map((owner) => ({ label: owner.name || owner.trade_name || owner.legal_name || 'Sem nome', value: owner.id })), icon: <User size={20} />, className: 'col-span-full' },
        { field: 'type_id', label: 'Tipo do imóvel', type: 'select', required: true, searchable: true, options: loadingData ? [{ label: 'Carregando...', value: '' }] : propertyTypes.map((type) => ({ label: type.description || type.name || 'Sem descrição', value: type.id })), icon: <Building2 size={20} />, className: 'col-span-full' },
        { field: 'agency_id', label: 'Imobiliária', type: 'select', required: true, options: loadingData ? [{ label: 'Carregando...', value: '' }] : agencies.map((agency) => ({ label: agency.trade_name || agency.legal_name || agency.name || 'Sem nome', value: agency.id })), icon: <Building size={20} />, className: 'col-span-full' },
        { field: 'furnished', label: 'Mobiliado', type: 'select', required: true, options: [{ label: 'Sim', value: 'true' }, { label: 'Não', value: 'false' }], icon: <Sofa size={20} />, className: 'col-span-full' },
        { field: 'notes', label: 'Observações', type: 'textarea', placeholder: 'Escreva detalhes não especificados anteriormente', rows: 3, icon: <FileText size={20} />, className: 'col-span-full' },
      ],
    },
    {
      title: 'Endereço',
      icon: <MapPin size={20} />,
      fields: [
        { field: 'zip_code', label: 'CEP', type: 'text', required: true, placeholder: '00000-000', mask: 'cep', icon: <MapPinIcon size={20} />, className: 'col-span-full' },
        { field: 'street', label: 'Rua', type: 'text', required: true, placeholder: 'Rua das Flores', icon: <MapPinIcon size={20} />, disabled: !isManualAddress, readOnly: !isManualAddress, className: 'col-span-full' },
        { field: 'number', label: 'Número', type: 'text', required: true, placeholder: '123', icon: <Hash size={20} /> },
        { field: 'complement', label: 'Complemento', type: 'text', placeholder: 'Sala 12', icon: <MapPinIcon size={20} />, required: false },
        { field: 'block', label: 'Quadra', type: 'text', placeholder: 'Ex: 55', icon: <MapPinIcon size={20} />, required: false },
        { field: 'lot', label: 'Lote', type: 'text', placeholder: 'Ex: 5P6P', icon: <MapPinIcon size={20} />, required: false },
        { field: 'district', label: 'Bairro', type: 'text', required: true, placeholder: 'Centro', icon: <MapPinIcon size={20} />, disabled: !isManualAddress, readOnly: !isManualAddress },
        { field: 'city', label: 'Cidade', type: 'text', required: true, placeholder: 'São Paulo', icon: <MapPinIcon size={20} />, disabled: !isManualAddress, readOnly: !isManualAddress },
        { field: 'state', label: 'Estado', type: 'text', required: true, placeholder: 'SP', icon: <Globe size={20} />, disabled: !isManualAddress, readOnly: !isManualAddress },
        { field: 'country', label: 'País', type: 'text', required: true, placeholder: 'Brasil', defaultValue: 'Brasil', icon: <Globe size={20} />, disabled: !isManualAddress, readOnly: !isManualAddress },
        { field: 'latitude', label: 'Latitude', type: 'text', hidden: true },
        { field: 'longitude', label: 'Longitude', type: 'text', hidden: true }
      ],
    },
    {
      title: 'Valores e Condições',
      icon: <DollarSign size={20} />,
      fields: [
        { field: 'purchase_date', label: 'Data da Compra', type: 'date', required: false, icon: <Calendar size={20} />, className: 'col-span-full' },
        { field: 'purchase_value', label: 'Valor do Imóvel (Compra)', type: 'text', required: false, placeholder: 'R$ 500.000,00', mask: 'money', icon: <Dollar size={20} /> },
        { field: 'rental_value', label: 'Valor Aluguel Base', type: 'text', required: true, placeholder: 'R$ 3.000,00', mask: 'money', icon: <Key size={20} /> },
        { field: 'condo_fee', label: 'Valor Condomínio Base', type: 'text', required: false, placeholder: 'R$ 500,00', mask: 'money', icon: <Building size={20} /> },
        { field: 'status', label: 'Status Atual', type: 'select', required: true, options: [{ label: 'Disponível', value: 'AVAILABLE' }, { label: 'Ocupado', value: 'OCCUPIED' }], icon: <Key size={20} /> },
        { field: 'sale_date', label: 'Data da Venda', type: 'date', required: false, icon: <Calendar size={20} />, className: 'col-span-full' },
        { field: 'sale_value', label: 'Valor de Venda', type: 'text', placeholder: 'R$ 600.000,00', mask: 'money', icon: <Dollar size={20} />, className: 'col-span-full' },
        { field: 'extra_charges', label: 'Encargos / Custos Extras', type: 'text', placeholder: 'R$ 0,00', mask: 'money', icon: <Dollar size={20} />, className: 'col-span-full' },
        { field: 'values_notes', label: 'Observações', type: 'textarea', placeholder: 'Anotações adicionais sobre os valores', rows: 3, icon: <FileText size={20} />, className: 'col-span-full' },
      ],
    },
    {
      title: 'IPTU',
      icon: <Landmark size={20} />,
      fields: [
        { field: 'property_tax', label: 'Valor IPTU (Base de Referência)', type: 'text', required: true, placeholder: 'R$ 1.200,00', mask: 'money', icon: <FileText size={20} />, className: 'col-span-full md:col-span-1' },
        {
          field: 'iptus',
          label: '',
          type: 'custom',
          className: 'col-span-full w-full pt-4 border-t border-ui-border-soft mt-4',
          render: (value: any, fv: any, onChange: any) => {
            const baseIptu = parseMoney(fv?.property_tax || '0');
            return <IptuManager value={value || []} onChange={onChange} baseIptu={baseIptu} />
          }
        }
      ]
    },
    {
      title: 'Mídias',
      icon: <Upload size={20} />,
      fields: [
        { field: 'arquivosImagens', label: 'Imagens e Vídeos', type: 'file', accept: 'image/*,video/mp4,video/webm', multiple: true, textButton: 'Selecionar Mídias', placeholder: 'Nenhum arquivo selecionado', icon: <Upload size={20} />, className: 'col-span-full w-full', maxFiles: 30, enableFeatureSelection: true } as any,
        { field: 'arquivosMatricula', label: 'Matrícula', type: 'file', accept: '.pdf', multiple: true, maxFiles: 3, textButton: 'Escolher arquivos', className: 'flex-1 w-full', placeholder: 'Nenhum arquivo selecionado', icon: <File size={20} /> },
        { field: 'arquivosRegistro', label: 'Registro', type: 'file', accept: '.pdf', multiple: true, maxFiles: 3, textButton: 'Escolher arquivos', className: 'flex-1 w-full', placeholder: 'Nenhum arquivo selecionado', icon: <FileText size={20} /> },
        { field: 'arquivosEscritura', label: 'Escritura', type: 'file', accept: '.pdf', multiple: true, maxFiles: 3, textButton: 'Escolher arquivos', className: 'flex-1 w-full', placeholder: 'Nenhum arquivo selecionado', icon: <FileText size={20} /> }
      ],
    },
  ], [owners, propertyTypes, agencies, loadingData, isManualAddress]);

  const validateStep = (stepIndex: number, data: any): boolean => {
    const stepFields = steps[stepIndex].fields;
    for (const field of stepFields) {
      if (field.required) {
        const value = data[field.field];
        if (value === undefined || value === null || (typeof value === 'string' && value.trim() === '')) return false;
      }
    }
    return true;
  };

  const handleSubmit = async (data: any) => {
    try {
      const formData = new FormData();
      
      const propertyDataObj = {
        title: data.title, bedrooms: parseInt(data.bedrooms) || 0, bathrooms: parseInt(data.bathrooms) || 0,
        half_bathrooms: parseInt(data.half_bathrooms) || 0, garage_spaces: parseInt(data.garage_spaces) || 0,
        area_total: parseMetric(data.area_total), area_built: parseMetric(data.area_built), frontage: parseMetric(data.frontage),
        furnished: data.furnished === 'true', floor_number: parseInt(data.floor_number) || 0, tax_registration: data.tax_registration,
        notes: data.notes, owner_id: data.owner_id, type_id: data.type_id, agency_id: data.agency_id,
      };

      const addressData = {
        zip_code: data.zip_code, street: data.street, number: data.number, complement: data.complement || null, block: data.block || null, lot: data.lot || null, district: data.district, city: data.city, state: data.state, country: data.country || 'Brasil', latitude: data.latitude || null, longitude: data.longitude || null,
      };

      const valuesData = {
        purchase_date: data.purchase_date || null, purchase_value: parseMoney(data.purchase_value) || null, rental_value: parseMoney(data.rental_value), condo_fee: parseMoney(data.condo_fee), property_tax: parseMoney(data.property_tax), status: data.status, notes: data.values_notes, sale_date: data.sale_date || null, sale_value: parseMoney(data.sale_value) || 0, extra_charges: parseMoney(data.extra_charges) || 0,
      };

      formData.append('propertyData', JSON.stringify(propertyDataObj));
      formData.append('addressData', JSON.stringify(addressData));
      formData.append('valuesData', JSON.stringify(valuesData));
      formData.append('iptusData', JSON.stringify(data.iptus || [])); 
      formData.append('userId', user?.id || '');

      if (data.arquivosImagens?.length > 0) {
        const featuredImage = Array.from(data.arquivosImagens).find((file: any) => file.is_featured);
        if (featuredImage) formData.append('featuredImageIdentifier', (featuredImage as any).id || (featuredImage as File).name);
        Array.from(data.arquivosImagens).forEach((file: any) => formData.append('arquivosImagens', file));
      }
      
      if (data.arquivosMatricula?.length > 0) Array.from(data.arquivosMatricula).forEach((file: any) => formData.append('arquivosMatricula', file));
      if (data.arquivosRegistro?.length > 0) Array.from(data.arquivosRegistro).forEach((file: any) => formData.append('arquivosRegistro', file));
      if (data.arquivosEscritura?.length > 0) Array.from(data.arquivosEscritura).forEach((file: any) => formData.append('arquivosEscritura', file));
      if (data.arquivosOutros?.length > 0) Array.from(data.arquivosOutros).forEach((file: any) => formData.append('arquivosOutros', file));

      const API_URL = process.env.NEXT_PUBLIC_URL_API;
      const createRes = await fetch(`${API_URL}/properties/create-unified`, { method: 'POST', body: formData });
      const responseText = await createRes.text();

      let result;
      try { result = JSON.parse(responseText); } catch (e) { throw new Error('Resposta inválida do servidor'); }

      if (!createRes.ok) {
        if (createRes.status === 400 && result.errors) {
          const validationErrors = Object.entries(result.errors).map(([field, messages]) => `${field}: ${Array.isArray(messages) ? messages.join(', ') : messages}`).join('; ');
          throw new Error(`Erros de validação: ${validationErrors}`);
        }
        throw new Error(result.message || `Erro ${createRes.status}: ${responseText}`);
      }

      if (!result.success) throw new Error(result.message || 'Erro desconhecido ao criar imóvel');
      return result.data || result;

    } catch (error: any) { throw new Error(`Erro ao criar imóvel: ${error.message}`); }
  };

  const handleStepComplete = (stepIndex: number) => {
    if (!completedSteps.includes(stepIndex)) setCompletedSteps(prev => [...prev, stepIndex]);
  };

  const canNavigateToStep = (targetStep: number, currentStep: number, data: any): boolean => {
    if (targetStep < currentStep) return true;
    if (targetStep > currentStep) return validateStep(currentStep, data);
    return true;
  };

  const onSubmitSuccess = (_data: any) => {
    showMessage('Imóvel criado com sucesso!', 'success');
    router.push('/dashboard/imoveis');
  };

  if (loadingData) return <div className="flex justify-center items-center h-64"><div className="animate-spin rounded-full h-12 w-12 border-b-2 border-brand"></div></div>;

  return (
    <DynamicFormManager
      resource="properties" title="Imóvel" basePath="/dashboard/imoveis" mode="create" steps={steps}
      onSubmit={handleSubmit} onSubmitSuccess={onSubmitSuccess} onFieldChange={handleFieldChange} completedSteps={completedSteps} onStepComplete={handleStepComplete} canNavigateToStep={canNavigateToStep}
    />
  );
}