'use client';

import { useState, useMemo, useCallback } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { useMessageContext } from '@/contexts/MessageContext';
import { useRouter } from 'next/navigation';
import DynamicForm from '@/components/form/DynamicForm';
import { buildPropertySteps, validateStep, type SelectOption } from '../_lib/propertySteps';
import { buildPropertyFormData } from '../_lib/propertyTransform';
import { useUploadSSE } from '@/hooks/useUploadSSE';
import UploadProgressOverlay from '@/components/feedback/UploadProgress/UploadProgressOverlay';

const API_URL = process.env.NEXT_PUBLIC_URL_API;

interface Props {
  ownerOptions: SelectOption[];
  typeOptions: SelectOption[];
  agencyOptions: SelectOption[];
}

export default function PropertyCreateForm({ ownerOptions, typeOptions, agencyOptions }: Props) {
  const { user } = useAuth();
  const { showMessage } = useMessageContext();
  const router = useRouter();

  const [completedSteps, setCompletedSteps] = useState<number[]>([]);
  const [isManualAddress, setIsManualAddress] = useState(false);
  const { state: uploadState, uploadAndTrack } = useUploadSSE();

  const steps = useMemo(
    () => buildPropertySteps({ ownerOptions, typeOptions, agencyOptions, isManualAddress }),
    [ownerOptions, typeOptions, agencyOptions, isManualAddress],
  );

  const handleFieldChange = useCallback(
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    async (fieldName: string, value: any) => {
      if (fieldName !== 'zip_code' || !value) return null;

      const cleanCEP = value.replace(/\D/g, '');

      if (cleanCEP.length < 8) {
        return null; // Não limpa campos enquanto usuário está digitando
      }

      if (cleanCEP.length === 8) {
        try {
          showMessage('Buscando CEP...', 'info');
          const res = await fetch(`/api/cep/${cleanCEP}`);

          if (!res.ok) {
            if (res.status === 404) {
              setIsManualAddress(true);
              showMessage('CEP não encontrado. Preencha manualmente.', 'error');
              return null; // Não sobrescreve os campos, apenas libera para edição
            }
            throw new Error('Erro ao buscar CEP');
          }

          const data = await res.json();
          if (data.error || data.erro) throw new Error('CEP não encontrado.');

          setIsManualAddress(false);
          showMessage('Endereço preenchido automaticamente!', 'success');
          return {
            street: data.rua || data.logradouro || '',
            district: data.bairro || '',
            city: data.cidade || data.localidade || '',
            state: data.estado || data.uf || '',
            country: data.pais || 'Brasil',
            latitude: data.latitude || '',
            longitude: data.longitude || '',
          };
        } catch {
          showMessage('Erro ao buscar CEP. Preencha manualmente.', 'error');
          setIsManualAddress(true);
          return null;
        }
      }

      return null;
    },
    [showMessage],
  );

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const handleSubmit = useCallback(async (data: any) => {
    const fd = buildPropertyFormData(data, user?.id ?? '');

    // uploadAndTrack lida com 201 legado e 202+SSE de forma transparente.
    // Só resolve quando o backend confirma a conclusão (legado ou SSE `completed`).
    const result = await uploadAndTrack({
      url: `${API_URL}/properties/create-unified`,
      method: 'POST',
      body: fd,
    });
    return result;
  }, [user?.id, uploadAndTrack]);

  const onSubmitSuccess = useCallback(() => {
    showMessage('Imóvel criado com sucesso!', 'success');
    router.push('/dashboard/imoveis');
  }, [showMessage, router]);

  const handleStepComplete = useCallback((stepIndex: number) => {
    setCompletedSteps((prev) => prev.includes(stepIndex) ? prev : [...prev, stepIndex]);
  }, []);

  const canNavigateToStep = useCallback(
    (targetStep: number, currentStep: number, data: Record<string, unknown>) => {
      if (targetStep <= currentStep) return true;
      return validateStep(steps, currentStep, data);
    },
    [steps],
  );

  return (
    <>
      <DynamicForm
        resource="properties"
        title="Imóvel"
        basePath="/dashboard/imoveis"
        mode="create"
        draftKey="form:properties:create"
        steps={steps}
        onSubmit={handleSubmit}
        onSubmitSuccess={onSubmitSuccess}
        onFieldChange={handleFieldChange}
        completedSteps={completedSteps}
        onStepComplete={handleStepComplete}
        canNavigateToStep={canNavigateToStep}
      />
      <UploadProgressOverlay state={uploadState} label="Salvando imóvel..." />
    </>
  );
}
