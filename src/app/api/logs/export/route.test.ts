import { beforeEach, expect, it, vi } from 'vitest';
import { runWithAuditActor } from '@/infra/database/audit-context';
import { runWithTenant } from '@/infra/database/tenant-context';
const state = vi.hoisted(() => ({ next: vi.fn(), close: vi.fn(), find: vi.fn(), create: vi.fn() }));
vi.mock('@/infra/database/prisma',()=>({ default:{ auditLogOutbox:{ create:state.create } } }));
vi.mock('@/infra/database/mongodb',()=>({ logsCollection:async()=>({ find:state.find }) }));
vi.mock('@/infra/auth/session',()=>({
  assertAdmin:vi.fn(),
  withPermission:async (_resource: string,_action: string,fn:(session:{company_id:string})=>unknown)=>runWithTenant('a',()=>runWithAuditActor({id:'actor',name:'Usuário',email:'actor@example.test',company_id:'a'},()=>fn({company_id:'a'}))),
}));
import { GET } from './route';
beforeEach(()=>{
  vi.clearAllMocks(); state.next.mockReset(); state.create.mockReset(); state.create.mockResolvedValue({});
  const cursor={next:state.next,close:state.close,sort:vi.fn().mockReturnThis()};
  state.find.mockReturnValue(cursor); state.close.mockResolvedValue(undefined);
  state.next.mockResolvedValueOnce({id:'one'}).mockResolvedValueOnce({id:'two'}).mockResolvedValueOnce(null);
});
it('audits the completed JSON stream using its captured actor and exact count',async()=>{
  const response=await GET(new Request('https://example.test/api/logs/export?mode=all'));
  expect(response.status).toBe(200);
  expect((await response.json()).logs).toEqual([{id:'one'},{id:'two'}]);
  expect(state.create).toHaveBeenCalledTimes(1);
  expect(state.create).toHaveBeenCalledWith({data:expect.objectContaining({company_id:'a',user_id:'actor',action:'EXPORT',table_name:'AuditLog',new_values:expect.objectContaining({format:'JSON',record_count:2})})});
});
it('does not record completion when the download is cancelled',async()=>{
  const response=await GET(new Request('https://example.test/api/logs/export?mode=all'));
  const reader=response.body!.getReader(); await reader.read(); await reader.cancel();
  expect(state.create).not.toHaveBeenCalled(); expect(state.close).toHaveBeenCalled();
});
it('does not record completion when cursor reading fails',async()=>{
  state.next.mockReset().mockResolvedValueOnce({id:'one'}).mockRejectedValueOnce(new Error('cursor failed'));
  const response=await GET(new Request('https://example.test/api/logs/export?mode=all'));
  await expect(response.text()).rejects.toThrow('cursor failed');
  expect(state.create).not.toHaveBeenCalled(); expect(state.close).toHaveBeenCalled();
});
