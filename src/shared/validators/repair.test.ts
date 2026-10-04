import { describe, expect, it } from 'vitest';
import { repairSchema, repairListSchema } from './repair';
const valid = { property_id: '00000000-0000-4000-8000-000000000001', event_date: '2026-10-02', event_type: 'REPAIR',
  problem_type: 'STRUCTURAL', description: 'Trincas na parede', professional: 'José', service_amount: '1200.50', materials_amount: 500,
  payment_method: 'Pix', payment_conditions: 'À vista', status: 'PLANNED', start_date: '', completion_date: '' };
describe('Cadastro de reparos', () => {
  it('aceita o cadastro e converte os custos em números e as datas vazias em null', () => {
    expect(repairSchema.parse(valid)).toMatchObject({ service_amount: 1200.5, materials_amount: 500, start_date: null, completion_date: null });
  });
  it.each([{service_amount: -1}, {materials_amount: 2.001}, {event_date: '2026-02-30'}, {professional: ' '}, {description: ''}, {event_type: 'other'}])('recusa dados inválidos %j', input => {
    expect(repairSchema.safeParse({ ...valid, ...input }).success).toBe(false);
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
});
