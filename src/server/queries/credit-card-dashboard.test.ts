import { beforeEach, describe, expect, it, vi } from 'vitest';
const mocks = vi.hoisted(() => ({ cards: vi.fn(), transactions: vi.fn(), permission: vi.fn() }));
vi.mock('server-only', () => ({}));
vi.mock('@/infra/database/prisma', () => ({ default: { card: { findMany: mocks.cards }, transaction: { findMany: mocks.transactions } } }));
vi.mock('@/infra/auth/session', () => ({ withPermission: mocks.permission }));
import { getCreditCardDashboardData } from './credit-card-dashboard';
describe('consulta do painel de cartões', () => {
  beforeEach(() => {
    vi.resetAllMocks();
    mocks.permission.mockImplementation((_module, _action, callback) => callback({ company_id: 'a' }));
    mocks.cards.mockResolvedValue([{ id:'card-a', name:'Cartão A', limit:100, closing_day:1, due_day:10, is_active:true }]);
    mocks.transactions.mockResolvedValue([]);
  });
  it('exige permissão e usa exclusivamente empresa e cartões da sessão', async () => {
    await getCreditCardDashboardData({ year:2026, month:1, company_id:'b' });
    expect(mocks.permission).toHaveBeenCalledWith('financial-cards', 'view', expect.any(Function));
    expect(mocks.cards.mock.calls[0][0].where).toEqual({ company_id:'a', deleted_at:null });
    expect(mocks.transactions.mock.calls[0][0].where).toMatchObject({ company_id:'a', deleted_at:null, canceled_at:null, is_transfer:false, card_id:{in:['card-a']}, category:{company_id:'a',type:'EXPENSE'} });
    expect(mocks.transactions.mock.calls[0][0].where.OR[0]).toEqual({ invoice:{is:{company_id:'a',deleted_at:null,year:2026}} });
  });
  it('rejeita cartão estrangeiro antes de consultar lançamentos e respeita recusa de permissão', async () => {
    await expect(getCreditCardDashboardData({ year:2026,month:1,cardIds:['foreign'] })).rejects.toThrow('Cartão não encontrado');
    expect(mocks.transactions).not.toHaveBeenCalled();
    mocks.cards.mockClear(); mocks.permission.mockRejectedValue(new Error('Forbidden'));
    await expect(getCreditCardDashboardData({ year:2026,month:1 })).rejects.toThrow('Forbidden');
    expect(mocks.cards).not.toHaveBeenCalled();
  });
  it('prioriza competência da fatura e oculta subcategoria de outra empresa', async () => {
    mocks.transactions.mockResolvedValue([{ id:'tx',card_id:'card-a',description:'Compra',amount:'25.30',event_date:new Date('2025-12-25'),effective_date:new Date('2025-12-28'),status:'PENDING',installment_number:1,total_installments:2,category:{id:'c',name:'Categoria'},subcategory:{name:'Sigiloso',company_id:'b'},invoice:{year:2026,month:1} }]);
    const result = await getCreditCardDashboardData({ year:2026,month:1 });
    expect(result.total).toBe(25.3);
    expect(result.transactions[0]).toMatchObject({year:2026,month:1,subcategory:null,installment:'1/2'});
    expect((await getCreditCardDashboardData({ year:2026,month:1,cardIds:[] })).total).toBe(0);
  });
  it.each([{year:2026,month:13},{year:0,month:1},{year:2026,month:1,cardIds:['']}])('valida entrada antes do acesso ao banco: %j', async input => {
    await expect(getCreditCardDashboardData(input)).rejects.toThrow();
    expect(mocks.permission).not.toHaveBeenCalled();
  });
});
