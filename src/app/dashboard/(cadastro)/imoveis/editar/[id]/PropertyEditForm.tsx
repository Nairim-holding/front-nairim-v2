'use client';

import { useState, useMemo, useCallback } from 'react';
import { usePropertyAddressLookup } from '@/hooks/usePropertyAddressLookup';
import { useAuth } from '@/contexts/AuthContext';
import { useMessageContext } from '@/contexts/MessageContext';
import { useRouter } from 'next/navigation';
import DynamicForm from '@/components/form/DynamicForm';
import { buildPropertySteps, validateStep, type SelectOption } from '../../_lib/propertySteps';
import { buildPropertyFormData, transformPropertyData } from '../../_lib/propertyTransform';
import { updateUnifiedPropertyAction, getPropertyByIdAction } from '@/server/actions/property';
import { findOccupyingLease } from '@/shared/utils/property-occupancy';


interface Props {
  id: string;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  propertyData: any;
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

export default function PropertyEditForm({ id, propertyData, ownerOptions, typeOptions, agencyOptions, centerOptions, creditCenterOptions, debitCenterOptions, categoryOptions, subcategoryOptions, subcategoriesRaw }: Props) {
  const { user } = useAuth();
  const { showMessage } = useMessageContext();
  const router = useRouter();

  const { handleFieldChange } = usePropertyAddressLookup(showMessage);
  const [completedSteps] = useState<number[]>([0, 1, 2, 3, 4]);

  const activeLease = findOccupyingLease(propertyData?.leases);

  const steps = useMemo(
    () => buildPropertySteps({ ownerOptions, typeOptions, agencyOptions, centerOptions, creditCenterOptions, debitCenterOptions, categoryOptions, subcategoryOptions, subcategoriesRaw, activeLease }),
    [ownerOptions, typeOptions, agencyOptions, centerOptions, creditCenterOptions, debitCenterOptions, categoryOptions, subcategoryOptions, subcategoriesRaw, activeLease],
  );

  const transformData = useCallback(
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (apiResponse: any) => {
      const transformed = transformPropertyData(apiResponse);
      return transformed;
    },
    [],
  );

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const handleSubmit = useCallback(async (data: any) => {
    const fd = buildPropertyFormData(data, user?.id ?? '', propertyData?.documents ?? []);

    const result = await updateUnifiedPropertyAction(id, fd);
    if (!result.ok) {
      if (result.status === 400 && result.errors) {
        throw new Error(`Erro de validação: ${result.errors.join(', ')}`);
      }
      throw new Error(result.error ?? `Erro ${result.status}`);
    }
    return result;
  }, [id, user?.id, propertyData?.documents]);

  const onSubmitSuccess = useCallback(() => {
    showMessage('Imóvel atualizado com sucesso!', 'success');
    router.push('/dashboard/imoveis');
  }, [showMessage, router]);

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
        title={`Imóvel – ${propertyData?.title || ''}`}
        basePath="/dashboard/imoveis"
        mode="edit"
        id={id}
        steps={steps}
        fetchResource={getPropertyByIdAction}
        onSubmit={handleSubmit}
        onSubmitSuccess={onSubmitSuccess}
        onFieldChange={handleFieldChange}
        transformData={transformData}
        completedSteps={completedSteps}
        canNavigateToStep={canNavigateToStep}
      />
    </>
  );
}
