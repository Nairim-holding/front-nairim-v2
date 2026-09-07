import type { Metadata } from 'next';
import Section from '@/components/layout/PageSection';
import OverdueLeasesPage from '@/components/domain/lease-overdue/OverdueLeasesPage';
import { listOverdueLeasesData, type LeaseOverdueSummary } from '@/server/queries/lease-overdue';

export const metadata: Metadata = { title: 'Alertas de locações' };

const EMPTY_SUMMARY: LeaseOverdueSummary = { items: [], total: 0, critical: 0, amount: 0 };

export default async function LeaseOverduePage() {
  let initialSummary = EMPTY_SUMMARY;
  try {
    initialSummary = await listOverdueLeasesData();
  } catch (error) {
    console.error('[LeaseOverduePage] Erro ao carregar alertas:', error);
  }

  return (
    <Section title="Alertas de locações">
      <OverdueLeasesPage initialSummary={initialSummary} />
    </Section>
  );
}
