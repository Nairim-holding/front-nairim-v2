/* eslint-disable @typescript-eslint/no-explicit-any */
'use client';

import { useState, useEffect, useMemo } from 'react';
import DynamicFormManager from '@/components/DynamicFormManager';
import { FormStep } from '@/types/types';
import { useMessageContext } from '@/contexts/MessageContext';
import { useRouter, useParams } from 'next/navigation';
import { 
  Home, MapPin, DollarSign, Upload, Building2, 
  Key, FileText, BedDouble, Bath, Car, Ruler, Sofa,
  HomeIcon, User, Building, DollarSign as Dollar,
  Calendar, File,
  MapPinIcon,
  Hash,
  Globe
} from 'lucide-react';

const formatMoney = (value: number | string) => {
  if (!value) return '';
  const num = typeof value === 'string' ? parseFloat(value) : value;
  if (isNaN(num)) return '';
  
  return new Intl.NumberFormat('pt-BR', {
    style: 'currency',
    currency: 'BRL',
    minimumFractionDigits: 2,
    maximumFractionDigits: 2
  }).format(num);
};

const formatMetricValue = (value: number | string) => {
  if (!value) return '';
  const num = typeof value === 'string' ? parseFloat(value) : value;
  if (isNaN(num)) return '';
  
  return num.toLocaleString('pt-BR', { 
    minimumFractionDigits: 2, 
    maximumFractionDigits: 2 
  });
};

