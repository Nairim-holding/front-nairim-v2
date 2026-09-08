import prisma from '@/infra/database/prisma';
import { getCurrentCompanyId } from '@/infra/database/tenant-context';
import { ForbiddenError } from '@/core/errors/domain-errors';

// Foreign keys accepted by the public write actions. A scoped root record is
// insufficient: connecting another company's owner/account leaks related data.
const REFERENCES = {
  owner_id: 'owner', tenant_id: 'tenant', property_id: 'property', type_id: 'propertyType',
  agency_id: 'agency', category_id: 'category', subcategory_id: 'subcategory',
  center_id: 'center', debit_center_id: 'center', destination_center_id: 'center',
  financial_institution_id: 'financialInstitution', destination_institution_id: 'financialInstitution',
  institution_id: 'financialInstitution', card_id: 'card', supplier_id: 'supplier',
  invoice_id: 'invoice', lease_id: 'lease', adjustment_index_id: 'adjustmentIndex',
  investment_id: 'investment', user_group_id: 'userGroup',
  commission_category_id: 'category', commission_subcategory_id: 'subcategory',
  iptu_refund_category_id: 'category', iptu_refund_subcategory_id: 'subcategory',
  income_category_id: 'category', income_subcategory_id: 'subcategory',
  expense_category_id: 'category', expense_subcategory_id: 'subcategory',
} as const;

export async function assertTenantReferences(input: Record<string, unknown>): Promise<void> {
  const companyId = getCurrentCompanyId();
  if (!companyId) throw new ForbiddenError('Contexto de empresa não identificado.');
  for (const [field, model] of Object.entries(REFERENCES)) {
    const id = input[field];
    if (id === undefined || id === null || id === '') continue;
    if (typeof id !== 'string') throw new ForbiddenError('Referência inválida.');
    const delegate = prisma[model] as unknown as {
      findFirst(args: { where: { id: string; company_id: string }; select: { id: true } }): Promise<unknown>;
    };
    const exists = await delegate.findFirst({ where: { id, company_id: companyId }, select: { id: true } });
    if (!exists) throw new ForbiddenError('Registro relacionado não pertence à empresa atual.');
  }
}
