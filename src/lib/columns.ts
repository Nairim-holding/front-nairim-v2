/* eslint-disable @typescript-eslint/no-explicit-any */
import {
  formatCurrency,
  formatStatus,
  formatValueOrDash,
  formatDate,
  formatPercent,
  formatSqm,
  formatAgency,
  formatLeaseInfo,
  formatLastLeaseInfo,
  formatMissingDocs,
  formatPropertyList,
} from "@/utils/displayFormatters";

// ─── Re-usable column presets ──────────────────────────────────────────────
const col = (key: string, label: string, extra?: Partial<{ width: string; format: (v: any) => any; tooltip: string; summable: boolean }>) => ({
  key,
  label,
  ...extra,
});

// ─── Financial ─────────────────────────────────────────────────────────────
export const COLS_AVG_RENTAL = [
  col("title",       "Imóvel",          { width: "250px" }),
  col("type",        "Tipo",            { width: "120px" }),
  col("rentalValue", "Valor do Aluguel",{ width: "150px", format: formatCurrency, summable: true }),
  col("valuePerSqm", "Valor/m²",        { width: "100px", format: (v: any) => `R$ ${v?.toFixed(2)}` }),
  col("areaTotal",   "Área Total",      { width: "100px", format: formatSqm, summable: true }),
  col("owner",       "Proprietário",    { width: "150px" }),
];

export const COLS_TOTAL_RENTAL = [
  col("title",       "Imóvel",          { width: "250px" }),
  col("type",        "Tipo",            { width: "120px" }),
  col("status",      "Status",          { width: "100px", format: formatStatus }),
  col("rentalValue", "Valor do Aluguel",{ width: "150px", format: formatCurrency, summable: true }),
  col("agency",      "Imobiliária",     { width: "200px", format: (v: any) => v?.tradeName || "-" }),
  col("leaseInfo",   "Contrato Ativo",  { width: "300px", format: formatLeaseInfo }),
];

export const COLS_TAX_FEE = [
  col("title",            "Imóvel",              { width: "250px" }),
  col("type",             "Tipo",                { width: "120px" }),
  col("propertyTax",      "IPTU",                { width: "120px", format: formatCurrency, summable: true }),
  col("condoFee",         "Condomínio",          { width: "120px", format: formatCurrency, summable: true }),
  col("totalTaxAndCondo", "Total",               { width: "120px", format: formatCurrency, summable: true }),
  col("rentalValue",      "Valor Aluguel",       { width: "150px", format: formatCurrency, summable: true }),
  col("costToRentRatio",  "Custo/Aluguel (%)",   { width: "120px", format: formatPercent }),
  col("impactOnRevenue",  "Impacto Receita (%)", { width: "120px", format: formatPercent }),
];

export const COLS_ACQUISITION = [
  col("title",               "Imóvel",            { width: "250px" }),
  col("type",                "Tipo",              { width: "120px" }),
  col("purchaseValue",       "Valor de Aquisição",{ width: "150px", format: formatCurrency, summable: true }),
  col("currentStatus",       "Status",            { width: "100px", format: formatStatus }),
  col("acquisitionDate",     "Data Aquisição",    { width: "120px", format: formatDate }),
  col("saleValue",           "Valor de Venda",    { width: "150px", format: (v: number) => v ? formatCurrency(v) : "Não definido", summable: true }),
  col("estimatedAnnualROI",  "ROI Anual Est. (%)",{ width: "120px", format: formatPercent, tooltip: "ROI Anual Estimado = (Valor do Aluguel × 12 ÷ Valor de Aquisição) × 100. É o retorno bruto anual estimado do aluguel sobre o valor pago pelo imóvel (não desconta IPTU, condomínio ou vacância)." }),
];

export const COLS_FINANCIAL_VACANCY_GAUGE = [
  col("title",         "Imóvel"),
  col("type",          "Tipo"),
  col("rentalValue",   "Valor do Aluguel",    { format: formatCurrency, summable: true }),
  col("areaTotal",     "Área Total (m²)",     { format: formatValueOrDash, summable: true }),
  col("monthsVacant",  "Meses de Vacância",   { format: (v: any) => `${formatValueOrDash(v)} meses`, summable: true }),
  col("lastLeaseInfo", "Último Inquilino",    { format: formatLastLeaseInfo }),
  col("estimatedLoss", "Perda Estimada",      { format: formatCurrency, summable: true }),
];

export const COLS_VACANCY_MONTHS = [
  col("title",            "Imóvel",          { width: "250px" }),
  col("type",             "Tipo",            { width: "120px" }),
  col("rentalValue",      "Valor do Aluguel",{ width: "150px", format: formatCurrency, summable: true }),
  col("areaTotal",        "Área Total (m²)", { width: "120px", format: formatValueOrDash, summable: true }),
  col("vacancyMonths",    "Meses Vacância",  { width: "120px", format: (v: number) => `${v || "0"} meses`, summable: true }),
  col("lastLeaseEndDate", "Último Contrato", { width: "150px", format: (v: any) => v ? new Date(v).toLocaleDateString("pt-BR") : "Sem contrato anterior" }),
  col("estimatedLoss",    "Perda Estimada",  { width: "150px", format: formatCurrency, summable: true }),
];

