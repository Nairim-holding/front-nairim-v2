import type { InvestmentProductType } from '@/core/entities/investment';

/**
 * Rótulos dos tipos de produto de investimento, como aparecem no select
 * "Tipo do Produto" e na coluna da grid.
 *
 * Fica em `shared` porque é consumido dos dois lados: pelo repositório (para
 * montar as opções do filtro dinâmico) e pelos modais do cliente.
 *
 * Camada: shared (dado estático puro, sem I/O).
 */
export const INVESTMENT_PRODUCT_TYPE_LABELS: Record<InvestmentProductType, string> = {
  CDB: 'CDB - Certificado de Depósito Bancário',
  RDB: 'RDB - Recibo de Depósito Bancário',
  LCI: 'LCI - Letra de Crédito Imobiliário',
  LCA: 'LCA - Letra de Crédito do Agronegócio',
  LC: 'LC - Letra de Câmbio',
  LF: 'LF - Letra Financeira',
  TESOURO_DIRETO: 'Tesouro Direto',
  POUPANCA: 'Poupança',
  DEBENTURE: 'Debênture',
  CRI: 'CRI - Certificado de Recebíveis Imobiliários',
  CRA: 'CRA - Certificado de Recebíveis do Agronegócio',
  COE: 'COE - Certificado de Operações Estruturadas',
  FUNDO: 'Fundo de Investimento',
  PREVIDENCIA: 'Previdência Privada',
  ACAO: 'Ação',
  FII: 'FII - Fundo Imobiliário',
  ETF: 'ETF',
  BDR: 'BDR',
  CRIPTO: 'Criptoativo',
  OUTRO: 'Outro',
};

/** Opções na ordem em que o select as apresenta. */
export const INVESTMENT_PRODUCT_TYPE_OPTIONS = (
  Object.keys(INVESTMENT_PRODUCT_TYPE_LABELS) as InvestmentProductType[]
).map((value) => ({ value, label: INVESTMENT_PRODUCT_TYPE_LABELS[value] }));
