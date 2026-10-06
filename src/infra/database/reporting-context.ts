import { AsyncLocalStorage } from 'node:async_hooks';

const globalReporting = globalThis as unknown as { reportingStorage?: AsyncLocalStorage<readonly string[]> };
const reportingStorage = globalReporting.reportingStorage ??= new AsyncLocalStorage<readonly string[]>();
export const getReportingCompanyIds = () => reportingStorage.getStore();
export const isConsolidatedReporting = () => (getReportingCompanyIds()?.length ?? 0) > 1;

/** Called only after server-side root authorization and company validation. */
export function runWithReportingCompanies<T>(ids: readonly string[], fn: () => T): T {
  return reportingStorage.run(Object.freeze([...ids]), fn);
}

const REPORTING_MODELS = new Set(['Agency', 'Property', 'PropertyType', 'Owner', 'Tenant', 'Lease',
  'FinancialInstitution', 'Category', 'Subcategory', 'Card', 'Center', 'Supplier', 'Transaction', 'Invoice', 'Planning']);

export function injectReportingRead<T extends { where?: unknown }>(model: string | undefined, args: T): T {
  const ids = getReportingCompanyIds();
  if (!ids || !model || !REPORTING_MODELS.has(model)) return args;
  return { ...args, where: { ...((args.where ?? {}) as object), company_id: { in: [...ids] } } };
}