// ─── Portfolio ─────────────────────────────────────────────────────────────
export const COLS_TOTAL_PROPERTIES = [
  col("id",            "ID"),
  col("title",         "Título"),
  col("type",          "Tipo"),
  col("status",        "Status",     { format: formatStatus }),
  col("rentalValue",   "Aluguel",    { format: formatCurrency, summable: true }),
  col("areaTotal",     "Área",       { format: formatSqm, summable: true }),
  col("documentCount", "Qtd. Docs",  { summable: true }),
  col("agency",        "Imobiliaria",{ format: (v: any) => v?.tradeName || "-" }),
];

export const COLS_PENDING_DOCS = [
  col("title",            "Imóvel",               { width: "250px" }),
  col("documentCount",    "Qtd. Atual",            { width: "100px", summable: true }),
  col("type",             "Tipo",                  { width: "120px" }),
  col("missingDocuments", "Documentos Faltantes",  { width: "300px", format: formatMissingDocs }),
  col("isComplete",       "Completo",              { format: (v: boolean) => v ? "Sim" : "Não" }),
];

export const COLS_SALE_VALUE = [
  col("id",          "ID"),
  col("title",       "Título"),
  col("saleValue",   "Valor Venda",  { format: formatCurrency, summable: true }),
  col("type",        "Tipo"),
  col("rentalValue", "Aluguel",      { format: formatCurrency, summable: true }),
];

export const COLS_AVAILABILITY_DONUT = [
  col("title",       "Imóvel"),
  col("type",        "Tipo"),
  col("rentalValue", "Valor Aluguel",{ format: formatCurrency, summable: true }),
  col("areaTotal",   "Área (m²)",    { format: formatValueOrDash, summable: true }),
  col("status",      "Status",       { format: formatStatus }),
];

export const COLS_TYPES_DONUT = [
  col("title",        "Imóvel"),
  col("type",         "Tipo"),
  col("rentalValue",  "Valor Aluguel",{ format: formatCurrency, summable: true }),
  col("areaTotal",    "Área (m²)",    { format: formatValueOrDash, summable: true }),
  col("monthsVacant", "Meses Vago",   { format: formatValueOrDash, summable: true }),
];

export const COLS_OCCUPATION_GAUGE = [
  col("id",          "ID"),
  col("title",       "Imóvel"),
  col("rentalValue", "Valor Aluguel", { format: formatCurrency, summable: true }),
  col("status",      "Status",        { format: formatStatus }),
  col("type",        "Tipo"),
];

export const COLS_VACANCY_GAUGE = [
  col("id",          "ID"),
  col("title",       "Imóvel"),
  col("rentalValue", "Valor Aluguel", { format: formatCurrency, summable: true }),
  col("type",        "Tipo"),
  col("areaTotal",   "Area Total (m²)", { format: formatValueOrDash, summable: true }),
];

// ─── Clients ───────────────────────────────────────────────────────────────
export const COLS_OWNERS = [
  col("name",            "Nome",         { width: "200px" }),
  col("createdAt",       "Desde",        { width: "120px", format: (v: any) => new Date(v).toLocaleDateString("pt-BR") }),
  col("propertiesCount", "Qtd. Imóveis", { width: "100px", summable: true }),
  col("properties",      "Imóveis",      { width: "300px", format: formatPropertyList }),
];

/** Uma linha por vínculo inquilino-imóvel, agrupada por imóvel (ver `detailGroupBy` no card). */
export const COLS_TENANTS_BY_PROPERTY = [
  col("tenantName",      "Inquilino",       { width: "220px" }),
  col("contractNumber",  "Contrato",        { width: "140px" }),
  col("rentalValue",     "Valor Aluguel",   { width: "150px", format: formatCurrency, summable: true }),
  col("tenantSince",     "Inquilino Desde", { width: "140px", format: (v: any) => v ? new Date(v).toLocaleDateString("pt-BR") : "-" }),
];

export const COLS_PROPERTIES_PER_OWNER = [
  col("name",            "Proprietário", { width: "200px" }),
  col("propertiesCount", "Qtd. Imóveis", { width: "100px", summable: true }),
  col("properties",      "Imóveis",      { width: "300px", format: formatPropertyList }),
];

export const COLS_AGENCIES = [
  col("tradeName",       "Nome Fantasia"),
  col("legalName",       "Razão Social"),
  col("createdAt",       "Desde",        { format: (v: any) => new Date(v).toLocaleDateString("pt-BR") }),
  col("propertiesCount", "Qtd. Imóveis", { summable: true }),
];

export const COLS_PROPERTIES_BY_AGENCY = [
  col("title",       "Imóvel"),
  col("rentalValue", "Valor",       { format: formatCurrency, summable: true }),
  col("status",      "Status",      { format: formatStatus }),
  col("agency",      "Imobiliária", { format: formatAgency }),
];
