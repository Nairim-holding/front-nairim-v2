import type { Metadata } from 'next';
import { Suspense } from 'react';
import Section from '@/components/layout/PageSection';
import InvestmentsPageContent from './content';

export const metadata: Metadata = { title: 'Meus Investimentos' };
export const revalidate = 0;

function LoadingFallback() {
  return (
    <Section title="Meus Investimentos">
      <div className="flex justify-center items-center h-64">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-brand" />
      </div>
    </Section>
  );
}

export default function InvestimentosPage() {
  return (
    <Suspense fallback={<LoadingFallback />}>
      <InvestmentsPageContent />
    </Suspense>
  );
}
