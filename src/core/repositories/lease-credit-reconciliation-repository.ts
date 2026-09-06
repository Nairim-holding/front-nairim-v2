import type {
  CompleteCreditReconciliationInput,
  CompleteCreditReconciliationResult,
  CreditCandidate,
  CreditReconciliationSearchInput,
} from '@/core/entities/credit-reconciliation';

export interface LeaseCreditReconciliationRepository {
  search(companyId: string, input: CreditReconciliationSearchInput): Promise<CreditCandidate[]>;
  complete(companyId: string, input: CompleteCreditReconciliationInput): Promise<CompleteCreditReconciliationResult>;
}
