'use client';

import { useState, useMemo, useCallback } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { useMessageContext } from '@/contexts/MessageContext';
import { useRouter } from 'next/navigation';
import DynamicForm from '@/components/form/DynamicForm';
import { buildPropertySteps, validateStep, type SelectOption } from '../_lib/propertySteps';
import { buildPropertyFormData } from '../_lib/propertyTransform';

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
        return { street: '', district: '', city: '', state: '', country: 'Brasil', latitude: '', longitude: '' };
      }

      if (cleanCEP.length === 8) {
        try {
          showMessage('Buscando CEP...', 'info');
          const res = await fetch(`/api/cep/${cleanCEP}`);

          if (!res.ok) {
            if (res.status === 404) {
              setIsManualAddress(true);
              showMessage('CEP não encontrado. Preencha manualmente.', 'error');
              return { street: '', district: '', city: '', state: '', latitude: '', longitude: '' };
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

    const res = await fetch(`${API_URL}/properties/create-unified`, { method: 'POST', body: fd });
    const text = await res.text();

    let result: any; // eslint-disable-line @typescript-eslint/no-explicit-any
    try { result = JSON.parse(text); } catch { throw new Error('Resposta inválida do servidor'); }

    if (!res.ok) {
      if (res.status === 400 && result.errors) {
        const msgs = Object.entries(result.errors)
          .map(([f, m]) => `${f}: ${Array.isArray(m) ? m.join(', ') : m}`)
          .join('; ');
        throw new Error(`Erros de validação: ${msgs}`);
      }
      throw new Error(result.message || `Erro ${res.status}`);
    }
    if (!result.success) throw new Error(result.message || 'Erro desconhecido ao criar imóvel');
    return result.data ?? result;
  }, [user?.id]);

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
    <DynamicForm
      resource="properties"
      title="Imóvel"
      basePath="/dashboard/imoveis"
      mode="create"
      steps={steps}
      onSubmit={handleSubmit}
      onSubmitSuccess={onSubmitSuccess}
      onFieldChange={handleFieldChange}
      completedSteps={completedSteps}
      onStepComplete={handleStepComplete}
      canNavigateToStep={canNavigateToStep}
    />
  );
}
