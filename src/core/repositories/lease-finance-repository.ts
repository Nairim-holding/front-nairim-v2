import type { SyncLeaseTransactionsResult } from '@/core/entities/lease';

/**
 * Contrato de acesso a dados necessário para a geração automática dos
 * lançamentos financeiros de uma locação (aluguel, comissão, IPTU).
 *
 * Isolado do módulo Financeiro completo (Módulo 9, ainda não migrado) —
 * expõe apenas o que `syncLeaseTransactions` precisa: ler a locação com as
 * relações de imóvel/agência/inquilino, resolver/criar o fornecedor-espelho da
 * imobiliária, listar/soft-deletar/criar transações do schedule.
 *
 * Implementação Prisma: infra/repositories/prisma-lease-finance-repository.ts.
 *
 * Camada: core.
 * Origem: api-nairim-v2/src/services/LeaseFinanceService.ts.
 */
export interface LeaseFinanceRepository {
  /**
   * Sincroniza os lançamentos financeiros da locação (idempotente): remove os
   * PENDING do schedule anterior, preserva os COMPLETED, cria os novos.
   * Implementa a regra completa (não apenas leitura) porque a lógica de
   * schedule/idempotência não faz sentido fora de uma única operação atômica
   * por locação.
   */
  syncLeaseTransactions(leaseId: string, companyId: string): Promise<SyncLeaseTransactionsResult>;
}
