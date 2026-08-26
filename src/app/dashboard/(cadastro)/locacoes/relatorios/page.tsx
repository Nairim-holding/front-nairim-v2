import type { Metadata } from 'next';
import { Suspense } from 'react';
import Section from '@/components/layout/PageSection';
import LeaseReportsPageContent from './content';

export const metadata: Metadata = { title: 'Relatório de Locações' };
export const revalidate = 0;

function LoadingFallback() {
  return (
    <Section title="Relatório de Locações">
      <div className="flex justify-center items-center h-64">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-brand" />
      </div>
    </Section>
  );
}

export default function LeaseReportsPage() {
  return (
    <Suspense fallback={<LoadingFallback />}>
      <LeaseReportsPageContent />
    </Suspense>
  );
}
