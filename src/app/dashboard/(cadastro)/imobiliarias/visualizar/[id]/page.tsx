/* eslint-disable @typescript-eslint/no-explicit-any */
'use client';

import { useCallback, useMemo } from 'react';
import DynamicFormManager from '@/components/form/DynamicForm';
import ContactManager from '@/components/domain/contacts/ContactManager';
import { FormStep } from '@/types/types';
import {
  Building2, MapPin, Phone, FileText,
  Hash, Globe, Building, MapPin as MapPinIcon, CheckCircle
} from 'lucide-react';
import { useParams } from 'next/navigation';
import { getAgencyByIdAction } from '@/server/actions/agency';

export default function VisualizarImobiliariaPage() {
  const params = useParams();
  const id = params.id as string;

  // `useCallback`: está nas dependências do useEffect de fetch do
  // DynamicForm — sem memoizar, disparava refetch em loop a cada render.
  const transformData = useCallback((apiData: any) => {
    if (!apiData) return {};
    const address = apiData.addresses?.[0]?.address || {};

    return {
      trade_name: apiData.trade_name || '',
      legal_name: apiData.legal_name || '',
      cnpj: apiData.cnpj || '',
      state_registration: apiData.state_registration || '',
      municipal_registration: apiData.municipal_registration || '',
      license_number: apiData.license_number || '',
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
        channels: c.contact?.channels || c.channels || [],
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
          icon: <FileText size={20} />,
          className: 'col-span-full',
          readOnly: true,
        },
        {
          field: 'trade_name',
          label: 'Nome Fantasia',
          type: 'text',
          required: true,
          icon: <Building size={20} />,
          className: 'col-span-full',
          readOnly: true,
        },
        {
          field: 'cnpj',
          label: 'CNPJ',
          type: 'text',
          required: true,
          mask: 'cnpj',
          icon: <Hash size={20} />,
          className: 'col-span-full',
          readOnly: true,
        },
        {
          field: 'state_registration',
          label: 'Inscrição Estadual',
          type: 'text',
          icon: <FileText size={20} />,
          readOnly: true,
        },
        {
          field: 'municipal_registration',
          label: 'Inscrição Municipal',
          type: 'text',
          icon: <FileText size={20} />,
          readOnly: true,
        },
        {
          field: 'license_number',
          label: 'CRECI',
          type: 'text',
          required: true,
          icon: <CheckCircle size={20} />,
          className: 'col-span-full',
          readOnly: true,
        },
      ],
    },
    {
      title: 'Endereço',
      icon: <MapPin size={20} />,
      fields: [
        { field: 'zip_code', label: 'CEP', type: 'text', mask: 'cep', icon: <MapPinIcon size={20} />, className: 'col-span-full', readOnly: true },
        { field: 'street', label: 'Rua', type: 'text', icon: <MapPinIcon size={20} />, className: 'col-span-full', readOnly: true },
        { field: 'number', label: 'Número', type: 'text', icon: <Hash size={20} />, readOnly: true },
        { field: 'complement', label: 'Complemento', type: 'text', icon: <Hash size={20} />, readOnly: true },
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
            <ContactManager 
              value={value} 
              resourceType="agencies"
              readOnly={true}
            />
          )
        }
      ],
    },
  ], []);

  return (
    <DynamicFormManager
      resource="agencies"
      title="Imobiliária"
      basePath="/dashboard/imobiliarias"
      mode="view"
      id={id}
      steps={steps}
      fetchResource={getAgencyByIdAction}
      transformData={transformData}
    />
  );
}