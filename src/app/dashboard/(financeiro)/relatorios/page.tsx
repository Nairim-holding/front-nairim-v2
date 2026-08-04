import type { Metadata } from 'next';
import { Suspense } from 'react';
import Section from '@/components/layout/PageSection';
import RelatoriosPageContent from './content';

export const metadata: Metadata = { title: 'Relatórios' };
export const revalidate = 0;

function LoadingFallback() {
  return (
    <Section title="Relatórios">
      <div className="flex justify-center items-center h-64">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-brand" />
      </div>
    </Section>
  );
}

export default function RelatoriosPage() {
  return (
    <Suspense fallback={<LoadingFallback />}>
      <RelatoriosPageContent />
    </Suspense>
  );
}
