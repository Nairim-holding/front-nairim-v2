import { z } from 'zod';
import prisma from '@/infra/database/prisma';
import { assertSuperAdmin } from './session';
import type { DecodedSessionToken } from '@/core/cryptography/token-signer';
import { ValidationError } from '@/core/errors/domain-errors';
import { runWithReportingCompanies } from '@/infra/database/reporting-context';

const companySelection = z.array(z.string().uuid()).max(1000);

/** Separate read scope: never changes the authenticated company or mutation scope. */
export async function withReportingScope<T>(session: DecodedSessionToken, raw: Record<string, unknown>, fn: () => Promise<T>): Promise<T> {
  const value = raw.company_ids;
  if (value === undefined || (Array.isArray(value) && value.length === 0)) return fn();
  assertSuperAdmin(session);
  const ids = [...new Set(companySelection.parse(value))];
  const companies = await prisma.company.findMany({
    where: { id: { in: ids }, deleted_at: null, is_active: true }, select: { id: true },
  });
  if (companies.length !== ids.length) throw new ValidationError('Selecione somente empresas ativas e disponíveis.');
  return runWithReportingCompanies(ids, fn);
}
