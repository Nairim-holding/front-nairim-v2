'use client';

import { useState, useMemo, useCallback } from 'react';
import { usePropertyAddressLookup } from '@/hooks/usePropertyAddressLookup';
import { useAuth } from '@/contexts/AuthContext';
import { useMessageContext } from '@/contexts/MessageContext';
import { useRouter } from 'next/navigation';
import DynamicForm from '@/components/form/DynamicForm';
import { buildPropertySteps, validateStep, type SelectOption } from '../_lib/propertySteps';
import { buildPropertyFormData } from '../_lib/propertyTransform';
import { createUnifiedPropertyAction } from '@/server/actions/property';


interface Props {
  ownerOptions: SelectOption[];
  typeOptions: SelectOption[];
  agencyOptions: SelectOption[];
  centerOptions: SelectOption[];
  creditCenterOptions: SelectOption[];
  debitCenterOptions: SelectOption[];
  categoryOptions: SelectOption[];
  subcategoryOptions: SelectOption[];
  subcategoriesRaw: { id: string; name: string; category_id: string }[];
}

export default function PropertyCreateForm({ ownerOptions, typeOptions, agencyOptions, centerOptions, creditCenterOptions, debitCenterOptions, categoryOptions, subcategoryOptions, subcategoriesRaw }: Props) {
  const { user } = useAuth();
  const { showMessage } = useMessageContext();
  const router = useRouter();

  const [completedSteps, setCompletedSteps] = useState<number[]>([]);
  const { handleFieldChange } = usePropertyAddressLookup(showMessage);

  const steps = useMemo(
    () => buildPropertySteps({ ownerOptions, typeOptions, agencyOptions, centerOptions, creditCenterOptions, debitCenterOptions, categoryOptions, subcategoryOptions, subcategoriesRaw }),
    [ownerOptions, typeOptions, agencyOptions, centerOptions, creditCenterOptions, debitCenterOptions, categoryOptions, subcategoryOptions, subcategoriesRaw],
  );

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const handleSubmit = useCallback(async (data: any) => {
    const fd = buildPropertyFormData(data, user?.id ?? '');
    const result = await createUnifiedPropertyAction(fd);
    if (!result.ok) {
      if (result.status === 400 && result.errors) {
        throw new Error(`Erro de validação: ${result.errors.join(', ')}`);
      }
      throw new Error(result.error ?? `Erro ${result.status}`);
    }
    return result;
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
    </>
  );
}
