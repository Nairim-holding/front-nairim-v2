import { beforeEach, expect, it, vi } from 'vitest';
import { runWithAuditActor } from '@/infra/database/audit-context';
const state = vi.hoisted(()=>({ export:vi.fn(), download:vi.fn(), create:vi.fn() }));
vi.mock('@/infra/database/prisma',()=>({ default:{auditLogOutbox:{create:state.create}} }));
vi.mock('@/infra/factories/backup-factory',()=>({ backupUseCases:{
  export:{execute:state.export},downloadAuto:{execute:state.download},companyById:async()=>({slug:'empresa'}),
} }));
vi.mock('@/infra/auth/session',()=>({ withTenant:async(fn:(session:{company_id:string})=>unknown)=>runWithAuditActor(
  {id:'root',name:'Root',email:'root@example.test',company_id:'a'},()=>fn({company_id:'a'}),
) }));
import { exportBackupAction, downloadAutoBackupAction } from './backup';
const payload={meta:{company_slug:'empresa',counts:{users:1,repairs:1}},data:{users:[{password:'NEVER_LOG',email:'private@example.test'}],repairs:[{description:'Reforma'}]}};
beforeEach(()=>{vi.clearAllMocks();state.create.mockReset().mockResolvedValue({});state.export.mockResolvedValue(payload);state.download.mockReturnValue({name:'backup.json',content:JSON.stringify(payload)});});
it.each(['manual','automatic'])('records %s backup export without credentials or file contents',async kind=>{
  const result=kind==='manual'?await exportBackupAction():await downloadAutoBackupAction('backup.json');
  expect(result.ok).toBe(true);
  expect(state.create).toHaveBeenCalledWith({data:expect.objectContaining({user_id:'root',company_id:'a',table_name:'Backup',action:'EXPORT',new_values:expect.objectContaining({format:'JSON',record_count:2})})});
  expect(JSON.stringify(state.create.mock.calls)).not.toContain('NEVER_LOG');
  expect(JSON.stringify(state.create.mock.calls)).not.toContain('private@example.test');
});
