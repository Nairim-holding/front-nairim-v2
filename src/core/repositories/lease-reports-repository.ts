import type { LeaseReportParams, LeaseReportResult } from '@/core/entities/lease-report';

/**
 * Contrato de leitura do Relatório de Locações.
 *
 * Expõe uma única operação porque o relatório é uma agregação atômica: as
 * linhas por locação, o quadro de retenções e os DARF mensal/trimestral saem
 * todos da mesma varredura de lançamentos — quebrar em várias chamadas
 * repetiria a mesma query 4 vezes e abriria espaço para os quadros ficarem
 * inconsistentes entre si.
 *
 * Camada: core.
 */
export interface LeaseReportsRepository {
  getLeaseReport(params: LeaseReportParams): Promise<LeaseReportResult>;
}
