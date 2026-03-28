'use client';

import { useState, useMemo, useCallback, useRef } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { useMessageContext } from '@/contexts/MessageContext';
import { useRouter } from 'next/navigation';
import DynamicForm from '@/components/form/DynamicForm';
import { buildPropertySteps, validateStep, type SelectOption } from '../../_lib/propertySteps';
import { buildPropertyFormData, transformPropertyData } from '../../_lib/propertyTransform';

const API_URL = process.env.NEXT_PUBLIC_URL_API;

interface Props {
  id: string;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  propertyData: any;
  ownerOptions: SelectOption[];
  typeOptions: SelectOption[];
  agencyOptions: SelectOption[];
}

export default function PropertyEditForm({ id, propertyData, ownerOptions, typeOptions, agencyOptions }: Props) {
  const { user } = useAuth();
  const { showMessage } = useMessageContext();
  const router = useRouter();

  const lastFetchedCep = useRef('');
  const [isManualAddress, setIsManualAddress] = useState(false);
  const [completedSteps] = useState<number[]>([0, 1, 2, 3, 4]);

  const activeLease = propertyData?.leases?.find((l: any) => l.status !== 'CANCELED'); // eslint-disable-line @typescript-eslint/no-explicit-any

  const steps = useMemo(
    () => buildPropertySteps({ ownerOptions, typeOptions, agencyOptions, isManualAddress, activeLease }),
    [ownerOptions, typeOptions, agencyOptions, isManualAddress, activeLease],
  );

  const transformData = useCallback(
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (apiResponse: any) => {
      const transformed = transformPropertyData(apiResponse);
      const zipCode = (transformed.zip_code as string)?.replace(/\D/g, '');
      if (zipCode) lastFetchedCep.current = zipCode;
      return transformed;
    },
    [],
  );

  const handleFieldChange = useCallback(
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    async (fieldName: string, value: any) => {
      if (fieldName !== 'zip_code' || !value) return null;

      const cleanCEP = value.replace(/\D/g, '');

      if (cleanCEP.length < 8) {
        lastFetchedCep.current = '';
        return { street: '', district: '', city: '', state: '', country: 'Brasil' };
      }

      if (cleanCEP.length === 8) {
        if (cleanCEP === lastFetchedCep.current) return null;
        lastFetchedCep.current = cleanCEP;

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
    const fd = buildPropertyFormData(data, user?.id ?? '', propertyData?.documents ?? []);

    const res = await fetch(`${API_URL}/properties/update-unified/${id}`, { method: 'PUT', body: fd });
    const text = await res.text();

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    let result: any;
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
    if (!result.success) throw new Error(result.message || 'Erro desconhecido ao atualizar imóvel');
    return result.data ?? result;
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
    <DynamicForm
      resource="properties"
      title="Imóvel"
      basePath="/dashboard/imoveis"
      mode="edit"
      id={id}
      steps={steps}
      onSubmit={handleSubmit}
      onSubmitSuccess={onSubmitSuccess}
      onFieldChange={handleFieldChange}
      transformData={transformData}
      completedSteps={completedSteps}
      canNavigateToStep={canNavigateToStep}
    />
  );
}
