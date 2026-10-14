import type { Metadata } from 'next';
import { Suspense } from 'react';
import Section from '@/components/layout/PageSection';
import RoiContent from './content';

export const metadata: Metadata = { title: 'ROI por Imóvel' };
export const revalidate = 0;

function LoadingFallback() {
  return (
    <Section title="ROI por Imóvel">
      <div className="flex justify-center items-center h-64">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-brand" />
      </div>
    </Section>
  );
}

export default function RoiPage() {
  return (
    <Suspense fallback={<LoadingFallback />}>
      <RoiContent />
    </Suspense>
  );
}
