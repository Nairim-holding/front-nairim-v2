import type { IptuAuditRepository } from '@/core/repositories/iptu-audit-repository';
import type { IptuAuditSettings, IptuAuditSettingsInput } from '@/core/entities/iptu-audit';

/**
 * Casos de uso de configuração da Auditoria de IPTU.
 * Camada: core. Origem: api-nairim-v2/src/controllers/AuditController.ts.
 */

export class GetIptuAuditSettingsUseCase {
  constructor(private readonly repo: IptuAuditRepository) {}
  /** `null` = ainda não configurado — não é erro, é o primeiro uso. */
  async execute(companyId: string): Promise<IptuAuditSettings | null> {
    return this.repo.getSettings(companyId);
  }
}

export class SaveIptuAuditSettingsUseCase {
  constructor(private readonly repo: IptuAuditRepository) {}
  async execute(companyId: string, input: IptuAuditSettingsInput): Promise<IptuAuditSettings> {
    return this.repo.saveSettings(companyId, input);
  }
}
