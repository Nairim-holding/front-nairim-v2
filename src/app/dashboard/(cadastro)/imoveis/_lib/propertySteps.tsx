/* eslint-disable @typescript-eslint/no-explicit-any */
'use client';

// Steps builder — contains JSX (icons), must be used in Client Components only.

import type { FormStep } from '@/types/types';
import IptuManager from '@/components/domain/financial/IptuManager';
import PropertyLocationPicker from '@/components/map/PropertyLocationPicker';
import { parseMoney } from './propertyTransform';
import {
  Home, MapPin, DollarSign, Upload, Building2,
  Key, FileText, BedDouble, Bath, Car, Ruler, Sofa,
  HomeIcon, User, Building, DollarSign as Dollar,
  Calendar, File, MapPinIcon, Hash, Globe, Landmark,
} from 'lucide-react';

export interface SelectOption {
  label: string;
  value: string;
}

export interface PropertyStepsConfig {
  ownerOptions: SelectOption[];
  typeOptions: SelectOption[];
  agencyOptions: SelectOption[];
  centerOptions?: SelectOption[];
  creditCenterOptions?: SelectOption[];
  debitCenterOptions?: SelectOption[];
  categoryOptions?: SelectOption[];
  subcategoryOptions?: SelectOption[];
  subcategoriesRaw?: { id: string; name: string; category_id: string }[];
  readOnly?: boolean;
  /** Controls whether auto-filled address fields are editable (create/edit mode) */
  isManualAddress?: boolean;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  activeLease?: any;
}

