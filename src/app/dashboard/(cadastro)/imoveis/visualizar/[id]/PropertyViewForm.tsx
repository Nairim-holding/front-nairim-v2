'use client';

import { useMemo, useCallback } from 'react';
import DynamicForm from '@/components/form/DynamicForm';
import { buildPropertySteps, type SelectOption } from '../../_lib/propertySteps';
import { transformPropertyData } from '../../_lib/propertyTransform';
import { getPropertyByIdAction } from '@/server/actions/property';
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

const COMPLETED_STEPS = [0, 1, 2, 3, 4];
const noop = async () => null;

export default function PropertyViewForm({ id, propertyData, ownerOptions, typeOptions, agencyOptions, centerOptions, creditCenterOptions, debitCenterOptions, categoryOptions, subcategoryOptions, subcategoriesRaw }: Props) {
  const activeLease = findOccupyingLease(propertyData?.leases);

  const steps = useMemo(
    () => buildPropertySteps({ ownerOptions, typeOptions, agencyOptions, centerOptions, creditCenterOptions, debitCenterOptions, categoryOptions, subcategoryOptions, subcategoriesRaw, readOnly: true, activeLease }),
    [ownerOptions, typeOptions, agencyOptions, centerOptions, creditCenterOptions, debitCenterOptions, categoryOptions, subcategoryOptions, subcategoriesRaw, activeLease],
  );

  const transformData = useCallback(
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (apiResponse: any) => transformPropertyData(apiResponse),
    [],
  );

  return (
    <DynamicForm
      resource="properties"
      title="Imóvel"
      basePath="/dashboard/imoveis"
      mode="view"
      id={id}
      steps={steps}
      fetchResource={getPropertyByIdAction}
      onSubmit={noop}
      onSubmitSuccess={noop}
      onFieldChange={noop}
      transformData={transformData}
      completedSteps={COMPLETED_STEPS}
      canNavigateToStep={() => true}
    />
  );
}
