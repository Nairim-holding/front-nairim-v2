import type { Metadata } from 'next';
import { Suspense } from 'react';
import Section from '@/components/layout/PageSection';
import AuditoriaIptuContent from './content';

export const metadata: Metadata = { title: 'Auditoria de IPTU' };
export const revalidate = 0;

function LoadingFallback() {
  return (
    <Section title="Auditoria de IPTU">
      <div className="flex justify-center items-center h-64">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-brand" />
      </div>
    </Section>
  );
}

export default function AuditoriaIptuPage() {
  return (
    <Suspense fallback={<LoadingFallback />}>
      <AuditoriaIptuContent />
    </Suspense>
  );
}
