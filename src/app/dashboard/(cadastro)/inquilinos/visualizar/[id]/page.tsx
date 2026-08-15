/* eslint-disable @typescript-eslint/no-explicit-any */
'use client';

import { useParams } from 'next/navigation';
import { useMemo, useCallback } from 'react';
import DynamicFormManager from '@/components/form/DynamicForm';
import ContactManager from '@/components/domain/contacts/ContactManager';
import { FormStep } from '@/types/types';
import { getTenantByIdAction } from '@/server/actions/tenant';
import {
  User, MapPin, FileText, Hash,
  Briefcase, Heart, Phone, User as UserIcon,
  MapPin as MapPinIcon,
  Building as BuildingIcon, Globe
} from 'lucide-react';

export default function VisualizarInquilinoPage() {
  const params = useParams();
  const id = params.id as string;

  const transformData = useCallback((apiData: any) => {
    if (!apiData) return {};
    
    const address = apiData.addresses?.[0]?.address || {};
    
    return {
      name: apiData.name || '',
      internal_code: apiData.internal_code || '',
      nationality: apiData.nationality || '',
      occupation: apiData.occupation || '',
      marital_status: apiData.marital_status || '',
      cnpj: apiData.cnpj || '',
      cpf: apiData.cpf || '',
      rg: apiData.rg || '',
      rg_issuing_body: apiData.rg_issuing_body || '',
      rg_issuing_state: apiData.rg_issuing_state || '',
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
        {
          field: 'name',
          label: 'Nome/Razão Social',
          type: 'text',
          required: true,
          placeholder: 'Nome completo do inquilino',
          autoFocus: true,
          icon: <UserIcon size={20} />,
          className: 'col-span-full',
          readOnly: true,
        },
        {
          field: 'internal_code',
          label: 'Código Interno',
          type: 'text',
          icon: <Hash size={20} />,
          readOnly: true,
          hidden: (formValues: any) => !formValues.internal_code || formValues.internal_code.trim() === '',
        },
        {
          field: 'nationality',
          label: 'Nacionalidade',
          type: 'text',
          icon: <Globe size={20} />,
          readOnly: true,
          hidden: (formValues: any) => !formValues.nationality,
        },
        {
          field: 'occupation',
          label: 'Profissão',
          type: 'text',
          icon: <Briefcase size={20} />,
          className: 'col-span-full',
          readOnly: true,
          hidden: (formValues: any) => !formValues.occupation,
        },
        {
          field: 'marital_status',
          label: 'Estado Civil',
          type: 'text',
          icon: <Heart size={20} />,
          readOnly: true,
          hidden: (formValues: any) => !formValues.marital_status,
        },
        {
          field: 'cpf',
          label: 'CPF',
          type: 'text',
          mask: 'cpf',
          icon: <FileText size={20} />,
          readOnly: true,
          hidden: (formValues: any) => !formValues.cpf,
        },
        {
          field: 'rg',
          label: 'RG',
          type: 'text',
          mask: 'rg',
          icon: <FileText size={20} />,
          readOnly: true,
          hidden: (formValues: any) => !formValues.rg,
        },
        {
          field: 'rg_issuing_body',
          label: 'Órgão Expedidor',
          type: 'text',
          icon: <BuildingIcon size={20} />,
          readOnly: true,
          hidden: (formValues: any) => !formValues.rg_issuing_body,
        },
        {
          field: 'rg_issuing_state',
          label: 'UF Expedidor',
          type: 'text',
          icon: <Globe size={20} />,
          readOnly: true,
          hidden: (formValues: any) => !formValues.rg_issuing_state,
        },
        {
          field: 'cnpj',
          label: 'CNPJ',
          type: 'text',
          mask: 'cnpj',
          icon: <FileText size={20} />,
          readOnly: true,
          hidden: (formValues: any) => !formValues.cnpj,
        },
        {
          field: 'state_registration',
          label: 'Inscrição Estadual',
          type: 'text',
          icon: <BuildingIcon size={20} />,
          readOnly: true,
          hidden: (formValues: any) => !formValues.state_registration,
        },
        {
          field: 'municipal_registration',
          label: 'Inscrição Municipal',
          type: 'text',
          icon: <BuildingIcon size={20} />,
          readOnly: true,
          hidden: (formValues: any) => !formValues.municipal_registration,
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
        { field: 'complement', label: 'Complemento', type: 'text', icon: <MapPinIcon size={20} />, readOnly: true },
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
              resourceType="tenants"
              readOnly={true}
            />
          )
        },
      ],
    },
  ], []);

  return (
    <DynamicFormManager
      resource="tenants"
      title="Inquilino"
      basePath="/dashboard/inquilinos"
      mode="view"
      id={id}
      steps={steps}
      fetchResource={getTenantByIdAction}
      transformData={transformData}
    />
  );
}