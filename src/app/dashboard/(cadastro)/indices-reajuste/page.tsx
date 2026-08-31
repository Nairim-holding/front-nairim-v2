import type { Metadata } from 'next';
import { Suspense } from 'react';
import Section from '@/components/layout/PageSection';
import AdjustmentIndexesContent from './content';

export const metadata: Metadata = { title: 'Índices de Reajuste' };
export const revalidate = 0;

function LoadingFallback() {
  return (
    <Section title="Índices de Reajuste">
      <div className="flex justify-center items-center h-64">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-brand" />
      </div>
    </Section>
  );
}

export default function IndicesReajustePage() {
  return (
    <Suspense fallback={<LoadingFallback />}>
      <AdjustmentIndexesContent />
    </Suspense>
  );
}
