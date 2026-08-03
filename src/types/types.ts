/* eslint-disable @typescript-eslint/no-explicit-any */
import React from 'react';

export interface ApiResponse {
  success: boolean;
  data: {
    user: {
      id: string;
      name: string;
      email: string;
      role: string;
      company_id: string;
      company_slug?: string;
      created_at: string;
    };
    token: string;
    expiresIn: string;
  };
  message: string;
}

export type ColumnType = 'text' | 'date' | 'number' | 'currency' | 'boolean' | 'custom' | 'select';

export interface ColumnDef {
  field: string;
  label: string;
  sortParam?: string;
  type?: ColumnType;
  formatter?: 'currency' | 'date' | 'datetime' | 'cpfCnpj' | 'rg' | 'phone' | 'boolean' | 'gender' | 'address' | 'propertyStatus' | 'cep';
  nestedField?: string;
  width?: string;
  align?: 'left' | 'center' | 'right';
  optionsKey?: string;
}

export interface Option {
  label: string;
  value: string | number;
}

export interface FormFieldDef {
  field: string;
  label: string;
  type: 'text' | 'email' | 'tel' | 'number' | 'date' | 'password' | 'select' | 'textarea' | 'checkbox' | 'boolean' | 'file' | 'custom';
  required?: boolean;
  placeholder?: string;
  defaultValue?: any;
  options?: Option[] | ((formValues: any) => Option[]);
  validation?: {
    pattern?: RegExp;
    patternMessage?: string;
    minLength?: number;
    maxLength?: number;
    custom?: (value: any, formValues: any) => string | null;
  };
  gridCols?: number;
  className?: string;
  icon?: React.ReactNode;
  disabled?: boolean;
  readOnly?: boolean;
  hidden?: boolean | ((formValues: any) => boolean);
  mask?: 'cpf' | 'cnpj' | 'rg' | 'cep' | 'telefone' | 'telefoneSemDDD' | 'money' | 'metros2' | 'metros';
  maxLength?: number;
  showIncrementButtons?: boolean;
  tabIndex?: number;
  autoFocus?: boolean;
  multiple?: boolean;
  /** Remove a largura máxima padrão (300px) do Input, deixando-o preencher a célula. */
  full?: boolean;
  accept?: string;
  buttonText?: string;
  textButton?: string;
  maxFiles?: number;
  min?: number;
  max?: number;
  rows?: number;
  // CORREÇÃO: Adicionado onChange como terceiro parâmetro opcional
  // 4º parâmetro (setFieldValue) permite que um campo customizado atualize OUTRO
  // campo do formulário — ex.: um botão "gerar senha" que preenche senha e
  // confirmação ao mesmo tempo.
  render?: (
    value: any,
    formValues?: any,
    onChange?: (value: any) => void,
    setFieldValue?: (field: string, value: any) => void
  ) => React.ReactNode;
  /** Conteúdo extra abaixo do campo nativo (ex.: checklist de senha, idade calculada). */
  renderBottom?: (
    value: any,
    formValues?: any,
    setFieldValue?: (field: string, value: any) => void
  ) => React.ReactNode;
}

export interface FormStep {
  title: string;
  icon?: React.ReactNode;
  fields: FormFieldDef[];
}

export interface DynamicFormConfig {
  resource: string;
  title: string;
  basePath: string;
  mode: 'create' | 'edit' | 'view';
  id?: string;
  steps?: FormStep[];
  fields?: FormFieldDef[];
  onSubmitSuccess?: (data: any) => void;
  onCancel?: () => void;
  transformData?: (data: any) => any;
  transformResponse?: (data: any) => any;
}

export interface MetricDataItem {
  id: string | number;
  title?: string;
  [key: string]: any;
}

export interface MetricWithData {
  result: number;
  variation: number;
  isPositive: boolean;
  data?: MetricDataItem[];
}

export interface MetricResponse {
  averageRentalTicket: MetricWithData;
  totalRentalActive: MetricWithData;
  totalAcquisitionValue: MetricWithData;
  financialVacancyRate: MetricWithData;
  totalPropertyTaxAndCondoFee: MetricWithData;
  vacancyInMonths: MetricWithData;
  totalPropertys: MetricWithData;
  countPropertiesWithLessThan3Docs: MetricWithData;
  totalPropertiesWithSaleValue: MetricWithData;
  ownersTotal: MetricWithData;
  tenantsTotal: MetricWithData;
  propertiesPerOwner: MetricWithData;
  agenciesTotal: MetricWithData;
  vacancyRate: MetricWithData;
  occupationRate: MetricWithData;

  availablePropertiesByType: Array<{
    name: string;
    value: number;
    data?: MetricDataItem[];
  }>;
  propertiesByAgency: Array<{
    name: string;
    value: number;
    data?: MetricDataItem[];
  }>;
  
  geolocationData: Array<{
    lat: number;
    lng: number;
    info: string;
  }>;
}