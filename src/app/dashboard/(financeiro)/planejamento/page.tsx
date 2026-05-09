import { Suspense } from 'react';
import Section from '@/components/layout/PageSection';
import PlanningPageContent from './content';

export const revalidate = 0;

function LoadingFallback() {
  return (
    <Section title="Planejamento e Controle">
      <div className="flex justify-center items-center h-64">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-brand" />
      </div>
    </Section>
  );
}

export default function PlanejamentoPage() {
  return (
    <Suspense fallback={<LoadingFallback />}>
      <PlanningPageContent />
    </Suspense>
  );
}
