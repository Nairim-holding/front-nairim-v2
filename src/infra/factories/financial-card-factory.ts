import { PrismaFinancialCardsRepository } from '@/infra/repositories/prisma-financial-cards-repository';
import {
  CreateCardUseCase,
  DeleteCardUseCase,
  GetCardByIdUseCase,
  GetCardFiltersUseCase,
  GetCardUsageSummaryUseCase,
  ListCardsUseCase,
  QuickCreateCardUseCase,
  RestoreCardUseCase,
  UpdateCardUseCase,
} from '@/core/use-cases/financial-card/crud';

/** Composition root do módulo Cartões Financeiros. Camada: infra. */
const cards = new PrismaFinancialCardsRepository();

export const financialCardUseCases = {
  list: new ListCardsUseCase(cards),
  getFilters: new GetCardFiltersUseCase(cards),
  getById: new GetCardByIdUseCase(cards),
  create: new CreateCardUseCase(cards),
  update: new UpdateCardUseCase(cards),
  remove: new DeleteCardUseCase(cards),
  restore: new RestoreCardUseCase(cards),
  quickCreate: new QuickCreateCardUseCase(cards),
  getUsageSummary: new GetCardUsageSummaryUseCase(cards),
};