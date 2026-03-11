/* eslint-disable @typescript-eslint/no-explicit-any */

export const formatCurrency = (val: any): string =>
  typeof val === "number"
    ? `R$ ${val.toLocaleString("pt-BR", { minimumFractionDigits: 2 })}`
    : "R$ 0,00";

export const formatCurrencyFixed = (v?: number): string =>
  typeof v === "number" ? `R$ ${v.toFixed(2).replace(".", ",")}` : "R$ 0,00";

export const formatCurrencyRounded = (v?: number): string =>
  typeof v === "number"
    ? `R$ ${Math.round(v).toLocaleString("pt-BR")}`
    : "R$ 0";

export const formatValueOrDash = (v: any): any =>
  v !== undefined && v !== null ? v : "-";

export const formatDate = (v: any): string =>
  v ? new Date(v).toLocaleDateString("pt-BR") : "N/A";

export const formatPercent = (v: any): string =>
  `${v?.toFixed(2) ?? "0"}%`;

export const formatSqm = (v: any): string =>
  `${formatValueOrDash(v)}m²`;

export const STATUS_MAP: Record<string, string> = {
  AVAILABLE:   "Disponível",
  RENTED:      "Alugado",
  OCCUPIED:    "Ocupado",
  SOLD:        "Vendido",
  MAINTENANCE: "Manutenção",
  UNAVAILABLE: "Indisponível",
};

export const formatStatus = (v: string): string =>
  STATUS_MAP[v] || v || "-";

export const formatPropertyList = (properties: any[]): string => {
  if (!Array.isArray(properties) || properties.length === 0) return "-";
  const display = properties.slice(0, 3).map((p) => p.title).join(", ");
  return properties.length > 3
    ? `${display} (+${properties.length - 3})`
    : display;
};

export const formatAgency = (v: any): string =>
  v?.tradeName || v?.legalName || "-";

export const formatLeaseInfo = (value: any): string =>
  value
    ? `Contrato: ${value.contractNumber || "N/A"} | Inquilino: ${value.tenantName || "N/A"}`
    : "Sem contrato ativo";

export const formatLastLeaseInfo = (v: any): string =>
  v
    ? `${v.tenantName} (Fim: ${formatDate(v.endDate)})`
    : "N/A";

export const formatMissingDocs = (docs: string[]): string =>
  docs
    .map(
      (d) =>
        ({ TITLE_DEED: "Escritura", REGISTRATION: "Matrícula", PROPERTY_RECORD: "Registro" }[d] || d)
    )
    .join(", ");