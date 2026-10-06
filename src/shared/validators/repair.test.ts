import { describe, expect, it } from 'vitest';
import { repairSchema, repairDetailsSchema, repairListSchema } from './repair';
const valid = { property_id: '00000000-0000-4000-8000-000000000001', event_date: '2026-10-02', event_type: 'REPAIR',
  problem_type: 'STRUCTURAL', description: 'Trincas na parede', supplier_id: '00000000-0000-4000-8000-000000000002', service_amount: '1200.50', materials_amount: 500,
  payment_method: 'Pix', payment_conditions: 'À vista', status: 'PLANNED', start_date: '', completion_date: '' };
describe('Cadastro de reparos', () => {
  it('aceita o cadastro e converte os custos em números e as datas vazias em null', () => {
    expect(repairSchema.parse(valid)).toMatchObject({ service_amount: 1200.5, materials_amount: 500, start_date: null, completion_date: null });
  });
  it.each([{service_amount: -1}, {materials_amount: 2.001}, {service_amount: Infinity}, {event_date: '2026-02-30'}, {supplier_id: ''}, {supplier_id: '__new__:José'}, {description: ''}, {event_type: 'other'}])('recusa dados inválidos %j', input => {
    expect(repairSchema.safeParse({ ...valid, ...input }).success).toBe(false);
  });
  it('exige um vínculo e não aceita substituir o responsável apenas por nome', () => {
    expect(repairSchema.safeParse({ ...valid, supplier_id: undefined, professional: 'José' }).success).toBe(false);
    expect(repairSchema.parse({ ...valid, professional: 'Nome adulterado' })).not.toHaveProperty('professional');
  });
  it('valida os demais campos antes de criar o contato do cadastro rápido', () => {
    expect(repairDetailsSchema.safeParse({ ...valid, supplier_id: '__new__:José' }).success).toBe(true);
    expect(repairDetailsSchema.safeParse({ ...valid, supplier_id: '__new__:José', status: 'COMPLETED', completion_date: '' }).success).toBe(false);
    expect(repairDetailsSchema.safeParse({ ...valid, supplier_id: '__new__:José', service_amount: -1 }).success).toBe(false);
  });
  it('exige data de conclusão para serviços concluídos', () => {
    expect(repairSchema.safeParse({ ...valid, status: 'COMPLETED' }).success).toBe(false);
    expect(repairSchema.safeParse({ ...valid, status: 'COMPLETED', completion_date: '2026-10-04' }).success).toBe(true);
  });
  it('recusa conclusão anterior ao início', () => {
    expect(repairSchema.safeParse({ ...valid, start_date: '2026-10-04', completion_date: '2026-10-03' }).success).toBe(false);
  });
  it('recusa períodos invertidos e páginas inválidas', () => {
    expect(repairListSchema.safeParse({ from: '2026-10-04', to: '2026-10-02' }).success).toBe(false);
    expect(repairListSchema.safeParse({ page: 0 }).success).toBe(false);
  });
  it('aceita múltiplos problemas, profissionais e itens de mão de obra ou materiais', () => {
    const multiple = { ...valid, problem_types: ['HYDRAULIC', 'FINISHING', 'HYDRAULIC'], supplier_ids: [valid.supplier_id, '00000000-0000-4000-8000-000000000003'],
      items: [{ description: 'Trocar 2 janelas', kind: 'LABOR', supplier_id: valid.supplier_id, amount: 1500 }] };
    expect(repairSchema.parse(multiple)).toMatchObject({ problem_types: ['HYDRAULIC', 'FINISHING'], supplier_ids: multiple.supplier_ids, items: multiple.items });
  });
  it.each([{ problem_types: [] }, { supplier_ids: [] }, { items: [{ description: '', kind: 'LABOR', supplier_id: valid.supplier_id, amount: 1500 }] },
    { items: [{ description: 'Janela', kind: 'OTHER', supplier_id: valid.supplier_id, amount: 5000 }] },
    { items: [{ description: 'Janela', kind: 'MATERIAL', supplier_id: valid.supplier_id, amount: -1 }] }])('recusa seleção ou item inválido %j', change => {
    expect(repairSchema.safeParse({ ...valid, ...change }).success).toBe(false);
  });
});
