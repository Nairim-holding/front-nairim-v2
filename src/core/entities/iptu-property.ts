/**
 * Entidades de dominio: IPTU do imóvel (PropertyIptu) e o contrato do
 * endpoint `GET /iptu-property/filters`.
 *
 * Fidelidade ao backend (IptuPropertyService.getIptuPropertyFilters):
 *  - Os filtros são dinâmicos (shape do DynamicFilterModal universal do front):
 *    cada field traz `type`, `label`, `description` e valores/opções derivados
 *    dos registros (anos, valores de cota 1ª/2ª parcela, qtd. de parcelas).
 *  - Aplica filtros em: year (Int), payment_condition (enum), valores decimais
 *    e contagem de parcelas — quando fornecidos, para calcular valores únicos.
 *  - `operators`, `defaultSort` e `searchFields` replicam o retorno da rota.
 *
 * Camada: core. Origem: api-nairim-v2/src/services/IptuPropertyService.ts.
 */

export type PaymentCondition =
  | 'IN_FULL_15_DISCOUNT'
  | 'SECOND_INSTALLMENT_10_DISCOUNT'
  | 'INSTALLMENTS';

/** Parâmetros opcionais aceitos pelo endpoint de filtros. */
export interface IptuPropertyFiltersParams {
  [key: string]: unknown;
}

/** Um filtro dinâmico (campo da resposta de `/filters`). */
export interface IptuPropertyFilter {
  field: string;
  type: 'number' | 'select' | 'date' | 'string' | 'boolean' | 'enum';
  label: string;
  description: string;
  values?: string[];
  options?: Array<{ value: string; label: string }>;
  min?: string;
  max?: string;
  dateRange?: boolean;
  searchable?: boolean;
}

/** Operadores aceitos por tipo de field. */
export interface IptuPropertyOperators {
  string: string[];
  number: string[];
  date: string[];
  boolean: string[];
  select: string[];
}

/** Resposta de GET /iptu-property/filters. */
export interface IptuPropertyFiltersResult {
  filters: IptuPropertyFilter[];
  operators: IptuPropertyOperators;
  defaultSort: string;
  searchFields: string[];
}