export function buildPropertySteps({
  ownerOptions,
  typeOptions,
  agencyOptions,
  centerOptions = [],
  creditCenterOptions = [],
  debitCenterOptions = [],
  categoryOptions = [],
  subcategoryOptions = [],
  subcategoriesRaw = [],
  readOnly = false,
  activeLease,
}: PropertyStepsConfig): FormStep[] {
  const hasActiveLease = !!activeLease;
  const tenantName = activeLease?.tenant?.name ?? '';

  // Shorthand for read-only fields
  const ro = readOnly ? { disabled: true as const, readOnly: true as const } : {};

  // Postal data is a suggestion; users must be able to correct the address.
  const autoFilled = ro;

  const steps: FormStep[] = [
    {
      title: 'Dados do Imóvel',
      icon: <Home size={20} />,
      fields: [
        { field: 'title', label: 'Nome Fantasia', type: 'text', required: true, placeholder: 'Nome para o imóvel', autoFocus: true, icon: <HomeIcon size={20} />, className: 'col-span-full', ...ro },
        { field: 'bedrooms', label: 'Quartos', type: 'number', required: true, placeholder: 'Quantidade de quartos', showIncrementButtons: !readOnly, min: 0, icon: <BedDouble size={20} />, ...ro },
        { field: 'bathrooms', label: 'Banheiros', type: 'number', required: true, placeholder: 'Quantidade de banheiros', showIncrementButtons: !readOnly, min: 0, icon: <Bath size={20} />, ...ro },
        { field: 'half_bathrooms', label: 'Lavabos', type: 'number', required: true, placeholder: 'Quantidade de lavabos', showIncrementButtons: !readOnly, min: 0, icon: <Bath size={20} />, ...ro },
        { field: 'garage_spaces', label: 'Vagas na Garagem', type: 'number', required: true, placeholder: 'Quantidade de vagas', showIncrementButtons: !readOnly, min: 0, icon: <Car size={20} />, ...ro },
        { field: 'floor_number', label: 'Número do Andar', type: 'number', required: false, placeholder: 'Número do andar', showIncrementButtons: !readOnly, min: 0, icon: <Building size={20} />, ...ro },
        { field: 'area_total', label: 'Área Total (m²)', type: 'text', required: true, placeholder: 'Área total', mask: 'metros2', icon: <Ruler size={20} />, ...ro },
        { field: 'area_built', label: 'Área Edificada (m²)', type: 'text', required: true, placeholder: 'Área construída', mask: 'metros2', icon: <Ruler size={20} />, ...ro },
        { field: 'frontage', label: 'Testada (m)', type: 'text', required: true, placeholder: 'Testada', mask: 'metros', icon: <Ruler size={20} />, ...ro },
        { field: 'tax_registration', label: 'Registro Fiscal', type: 'text', required: true, placeholder: 'Número do registro fiscal', icon: <FileText size={20} />, className: 'col-span-full', ...ro },
        { field: 'owner_id', label: 'Proprietário', type: 'select', required: true, options: ownerOptions, icon: <User size={20} />, className: 'col-span-full', ...ro },
        { field: 'type_id', label: 'Tipo do imóvel', type: 'select', required: true, searchable: true, options: typeOptions, icon: <Building2 size={20} />, className: 'col-span-full', ...ro },
        { field: 'agency_id', label: 'Imobiliária', type: 'select', required: false, options: agencyOptions, icon: <Building size={20} />, className: 'col-span-full', ...ro },
        { field: 'furnished', label: 'Mobiliado', type: 'select', required: true, options: [{ label: 'Sim', value: 'true' }, { label: 'Não', value: 'false' }], icon: <Sofa size={20} />, className: 'col-span-full', ...ro },
        // Marca o imóvel cuja locação sofre IRRF — é o que separa as linhas que
        // entram no quadro "Retenções dos Aluguéis" do Relatório de Locações.
        { field: 'income_tax_withholding', label: 'Imóvel com IRRF (Imposto de Renda Retido na Fonte)', type: 'checkbox', className: 'col-span-full', ...ro },
        { field: 'registration_number', label: 'Nº Cadastro', type: 'text', required: false, placeholder: 'Número de cadastro do imóvel', icon: <Hash size={20} />, className: 'col-span-full', ...ro },
        { field: 'notes', label: 'Observações', type: 'textarea', placeholder: 'Escreva detalhes não especificados anteriormente', rows: 3, icon: <FileText size={20} />, className: 'col-span-full', ...ro },
      ],
    },
    {
      title: 'Endereço',
      icon: <MapPin size={20} />,
      fields: [
        { field: 'zip_code', label: 'CEP', type: 'text', required: true, placeholder: '00000-000', mask: 'cep', icon: <MapPinIcon size={20} />, className: 'col-span-full', ...ro },
        { field: 'street', label: 'Rua', type: 'text', required: true, placeholder: 'Rua das Flores', icon: <MapPinIcon size={20} />, className: 'col-span-full', ...autoFilled },
        { field: 'number', label: 'Número', type: 'text', required: true, placeholder: '123', icon: <Hash size={20} />, ...ro },
        { field: 'complement', label: 'Complemento', type: 'text', placeholder: 'Sala 12', icon: <MapPinIcon size={20} />, ...ro },
        { field: 'block', label: 'Quadra', type: 'text', placeholder: 'Ex: 55', icon: <MapPinIcon size={20} />, ...ro },
        { field: 'lot', label: 'Lote', type: 'text', placeholder: 'Ex: 5P6P', icon: <MapPinIcon size={20} />, ...ro },
        { field: 'district', label: 'Bairro', type: 'text', required: true, placeholder: 'Centro', icon: <MapPinIcon size={20} />, ...autoFilled },
        { field: 'city', label: 'Cidade', type: 'text', required: true, placeholder: 'São Paulo', icon: <MapPinIcon size={20} />, ...autoFilled },
        { field: 'state', label: 'Estado', type: 'text', required: true, placeholder: 'SP', icon: <Globe size={20} />, ...autoFilled },
        { field: 'country', label: 'País', type: 'text', required: true, placeholder: 'Brasil', defaultValue: 'Brasil', icon: <Globe size={20} />, ...autoFilled },
        { field: 'latitude', label: 'Latitude', type: 'text', hidden: true },
        { field: 'longitude', label: 'Longitude', type: 'text', hidden: true },
        { field: 'location', label: 'Localização do imóvel', type: 'custom', className: 'col-span-full',
          render: (value, formValues, onChange) => <PropertyLocationPicker value={value} address={formValues} onChange={onChange} readOnly={readOnly} /> },
      ],
    },
    {
      title: 'Valores e Condições',
      icon: <DollarSign size={20} />,
      fields: [
        { field: 'category_id', label: 'Categoria (Financeiro)', type: 'select', required: false, searchable: true, autoOpen: false, options: [{ label: 'Nenhuma', value: '' }, ...categoryOptions], icon: <Landmark size={20} />, ...ro } as any,
        {
          field: 'subcategory_id',
          label: 'Subcategoria (Financeiro)',
          type: 'select',
          required: false,
          searchable: true,
          options: (formValues: any) => {
            const categoryId = formValues?.category_id;
            if (!categoryId) return [{ label: 'Nenhuma', value: '' }];
            return [
              { label: 'Nenhuma', value: '' },
              ...subcategoriesRaw
                .filter((s) => s.category_id === categoryId)
                .map((s) => ({ label: s.name || 'Sem nome', value: s.id })),
            ];
          },
          icon: <Landmark size={20} />,
          ...ro,
        } as any,
        { field: 'center_id', label: 'Centro de Custo (Crédito)', type: 'select', required: false, options: [{ label: 'Nenhum', value: '' }, ...creditCenterOptions], icon: <Landmark size={20} />, className: 'col-span-full', ...ro },
        { field: 'debit_center_id', label: 'Centro de Custo (Débito)', type: 'select', required: false, options: [{ label: 'Nenhum', value: '' }, ...debitCenterOptions], icon: <Landmark size={20} />, className: 'col-span-full', ...ro },
        { field: 'purchase_date', label: 'Data da Compra', type: 'date', icon: <Calendar size={20} />, className: 'col-span-full', ...ro },
        { field: 'iptu_refund_category_id', label: 'Categoria (Restituição IPTU)', type: 'select', required: false, searchable: true, autoOpen: false, options: [{ label: 'Nenhuma', value: '' }, ...categoryOptions], icon: <Landmark size={20} />, ...ro } as any,
        {
          field: 'iptu_refund_subcategory_id',
          label: 'Subcategoria (Restituição IPTU)',
          type: 'select',
          required: false,
          searchable: true,
          options: (formValues: any) => {
            const categoryId = formValues?.iptu_refund_category_id;
            if (!categoryId) return [{ label: 'Nenhuma', value: '' }];
            return [
              { label: 'Nenhuma', value: '' },
              ...subcategoriesRaw
                .filter((s) => s.category_id === categoryId)
                .map((s) => ({ label: s.name || 'Sem nome', value: s.id })),
            ];
          },
          icon: <Landmark size={20} />,
          ...ro,
        } as any,
        { field: 'purchase_value', label: 'Valor do Imóvel (Compra)', type: 'text', placeholder: 'R$ 500.000,00', mask: 'money', icon: <Dollar size={20} />, ...ro },
        { field: 'rental_value', label: 'Valor Aluguel', type: 'text', required: false, placeholder: 'R$ 3.000,00', mask: 'money', icon: <Key size={20} />, ...ro },
        { field: 'condo_fee', label: 'Valor Condomínio', type: 'text', placeholder: 'R$ 500,00', mask: 'money', icon: <Building size={20} />, ...ro },
        { field: 'property_tax', label: 'Valor IPTU (Base de Referência)', type: 'text', placeholder: 'R$ 1.200,00', mask: 'money', icon: <FileText size={20} />, ...ro },
        { field: 'market_value', label: 'Valor Venal', type: 'text', placeholder: 'R$ 0,00', mask: 'money', icon: <Dollar size={20} />, ...ro },
        {
          field: 'status',
          label: 'Status Atual',
          type: 'select',
          required: true,
          disabled: readOnly || hasActiveLease,
          options: [{ label: 'Disponível', value: 'AVAILABLE' }, { label: 'Ocupado', value: 'OCCUPIED' }],
          icon: <Key size={20} />,
          renderBottom: hasActiveLease
            ? () => (
                <div className="absolute z-10 bottom-full mb-2 hidden group-hover:block bg-surface-subtle text-content border border-ui-border text-xs rounded p-2 shadow-lg">
                  Inquilino atual: {tenantName}
                </div>
              )
            : undefined,
          className: 'relative group',
        },
        { field: 'sale_date', label: 'Data da Venda', type: 'date', icon: <Calendar size={20} />, className: 'col-span-full', ...ro },
        { field: 'sale_value', label: 'Valor de Venda', type: 'text', placeholder: 'R$ 600.000,00', mask: 'money', icon: <Dollar size={20} />, className: 'col-span-full', ...ro },
        { field: 'extra_charges', label: 'Encargos / Custos Extras', type: 'text', placeholder: 'R$ 0,00', mask: 'money', icon: <Dollar size={20} />, className: 'col-span-full', ...ro },
        { field: 'values_notes', label: 'Observações', type: 'textarea', placeholder: 'Anotações adicionais sobre os valores', rows: 3, icon: <FileText size={20} />, className: 'col-span-full', ...ro },
      ],
    },
    {
      title: 'IPTU',
      icon: <Landmark size={20} />,
      fields: [
        {
          field: 'iptus',
          label: '',
          type: 'custom',
          className: 'col-span-full w-full pt-4 border-t border-ui-border-soft mt-4',
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          render: (value: any, fv: any, onChange: any) => (
            <IptuManager
              value={value || []}
              onChange={onChange}
              readOnly={readOnly}
              activeLease={activeLease}
              baseIptu={parseMoney(fv?.property_tax ?? '0')}
            />
          ),
        },
      ],
    },
    {
      title: 'Mídias',
      icon: <Upload size={20} />,
      fields: [
        { field: 'arquivosImagens', label: 'Imagens e Vídeos', type: 'file', accept: 'image/*,video/mp4,video/webm', multiple: true, textButton: 'Selecionar Mídias', placeholder: 'Nenhum arquivo selecionado', icon: <Upload size={20} />, className: 'col-span-full w-full', maxFiles: 30, enableFeatureSelection: true, ...ro } as any,
        { field: 'arquivosMatricula', label: 'Matrícula', type: 'file', accept: '.pdf', multiple: true, maxFiles: 3, textButton: 'Escolher arquivos', className: 'flex-1 w-full', placeholder: 'Nenhum arquivo selecionado', icon: <File size={20} />, ...ro },
        { field: 'arquivosRegistro', label: 'Registro', type: 'file', accept: '.pdf', multiple: true, maxFiles: 3, textButton: 'Escolher arquivos', className: 'flex-1 w-full', placeholder: 'Nenhum arquivo selecionado', icon: <FileText size={20} />, ...ro },
        { field: 'arquivosEscritura', label: 'Escritura', type: 'file', accept: '.pdf', multiple: true, maxFiles: 3, textButton: 'Escolher arquivos', className: 'flex-1 w-full', placeholder: 'Nenhum arquivo selecionado', icon: <FileText size={20} />, ...ro },
      ],
    },
  ];

  return steps;
}

export function validateStep(steps: FormStep[], stepIndex: number, data: Record<string, unknown>): boolean {
  const fields = steps[stepIndex]?.fields ?? [];
  return fields.every((field) => {
    if (!field.required || field.hidden || field.disabled) return true;
    const value = data[field.field];
    return value !== undefined && value !== null && !(typeof value === 'string' && value.trim() === '');
  });
}