export default function VisualizarImovelPage() {
  const params = useParams();
  const id = params.id as string;
  
  const { showMessage } = useMessageContext();
  const router = useRouter();
  
  const [owners, setOwners] = useState<any[]>([]);
  const [propertyTypes, setPropertyTypes] = useState<any[]>([]);
  const [agencies, setAgencies] = useState<any[]>([]);
  const [loadingData, setLoadingData] = useState(true);
  const [propertyData, setPropertyData] = useState<any>(null);
  const [loadingProperty, setLoadingProperty] = useState(true);
  const [completedSteps] = useState<number[]>([0, 1, 2, 3]);

  useEffect(() => {
    const fetchInitialData = async () => {
      try {
        const [ownersRes, typesRes, agenciesRes] = await Promise.all([
          fetch(`${process.env.NEXT_PUBLIC_URL_API}/owners`),
          fetch(`${process.env.NEXT_PUBLIC_URL_API}/property-types`),
          fetch(`${process.env.NEXT_PUBLIC_URL_API}/agencies`),
        ]);

        if (!ownersRes.ok || !typesRes.ok || !agenciesRes.ok) {
          throw new Error('Erro ao buscar dados iniciais');
        }

        const ownersData = await ownersRes.json();
        const typesData = await typesRes.json();
        const agenciesData = await agenciesRes.json();

        const ownersList = ownersData.data || ownersData || [];
        const typesList = typesData.data || typesData || [];
        const agenciesList = agenciesData.data || agenciesData || [];

        setOwners(ownersList);
        setPropertyTypes(typesList);
        setAgencies(agenciesList);
      } catch (error) {
        showMessage('Erro ao carregar dados iniciais', 'error');
      } finally {
        setLoadingData(false);
      }
    };

    fetchInitialData();
  }, [showMessage]);

  useEffect(() => {
    const fetchPropertyData = async () => {
      if (!id) {
        return;
      }

      try {
        setLoadingProperty(true);
        
        const response = await fetch(`${process.env.NEXT_PUBLIC_URL_API}/properties/${id}`);
        
        if (!response.ok) {
          throw new Error(`Erro ${response.status} ao buscar dados do imóvel`);
        }

        const data = await response.json();
        
        if (data.success && data.data) {
          setPropertyData(data.data);
        } else {
          throw new Error(data.message || 'Erro ao carregar dados do imóvel');
        }
      } catch (error: any) {
        showMessage(`Erro ao carregar dados do imóvel: ${error.message}`, 'error');
        router.push('/dashboard/imoveis');
      } finally {
        setLoadingProperty(false);
      }
    };

    fetchPropertyData();
  }, [id, router, showMessage]);

  const transformData = (apiResponse: any) => {
    const data = apiResponse.data || apiResponse;
    
    if (!data) {
      return {};
    }
    
    const address = data.addresses?.[0]?.address || {};
    const values = data.values?.[0] || {};

    const extractFileName = (filePath: string) => {
      if (!filePath) return 'Arquivo';
      const parts = filePath.split('/');
      const fileNameWithTimestamp = parts[parts.length - 1];
      const fileName = fileNameWithTimestamp.replace(/^\d+-/, '');
      return decodeURIComponent(fileName);
    };

    const transformed = {
      title: data.title || '',
      bedrooms: data.bedrooms?.toString() || '',
      bathrooms: data.bathrooms?.toString() || '',
      half_bathrooms: data.half_bathrooms?.toString() || '',
      garage_spaces: data.garage_spaces?.toString() || '',
      area_total: formatMetricValue(data.area_total || ''),
      area_built: formatMetricValue(data.area_built || ''),
      frontage: formatMetricValue(data.frontage || ''),
      floor_number: data.floor_number?.toString() || '',
      tax_registration: data.tax_registration || '',
      owner_id: data.owner_id || '',
      type_id: data.type_id || '',
      agency_id: data.agency_id || '',
      furnished: data.furnished?.toString() || 'false',
      notes: data.notes || '',
      
      zip_code: address.zip_code || '',
      street: address.street || '',
      number: address.number || '',
      complement: address.complement || '',
      block: address.block || '',
      lot: address.lot || '',
      district: address.district || '',
      city: address.city || '',
      state: address.state || '',
      country: address.country || 'Brasil',
      latitude: address.latitude || '',
      longitude: address.longitude || '',
      
      purchase_date: values.purchase_date ? values.purchase_date.split('T')[0] : '',
      purchase_value: formatMoney(values.purchase_value || ''),
      rental_value: formatMoney(values.rental_value || ''),
      condo_fee: formatMoney(values.condo_fee || ''),
      property_tax: formatMoney(values.property_tax || ''),
      status: values.status || 'AVAILABLE',
      sale_date: values.sale_date ? values.sale_date.split('T')[0] : '',
      values_notes: values.notes || '',
      sale_value: formatMoney(values.sale_value || ''),
      extra_charges: formatMoney(values.extra_charges || ''),
      
      arquivosImagens: data.documents
        ?.filter((doc: any) => doc.type === 'IMAGE')
        .map((doc: any) => ({
          id: doc.id,
          file_name: doc.description || extractFileName(doc.file_path),
          file_url: doc.file_path,
          type: doc.type,
          mime_type: doc.file_type,
          is_featured: doc.is_featured || false, // <--- ADICIONADO MAPEAMENTO DO DESTAQUE
        })) || [],
        
      arquivosMatricula: data.documents
        ?.filter((doc: any) => doc.type === 'REGISTRATION')
        .map((doc: any) => ({
          id: doc.id,
          file_name: doc.description || extractFileName(doc.file_path),
          file_url: doc.file_path,
          type: doc.type,
          mime_type: doc.file_type,
        })) || [],
        
      arquivosRegistro: data.documents
        ?.filter((doc: any) => doc.type === 'PROPERTY_RECORD')
        .map((doc: any) => ({
          id: doc.id,
          file_name: doc.description || extractFileName(doc.file_path),
          file_url: doc.file_path,
          type: doc.type,
          mime_type: doc.file_type,
        })) || [],
        
      arquivosEscritura: data.documents
        ?.filter((doc: any) => doc.type === 'TITLE_DEED')
        .map((doc: any) => ({
          id: doc.id,
          file_name: doc.description || extractFileName(doc.file_path),
          file_url: doc.file_path,
          type: doc.type,
          mime_type: doc.file_type,
        })) || [],
        
      arquivosOutros: data.documents
        ?.filter((doc: any) => 
          !['IMAGE', 'REGISTRATION', 'PROPERTY_RECORD', 'TITLE_DEED'].includes(doc.type)
        )
        .map((doc: any) => ({
          id: doc.id,
          file_name: doc.description || extractFileName(doc.file_path),
          file_url: doc.file_path,
          type: doc.type,
          mime_type: doc.file_type,
        })) || [],
    };

    return transformed;
  };

  const steps: FormStep[] = useMemo(() => {
    const activeLease = propertyData?.leases?.[0];
    const hasActiveLease = !!activeLease;
    const tenantName = activeLease?.tenant?.name || '';

    return [
    {
      title: 'Dados do Imóvel',
      icon: <Home size={20} />,
      fields: [
        {
          field: 'title',
          label: 'Nome Fantasia',
          type: 'text',
          required: true,
          placeholder: 'Nome para o imóvel',
          autoFocus: true,
          icon: <HomeIcon size={20} />,
          className: 'col-span-full',
          disabled: true,
          readOnly: true,
        },
        {
          field: 'bedrooms',
          label: 'Quartos',
          type: 'number',
          required: true,
          placeholder: 'Quantidade de quartos',
          showIncrementButtons: false,
          min: 0,
          icon: <BedDouble size={20} />,
          disabled: true,
          readOnly: true,
        },
        {
          field: 'bathrooms',
          label: 'Banheiros',
          type: 'number',
          required: true,
          placeholder: 'Quantidade de banheiros',
          showIncrementButtons: false,
          min: 0,
          icon: <Bath size={20} />,
          disabled: true,
          readOnly: true,
        },
        {
          field: 'half_bathrooms',
          label: 'Lavabos',
          type: 'number',
          required: true,
          placeholder: 'Quantidade de lavabos',
          showIncrementButtons: false,
          min: 0,
          icon: <Bath size={20} />,
          disabled: true,
          readOnly: true,
        },
        {
          field: 'garage_spaces',
          label: 'Vagas na Garagem',
          type: 'number',
          required: true,
          placeholder: 'Quantidade de vagas',
          showIncrementButtons: false,
          min: 0,
          icon: <Car size={20} />,
          disabled: true,
          readOnly: true,
        },
        {
          field: 'floor_number',
          label: 'Número do Andar',
          type: 'number',
          required: false,
          placeholder: 'Número do andar',
          showIncrementButtons: false,
          min: 0,
          icon: <Building size={20} />,
          disabled: true,
          readOnly: true,
        },
        {
          field: 'area_total',
          label: 'Área Total (m²)',
          type: 'text',
          required: true,
          placeholder: 'Área total em m²',
          mask: 'metros2',
          icon: <Ruler size={20} />,
          disabled: true,
          readOnly: true,
        },
        {
          field: 'area_built',
          label: 'Área Construída (m²)',
          type: 'text',
          required: true,
          placeholder: 'Área construída em m²',
          mask: 'metros2',
          icon: <Ruler size={20} />,
          disabled: true,
          readOnly: true,
        },
        {
          field: 'frontage',
          label: 'Testada (m)',
          type: 'text',
          required: true,
          placeholder: 'Testada em metros',
          mask: 'metros',
          icon: <Ruler size={20} />,
          disabled: true,
          readOnly: true,
        },
        {
          field: 'tax_registration',
          label: 'Registro Fiscal',
          type: 'text',
          required: true,
          placeholder: 'Número do registro fiscal',
          icon: <FileText size={20} />,
          className: 'col-span-full',
          disabled: true,
          readOnly: true,
        },
        {
          field: 'owner_id',
          label: 'Proprietário',
          type: 'select',
          required: true,
          options: loadingData 
            ? [{ label: 'Carregando...', value: '' }]
            : owners.map((owner) => ({ 
                label: owner.name || owner.trade_name || owner.legal_name || 'Sem nome', 
                value: owner.id 
              })),
          icon: <User size={20} />,
          className: 'col-span-full',
          disabled: true,
          readOnly: true,
        },
        {
          field: 'type_id',
          label: 'Tipo do imóvel',
          type: 'select',
          required: true,
          options: loadingData 
            ? [{ label: 'Carregando...', value: '' }]
            : propertyTypes.map((type) => ({ 
                label: type.description || type.name || 'Sem descrição', 
                value: type.id 
              })),
          icon: <Building2 size={20} />,
          className: 'col-span-full',
          disabled: true,
          readOnly: true,
        },
        {
          field: 'agency_id',
          label: 'Imobiliária',
          type: 'select',
          required: true,
          options: loadingData 
            ? [{ label: 'Carregando...', value: '' }]
            : agencies.map((agency) => ({ 
                label: agency.trade_name || agency.legal_name || agency.name || 'Sem nome', 
                value: agency.id 
              })),
          icon: <Building size={20} />,
          className: 'col-span-full',
          disabled: true,
          readOnly: true,
        },
        {
          field: 'furnished',
          label: 'Mobiliado',
          type: 'select',
          required: true,
          options: [
            { label: 'Sim', value: 'true' },
            { label: 'Não', value: 'false' },
          ],
          icon: <Sofa size={20} />,
          className: 'col-span-full',
          disabled: true,
          readOnly: true,
        },
        {
          field: 'notes',
          label: 'Observações',
          type: 'textarea',
          placeholder: 'Escreva detalhes não especificados anteriormente',
          rows: 3,
          icon: <FileText size={20} />,
          className: 'col-span-full',
          disabled: true,
          readOnly: true,
        },
      ],
    },
    {
      title: 'Endereço',
      icon: <MapPin size={20} />,
      fields: [
        {
          field: 'zip_code',
          label: 'CEP',
          type: 'text',
          required: true,
          placeholder: '00000-000',
          mask: 'cep',
          icon: <MapPinIcon size={20} />,
          className: 'col-span-full',
          disabled: true,
          readOnly: true,
        },
        {
          field: 'street',
          label: 'Rua',
          type: 'text',
          required: true,
          placeholder: 'Rua das Flores',
          icon: <MapPinIcon size={20} />,
          className: 'col-span-full',
          disabled: true,
          readOnly: true,
        },
        {
          field: 'number',
          label: 'Número',
          type: 'text',
          required: true,
          placeholder: '123',
          icon: <Hash size={20} />,
          disabled: true,
          readOnly: true,
        },
        {
          field: 'complement',
          label: 'Complemento',
          type: 'text',
          placeholder: 'Sala 12',
          icon: <MapPinIcon size={20} />,
          required: false,
          disabled: true,
          readOnly: true,
        },
        {
          field: 'block',
          label: 'Quadra',
          type: 'text',
          placeholder: 'Ex: 55',
          icon: <MapPinIcon size={20} />,
          required: false,
          disabled: true,
          readOnly: true,
        },
        {
          field: 'lot',
          label: 'Lote',
          type: 'text',
          placeholder: 'Ex: 5P6P',
          icon: <MapPinIcon size={20} />,
          required: false,
          disabled: true,
          readOnly: true,
        },
        {
          field: 'district',
          label: 'Bairro',
          type: 'text',
          required: true,
          placeholder: 'Centro',
          icon: <MapPinIcon size={20} />,
          disabled: true,
          readOnly: true,
        },
        {
          field: 'city',
          label: 'Cidade',
          type: 'text',
          required: true,
          placeholder: 'São Paulo',
          icon: <MapPinIcon size={20} />,
          disabled: true,
          readOnly: true,
        },
        {
          field: 'state',
          label: 'Estado',
          type: 'text',
          required: true,
          placeholder: 'SP',
          icon: <Globe size={20} />,
          disabled: true,
          readOnly: true,
        },
        {
          field: 'country',
          label: 'País',
          type: 'text',
          required: true,
          placeholder: 'Brasil',
          defaultValue: 'Brasil',
          icon: <Globe size={20} />,
          disabled: true,
          readOnly: true,
        },
        {
          field: 'latitude',
          label: 'Latitude',
          type: 'text',
          hidden: true,
        },
        {
          field: 'longitude',
          label: 'Longitude',
          type: 'text',
          hidden: true,
        }
      ],
    },
    {
      title: 'Valores e Condições',
      icon: <DollarSign size={20} />,
      fields: [
        {
          field: 'purchase_date',
          label: 'Data da Compra',
          type: 'date',
          required: false,
          icon: <Calendar size={20} />,
          className: 'col-span-full',
          disabled: true,
          readOnly: true,
        },
        {
          field: 'purchase_value',
          label: 'Valor do Imóvel (Compra)',
          type: 'text',
          required: false,
          placeholder: 'R$ 500.000,00',
          mask: 'money',
          icon: <Dollar size={20} />,
          disabled: true,
          readOnly: true,
        },
        {
          field: 'rental_value',
          label: 'Valor Aluguel',
          type: 'text',
          required: true,
          placeholder: 'R$ 3.000,00',
          mask: 'money',
          icon: <Key size={20} />,
          disabled: true,
          readOnly: true,
        },
        {
          field: 'condo_fee',
          label: 'Valor Condomínio',
          type: 'text',
          required: false,
          placeholder: 'R$ 500,00',
          mask: 'money',
          icon: <Building size={20} />,
          disabled: true,
          readOnly: true,
        },
        {
          field: 'property_tax',
          label: 'Valor IPTU',
          type: 'text',
          required: true,
          placeholder: 'R$ 200,00',
          mask: 'money',
          icon: <FileText size={20} />,
          disabled: true,
          readOnly: true,
        },
        {
          field: 'status',
          label: 'Status Atual',
          type: 'select',
          required: true,
          disabled: true,
          options: [
            { label: 'Disponível', value: 'AVAILABLE' },
            { label: 'Ocupado', value: 'OCCUPIED' },
          ],
          icon: <Key size={20} />,
          renderBottom: () => hasActiveLease ? (
            <div className="absolute z-10 bottom-full mb-2 hidden group-hover:block bg-gray-800 text-white text-xs rounded p-2 shadow-lg">
              Inquilino: {tenantName}
            </div>
          ) : null,
          className: 'relative group'
        },
        {
          field: 'sale_date',
          label: 'Data da Venda',
          type: 'date',
          required: false,
          icon: <Calendar size={20} />,
          className: 'col-span-full',
          disabled: true,
          readOnly: true,
        },
        {
          field: 'sale_value',
          label: 'Valor de Venda',
          type: 'text',
          placeholder: 'R$ 600.000,00',
          mask: 'money',
          icon: <Dollar size={20} />,
          className: 'col-span-full',
          disabled: true,
          readOnly: true,
        },
        {
          field: 'extra_charges',
          label: 'Encargos / Custos Extras',
          type: 'text',
          placeholder: 'R$ 0,00',
          mask: 'money',
          icon: <Dollar size={20} />,
          className: 'col-span-full',
          disabled: true,
          readOnly: true,
        },
        {
          field: 'values_notes',
          label: 'Observações',
          type: 'textarea',
          placeholder: 'Anotações adicionais sobre os valores',
          rows: 3,
          icon: <FileText size={20} />,
          className: 'col-span-full',
          disabled: true,
          readOnly: true,
        },
      ],
    },
    {
      title: 'Mídias',
      icon: <Upload size={20} />,
      fields: [
        {
          field: 'arquivosImagens',
          label: 'Imagens e Vídeos',
          type: 'file',
          accept: 'image/*,video/mp4,video/webm',
          multiple: true,
          textButton: 'Selecionar Mídias',
          placeholder: 'Nenhum arquivo selecionado',
          icon: <Upload size={20} />,
          className: 'col-span-full w-full',
          maxFiles: 30,
          disabled: true,
          readOnly: true,
          enableFeatureSelection: true, // <--- ATIVA A FUNCIONALIDADE DE RENDERIZAR A ESTRELA (APENAS LEITURA)
        } as any,
        {
          field: 'arquivosMatricula',
          label: 'Matrícula',
          type: 'file',
          accept: '.pdf',
          multiple: true,
          maxFiles: 3,
          textButton: 'Escolher arquivos',
          className: 'flex-1 w-full',
          placeholder: 'Nenhum arquivo selecionado',
          icon: <File size={20} />,
          disabled: true,
          readOnly: true,
        },
        {
          field: 'arquivosRegistro',
          label: 'Registro',
          type: 'file',
          accept: '.pdf',
          multiple: true,
          maxFiles: 3,
          textButton: 'Escolher arquivos',
          className: 'flex-1 w-full',
          placeholder: 'Nenhum arquivo selecionado',
          icon: <FileText size={20} />,
          disabled: true,
          readOnly: true,
        },
        {
          field: 'arquivosEscritura',
          label: 'Escritura',
          type: 'file',
          accept: '.pdf',
          multiple: true,
          maxFiles: 3,
          textButton: 'Escolher arquivos',
          className: 'flex-1 w-full',
          placeholder: 'Nenhum arquivo selecionado',
          icon: <FileText size={20} />,
          disabled: true,
          readOnly: true,
        }
      ],
    },
  ];
}, [owners, propertyTypes, agencies, loadingData, propertyData]);

  const handleFieldChange = async () => {
    return null;
  };

  const handleSubmit = async () => {
    return null;
  };

  const onSubmitSuccess = () => {};

  const handleStepComplete = () => {};

  const canNavigateToStep = () => {
    return true;
  };

  if (loadingData || loadingProperty) {
    return (
      <div className="flex justify-center items-center h-64">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-brand"></div>
      </div>
    );
  }

  return (
    <DynamicFormManager
      resource="properties"
      title="Imóvel"
      basePath="/dashboard/imoveis"
      mode="view"
      id={id}
      steps={steps}
      onSubmit={handleSubmit}
      onSubmitSuccess={onSubmitSuccess}
      onFieldChange={handleFieldChange}
      transformData={transformData}
      completedSteps={completedSteps}
      onStepComplete={handleStepComplete}
      canNavigateToStep={canNavigateToStep}
    />
  );
}