'use server';
import { randomInt, randomUUID } from 'node:crypto';
import { z } from 'zod';
import prisma from '@/infra/database/prisma';
import { withPermission } from '@/infra/auth/session';
import { runAction } from '@/shared/actions/action-result';

/** Provisional documents are random, never reused as a shared real identity. */
function provisionalCpf() {
  const digits = Array.from({ length: 9 }, () => randomInt(10));
  for (const size of [9, 10]) {
    const sum = digits.reduce((total, digit, index) => total + digit * (size + 1 - index), 0);
    const remainder = (sum * 10) % 11; digits.push(remainder === 10 ? 0 : remainder);
  }
  return digits.join('');
}
export async function quickCreateRecordAction(resource: 'owners' | 'tenants' | 'agencies' | 'property-types', rawName: string) {
  return runAction(async () => {
    const kind = z.enum(['owners', 'tenants', 'agencies', 'property-types']).parse(resource);
    const name = z.string().trim().min(2, 'Informe pelo menos dois caracteres').max(150).parse(rawName);
    return withPermission(kind, 'create', async session => {
      const internal_code = `RAP-${randomUUID()}`;
      if (kind === 'property-types') return prisma.propertyType.create({ data: { description: name, company_id: session.company_id } });
      if (kind === 'agencies') return prisma.agency.create({ data: { company_id: session.company_id, trade_name: name, legal_name: `${name} (cadastro rápido)`, cnpj: String(randomInt(10000000, 99999999)) + String(randomInt(100000,999999)) } });
      const data = { company_id: session.company_id, name, internal_code, cpf: provisionalCpf(), occupation: 'A informar (cadastro rápido)', marital_status: 'A informar' };
      return kind === 'owners' ? prisma.owner.create({ data }) : prisma.tenant.create({ data: { ...data, nationality: 'A informar' } });
    });
  });
}
