'use client';

import { useState, useMemo, useCallback, useRef } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { useMessageContext } from '@/contexts/MessageContext';
import { useRouter } from 'next/navigation';
import DynamicForm from '@/components/form/DynamicForm';
import { buildPropertySteps, validateStep, type SelectOption } from '../_lib/propertySteps';
import { buildPropertyFormData } from '../_lib/propertyTransform';
import { createUnifiedPropertyAction } from '@/server/actions/property';

// Tempo parado digitando o número antes de refinar o alfinete no mapa — evita
// martelar o Nominatim (e a rota /api/cep) a cada tecla.
const NUMBER_GEOCODE_DEBOUNCE_MS = 800;

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
  const [isManualAddress, setIsManualAddress] = useState(false);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const latestValuesRef = useRef<Record<string, any>>({});
  const numberGeocodeTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const steps = useMemo(
    () => buildPropertySteps({ ownerOptions, typeOptions, agencyOptions, centerOptions, creditCenterOptions, debitCenterOptions, categoryOptions, subcategoryOptions, subcategoriesRaw, isManualAddress }),
    [ownerOptions, typeOptions, agencyOptions, centerOptions, creditCenterOptions, debitCenterOptions, categoryOptions, subcategoryOptions, subcategoriesRaw, isManualAddress],
  );

  // Refina o alfinete assim que o número do imóvel é digitado: a busca de CEP
  // acontece antes do número existir e por isso só geocodifica a rua inteira
  // (Nominatim então cai num ponto genérico da via, não no lote certo).
  const geocodeWithNumber = useCallback(
    (numero: string): Promise<{ latitude: string; longitude: string } | null> => {
      const zip = String(latestValuesRef.current.zip_code ?? '').replace(/\D/g, '');
      const street = latestValuesRef.current.street;

      if (zip.length !== 8 || !street || !numero) return Promise.resolve(null);

      return new Promise((resolve) => {
        if (numberGeocodeTimer.current) clearTimeout(numberGeocodeTimer.current);
        numberGeocodeTimer.current = setTimeout(async () => {
          try {
            const res = await fetch(`/api/cep/${zip}?numero=${encodeURIComponent(numero)}`);
            if (!res.ok) return resolve(null);
            const data = await res.json();
            if (data.error || data.erro || data.latitude === undefined) return resolve(null);
            resolve({ latitude: data.latitude ?? '', longitude: data.longitude ?? '' });
          } catch {
            resolve(null);
          }
        }, NUMBER_GEOCODE_DEBOUNCE_MS);
      });
    },
    [],
  );

  const handleFieldChange = useCallback(
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    async (fieldName: string, value: any) => {
      if (fieldName === 'category_id') return { subcategory_id: '' };

      if (fieldName === 'number') return geocodeWithNumber(value);

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
    [showMessage, geocodeWithNumber],
  );

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const handleFormValuesChange = useCallback((values: Record<string, any>) => {
    latestValuesRef.current = values;
  }, []);

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
        onFormValuesChange={handleFormValuesChange}
        completedSteps={completedSteps}
        onStepComplete={handleStepComplete}
        canNavigateToStep={canNavigateToStep}
      />
    </>
  );
}
