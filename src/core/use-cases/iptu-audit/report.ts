import type { IptuAuditRepository } from '@/core/repositories/iptu-audit-repository';
import type { IptuAuditParams, IptuAuditReport } from '@/core/entities/iptu-audit';

/**
 * Gera o relatório da Auditoria de IPTU. A checagem de pré-condição
 * ("categorias configuradas?") vive no repositório (junto da query real),
 * seguindo o mesmo porte 1:1 de `AuditService.getIptuAudit` — que já
 * combinava as duas coisas no mesmo método no backend original.
 *
 * ⚠️ Bug herdado deliberadamente (não corrigido nesta migração — ver
 * MIGRATION_STATUS.md Módulo 13): a query em `buildSideWhere` exige
 * `lease_id: { not: null }` em ambos os lados (receita e despesa). Como
 * `Transaction` não tem `property_id` próprio, lançamentos de IPTU pago sem
 * vínculo a uma locação nunca entram na auditoria — é a causa raiz do "só
 * considera 1-2 imóveis" relatado pelo cliente. Corrigir isso exige mudança
 * estrutural (schema ou fluxo de lançamento), fora do escopo de um port 1:1.
 *
 * Camada: core. Origem: api-nairim-v2/src/services/AuditService.ts.
 */
export class GetIptuAuditUseCase {
  constructor(private readonly repo: IptuAuditRepository) {}
  async execute(params: IptuAuditParams, companyId: string): Promise<IptuAuditReport> {
    return this.repo.getAudit(params, companyId);
  }
}
