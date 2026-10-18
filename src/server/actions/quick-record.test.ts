import { beforeEach, expect, it, vi } from 'vitest';
const state = vi.hoisted(() => ({ allowed: true, create: vi.fn(), permission: vi.fn() }));
vi.mock('@/infra/database/prisma', () => ({ default: Object.fromEntries(['owner','tenant','agency','propertyType'].map(model => [model,{create:state.create}])) }));
vi.mock('@/infra/auth/session', () => ({ withPermission: async (resource:string,action:string,callback:(session:{company_id:string})=>unknown) => {
  state.permission(resource,action); if(!state.allowed)throw new Error('Sem permissão'); return callback({company_id:'particular'});
} }));
import { quickCreateRecordAction } from './quick-record';
import { isValidCPF } from '@/shared/validators/br-documents';
beforeEach(() => { vi.clearAllMocks(); state.allowed=true; state.create.mockImplementation(async ({data})=>({id:'new',...data})); });
it.each(['owners','tenants','agencies','property-types'] as const)('cria %s só no tenant autorizado e sem cadastro externo',async resource=>{
  const result=await quickCreateRecordAction(resource,'  Cadastro novo  '); expect(result.ok).toBe(true);
  expect(state.permission).toHaveBeenCalledWith(resource,'create');
  const data=state.create.mock.calls[0][0].data; expect(data.company_id).toBe('particular');
  if(resource==='owners'||resource==='tenants'){expect(data.internal_code).toMatch(/^RAP-/);expect(isValidCPF(data.cpf)).toBe(true);expect(data.occupation).toContain('cadastro rápido');}
});
it('recusa criação sem permissão e nome vazio antes de gravar',async()=>{
  state.allowed=false;expect((await quickCreateRecordAction('owners','Nome')).ok).toBe(false);
  state.allowed=true;expect((await quickCreateRecordAction('owners',' ')).ok).toBe(false);expect(state.create).not.toHaveBeenCalled();
});
