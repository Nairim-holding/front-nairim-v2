'use server';
import { runAction } from '@/shared/actions/action-result';
import { getCreditCardDashboardData } from '@/server/queries/credit-card-dashboard';

export async function getCreditCardDashboardAction(input: Record<string, unknown>) {
  return runAction(() => getCreditCardDashboardData(input));
}
