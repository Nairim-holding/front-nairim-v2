import type { IptuAuditRepository } from '@/core/repositories/iptu-audit-repository';
import type { IptuAuditParams, IptuAuditReport } from '@/core/entities/iptu-audit';

/**
 * Gera o relatório da Auditoria de IPTU. A checagem de pré-condição
 * ("categorias configuradas?") vive no repositório (junto da query real),
 * seguindo o mesmo porte 1:1 de `AuditService.getIptuAudit` — que já
 * combinava as duas coisas no mesmo método no backend original.
 *
 * O bug herdado do backend original (a query exigia `lease_id: { not: null }`,
 * deixando de fora todo IPTU pago sem locação vinculada — "só considera 1-2
 * imóveis") foi corrigido na Tarefa 4.1: o repositório agora liga o lançamento
 * ao imóvel também pelo centro (`center_id`/`debit_center_id`).
 *
 * Camada: core. Origem: api-nairim-v2/src/services/AuditService.ts.
 */
export class GetIptuAuditUseCase {
  constructor(private readonly repo: IptuAuditRepository) {}
  async execute(params: IptuAuditParams, companyId: string): Promise<IptuAuditReport> {
    return this.repo.getAudit(params, companyId);
  }
}
