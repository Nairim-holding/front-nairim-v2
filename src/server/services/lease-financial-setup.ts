import prisma from '@/infra/database/prisma';
import { ValidationError } from '@/core/errors/domain-errors';
import { PROPERTY_FINANCIAL_SETUP_ERROR, AGENCY_FINANCIAL_SETUP_ERROR, PROPERTY_FINANCIAL_FIELDS } from '@/shared/validators/lease-financial-setup';
/** Validate actual records, never display labels supplied by the browser. */
export async function assertLeaseFinancialSetup(propertyId: string, agencyId?: string | null) {
  const [property, agency] = await Promise.all([
    prisma.property.findFirst({ where: { id: propertyId, deleted_at: null }, select: { category_id: true, subcategory_id: true, center_id: true, debit_center_id: true, iptu_refund_category_id: true, iptu_refund_subcategory_id: true } }),
    agencyId ? prisma.agency.findFirst({ where: { id: agencyId, deleted_at: null }, select: { commission_category_id: true, commission_subcategory_id: true, commission_percentage: true } }) : null,
  ]);
  if (!property || Object.keys(PROPERTY_FINANCIAL_FIELDS).some(field => !property[field as keyof typeof property])) throw new ValidationError(PROPERTY_FINANCIAL_SETUP_ERROR);
  if (!agency?.commission_category_id || !agency.commission_subcategory_id || agency.commission_percentage == null) throw new ValidationError(AGENCY_FINANCIAL_SETUP_ERROR);
}
