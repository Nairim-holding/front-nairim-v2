/* eslint-disable @typescript-eslint/no-explicit-any */
'use client';

import { useParams } from 'next/navigation';
import { useMemo } from 'react';
import DynamicFormManager from '@/components/DynamicFormManager';
import ContactManager from '@/components/ContactManager';
import { FormStep } from '@/types/types';
import {
  User, MapPin, Phone, FileText, Hash,
  Building as BuildingIcon, Globe, MapPin as MapPinIcon, User as UserIcon
} from 'lucide-react';

export default function VisualizarFornecedorPage() {
  const params = useParams();
  const id = params.id as string;

  const transformData = (apiData: any) => {
    if (!apiData) return {};
    const address = apiData.addresses?.[0]?.address || {};
    
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
  };

  const steps: FormStep[] = useMemo(() => [
    {
      title: 'Dados do Fornecedor',
      icon: <BuildingIcon size={20} />,
      fields: [
        { field: 'legal_name', label: 'Razão Social', type: 'text', readOnly: true, icon: <BuildingIcon size={20} />, className: 'col-span-full' },
        { field: 'trade_name', label: 'Nome Fantasia', type: 'text', readOnly: true, icon: <BuildingIcon size={20} />, className: 'col-span-full', hidden: (formValues: any) => !formValues.trade_name },
        { field: 'cnpj', label: 'CNPJ', type: 'text', mask: 'cnpj', icon: <FileText size={20} />, readOnly: true, className: 'col-span-full', hidden: (formValues: any) => !formValues.cnpj },
        { field: 'state_registration', label: 'Inscrição Estadual', type: 'text', icon: <Hash size={20} />, readOnly: true, hidden: (formValues: any) => !formValues.state_registration },
        { field: 'municipal_registration', label: 'Inscrição Municipal', type: 'text', icon: <Hash size={20} />, readOnly: true, hidden: (formValues: any) => !formValues.municipal_registration },
      ],
    },
    {
      title: 'Endereço',
      icon: <MapPin size={20} />,
      fields: [
        { field: 'zip_code', label: 'CEP', type: 'text', mask: 'cep', icon: <MapPinIcon size={20} />, className: 'col-span-full', readOnly: true },
        { field: 'street', label: 'Rua', type: 'text', icon: <MapPinIcon size={20} />, className: 'col-span-full', readOnly: true },
        { field: 'number', label: 'Número', type: 'text', icon: <Hash size={20} />, readOnly: true },
        { field: 'complement', label: 'Complemento', type: 'text', icon: <MapPinIcon size={20} />, readOnly: true, hidden: (formValues: any) => !formValues.complement },
        { field: 'district', label: 'Bairro', type: 'text', icon: <MapPinIcon size={20} />, readOnly: true },
        { field: 'city', label: 'Cidade', type: 'text', icon: <MapPinIcon size={20} />, readOnly: true },
        { field: 'state', label: 'Estado', type: 'text', icon: <Globe size={20} />, readOnly: true },
        { field: 'country', label: 'País', type: 'text', icon: <Globe size={20} />, readOnly: true }
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
          render: (value: any) => (
            <ContactManager value={value} resourceType="financial-supplier" readOnly={true} />
          )
        }
      ],
    },
  ], []);

  return (
    <DynamicFormManager
      resource="financial-supplier"
      title="Fornecedor"
      basePath="/dashboard/fornecedores"
      mode="view"
      id={id}
      steps={steps}
      transformData={transformData}
    />
  );
}