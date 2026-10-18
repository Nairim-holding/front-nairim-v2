import { beforeEach, expect, it, vi } from 'vitest';
const db=vi.hoisted(()=>({property:vi.fn(),agency:vi.fn()}));
vi.mock('@/infra/database/prisma',()=>({default:{property:{findFirst:db.property},agency:{findFirst:db.agency}}}));
import { assertLeaseFinancialSetup } from './lease-financial-setup';
import { PROPERTY_FINANCIAL_FIELDS } from '@/shared/validators/lease-financial-setup';
beforeEach(()=>{db.property.mockResolvedValue(Object.fromEntries(Object.keys(PROPERTY_FINANCIAL_FIELDS).map(key=>[key,'valid'])));db.agency.mockResolvedValue({commission_category_id:'category',commission_subcategory_id:'subcategory',commission_percentage:0});});
it('aceita cadastro completo e percentual zero explícito',async()=>{await expect(assertLeaseFinancialSetup('property','agency')).resolves.toBeUndefined();});
it.each(Object.keys(PROPERTY_FINANCIAL_FIELDS))('recusa imóvel sem %s com orientação completa',async field=>{
  db.property.mockResolvedValue({...Object.fromEntries(Object.keys(PROPERTY_FINANCIAL_FIELDS).map(key=>[key,'valid'])),[field]:null});
  await expect(assertLeaseFinancialSetup('property','agency')).rejects.toThrow('Valores e Condições');
});
it('recusa comissão não configurada sem aceitar rótulos do cliente',async()=>{
  db.agency.mockResolvedValue({commission_category_id:'category',commission_subcategory_id:'subcategory',commission_percentage:null});
  await expect(assertLeaseFinancialSetup('property','agency')).rejects.toThrow('% Comissão (Financeiro)');
});
