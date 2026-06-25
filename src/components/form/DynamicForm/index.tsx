/* eslint-disable @typescript-eslint/no-explicit-any */
'use client';

import { useState, useEffect, useCallback, useRef, useMemo } from 'react';
import { useRouter } from 'next/navigation';
import Section from '@/components/layout/PageSection';
import Form from '@/components/ui/Form';
import Input from '@/components/ui/Input';
import Select from '@/components/ui/Select';
import TextArea from '@/components/ui/TextArea';
import InputFile from '@/components/ui/InputFile';
import Toggle from '@/components/ui/Toggle';
import { useMessageContext } from '@/contexts/MessageContext';
import { FormFieldDef, FormStep } from '@/types/types';
import NavigationButtons from '../FormNavigation';
import ProgressBar from '../StepProgressBar';

interface DynamicFormManagerProps {
  resource: string;
  title: string;
  basePath: string;
  mode: 'create' | 'edit' | 'view';
  id?: string;
  steps?: FormStep[];
  fields?: FormFieldDef[];
  onSubmitSuccess?: (data: any) => void;
  onCancel?: () => void;
  transformData?: (data: any) => any;
  transformResponse?: (data: any) => any;
  onSubmit?: (data: any) => Promise<any>;
  onFieldChange?: (fieldName: string, value: any) => Promise<any>;
  onFormValuesChange?: (values: any) => void;
  completedSteps?: number[];
  onStepComplete?: (stepIndex: number, values: Record<string, any>) => void | Record<string, any>;
  canNavigateToStep?: (targetStep: number, currentStep: number, data: any) => boolean;
  /**
   * Quando informado, persiste `formValues` + `currentStep` em sessionStorage
   * sob essa chave. Restaura no mount e limpa em onSubmitSuccess. Útil em
   * wizards de cadastro para evitar perda de dados ao navegar entre etapas.
   */
  draftKey?: string;
  /** Desabilita o banner de "alterações não salvas" no modo edit. Default: true. */
  enableDirtyDetection?: boolean;
  /** Step inicial a abrir (útil para abrir em Branding após criar nova empresa) */
  defaultStep?: number;
}

const DRAFT_STORAGE_PREFIX = `nairim`;

const readDraft = (key: string): { values: Record<string, any>; step: number } | null => {
  if (typeof window === 'undefined') return null;
  try {
    const raw = window.sessionStorage.getItem(`${DRAFT_STORAGE_PREFIX}${key}`);
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    if (!parsed || typeof parsed !== 'object') return null;
    return {
      values: parsed.values && typeof parsed.values === 'object' ? parsed.values : {},
      step: typeof parsed.step === 'number' ? parsed.step : 0,
    };
  } catch {
    return null;
  }
};

const writeDraft = (key: string, values: Record<string, any>, step: number) => {
  if (typeof window === 'undefined') return;
  try {
    window.sessionStorage.setItem(
      `${DRAFT_STORAGE_PREFIX}${key}`,
      JSON.stringify({ values, step }),
    );
  } catch {
    /* storage cheio / bloqueado — falha silenciosa */
  }
};

const clearDraft = (key: string) => {
  if (typeof window === 'undefined') return;
  try {
    window.sessionStorage.removeItem(`${DRAFT_STORAGE_PREFIX}${key}`);
  } catch {
    /* ignore */
  }
};

// Comparação estável que ignora chaves com valor "vazio equivalente" para evitar
// falso positivo de dirty quando o form preenche '' por default e o backend devolve null.
const isEmptyish = (v: any): boolean =>
  v === undefined || v === null || v === '' || (Array.isArray(v) && v.length === 0);

const stableStringify = (obj: Record<string, any>): string => {
  const keys = Object.keys(obj).filter(k => !isEmptyish(obj[k])).sort();
  return JSON.stringify(keys.map(k => [k, obj[k]]));
};

export default function DynamicFormManager({
  resource,
  title,
  basePath,
  mode,
  id,
  steps,
  fields,
  onSubmitSuccess,
  onCancel,
  transformData,
  transformResponse,
  onSubmit,
  onFieldChange,
  onFormValuesChange,
  completedSteps: externalCompletedSteps,
  onStepComplete,
  canNavigateToStep: externalCanNavigateToStep,
  draftKey,
  enableDirtyDetection = true,
  defaultStep = 0,
}: DynamicFormManagerProps) {
  const router = useRouter();
  const { showMessage } = useMessageContext();
  const formRef = useRef<HTMLFormElement>(null);
  const prevDefaultValues = useRef<Record<string, any>>({});

  const [loading, setLoading] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [currentStep, setCurrentStep] = useState(defaultStep);
  const [formValues, setFormValues] = useState<Record<string, any>>({});
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [internalCompletedSteps, setInternalCompletedSteps] = useState<number[]>([]);

  // Snapshot dos valores "limpos" (defaults para create, dados carregados para edit).
  // Usado para detecção de dirty state. null = ainda não inicializado (não comparar).
  const [initialSnapshot, setInitialSnapshot] = useState<Record<string, any> | null>(null);

  // Flag que vira true após o restore inicial do draft. Antes disso, a persistência
  // não escreve (para evitar sobrescrever rascunho com {} no primeiro render).
  const [draftHydrated, setDraftHydrated] = useState(false);
  
  const isViewMode = mode === 'view';
  const completedSteps = externalCompletedSteps || internalCompletedSteps;

  const getCurrentFields = (): FormFieldDef[] => {
    if (steps && steps.length > 0) {
      const currentStepData = steps[currentStep];
      return currentStepData?.fields || [];
    }
    return fields || [];
  };

  const currentFields = getCurrentFields();
  const hasSteps = !!steps && steps.length > 1;
  const isLastStep = hasSteps ? currentStep === steps.length - 1 : true;

  useEffect(() => {
    const timer = setTimeout(() => {
      if (formRef.current) {
        const focusableElements = formRef.current.querySelectorAll(
          'input:not([type="hidden"]), select, textarea, [tabindex]:not([tabindex="-1"])'
        );
        
        const firstElement = Array.from(focusableElements).find(
          (el) => !el.hasAttribute('disabled')
        ) as HTMLElement;

        if (firstElement) {
          firstElement.focus();
          
          if (firstElement instanceof HTMLInputElement && (firstElement.type === 'text' || firstElement.type === 'password' || firstElement.type === 'tel')) {
            try {
              const valueLength = firstElement.value.length;
              if (valueLength > 0) {
                firstElement.setSelectionRange(valueLength, valueLength);
              }
            } catch (e) {
            }
          }
        }
      }
    }, 100);

    return () => clearTimeout(timer);
  }, [currentStep, loading]);

  const validateStep = useCallback((stepIndex: number, data: any): boolean => {
    if (!steps) return true;
    
    const stepFields = steps[stepIndex]?.fields || [];
    
    for (const field of stepFields) {
      if (field.required && !isViewMode) {
        let isHidden = false;
        if (typeof field.hidden === 'function') {
          isHidden = field.hidden(data);
        } else if (field.hidden === true) {
          isHidden = true;
        }
        
        if (!isHidden) {
          const value = data[field.field];
          if (value === undefined || value === null || value === '' || 
              (Array.isArray(value) && value.length === 0)) {
            return false;
          }
        }
      }
    }
    
    return true;
  }, [steps, isViewMode]);

  const canNavigateToStep = (targetStep: number): boolean => {
    if (externalCanNavigateToStep) {
      return externalCanNavigateToStep(targetStep, currentStep, formValues);
    }

    if (targetStep < currentStep) return true;
    
    if (targetStep > currentStep) {
      const isCurrentStepValid = validateStep(currentStep, formValues);
      if (!isCurrentStepValid && !isViewMode) {
        showMessage('Preencha todos os campos obrigatórios antes de avançar', 'error');
        return false;
      }
      
      if (!externalCompletedSteps && !internalCompletedSteps.includes(currentStep)) {
        setInternalCompletedSteps(prev => [...prev, currentStep]);
      }
    }
    
    return true;
  };

  const handleStepClick = (targetStep: number) => {
    if (targetStep === currentStep) return;
    
    if (canNavigateToStep(targetStep)) {
      setCurrentStep(targetStep);
    }
  };

  useEffect(() => {
    if (!hasSteps || isViewMode || externalCompletedSteps) return;

    const isCurrentStepComplete = validateStep(currentStep, formValues);

    if (isCurrentStepComplete && !internalCompletedSteps.includes(currentStep)) {
      setInternalCompletedSteps(prev => [...prev, currentStep]);
    }
  }, [formValues, currentStep, internalCompletedSteps, hasSteps, validateStep, isViewMode, externalCompletedSteps]);

  // Hydrate ÚNICO no mount: lê o rascunho salvo e mescla nos formValues atuais.
  // Roda só uma vez (deps vazios) e usa updater funcional para não depender de
  // closures que possam estar desatualizadas com mudanças de `steps`.
  useEffect(() => {
    if (draftKey && mode === 'create') {
      const draft = readDraft(draftKey);
      if (draft) {
        setFormValues(prev => ({ ...prev, ...draft.values }));
        setCurrentStep(draft.step ?? 0);
      }
    }
    setDraftHydrated(true);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Persistência SÍNCRONA pós-hydrate. Sem debounce — a escrita em sessionStorage
  // é barata e elimina perda em reload rápido. Cobre tanto digitação quanto
  // mudança de step (Próximo / Voltar).
  useEffect(() => {
    if (!draftHydrated || !draftKey || mode !== 'create' || submitting) return;
    writeDraft(draftKey, formValues, currentStep);
  }, [draftHydrated, draftKey, mode, formValues, currentStep]);

  // Safety-net: força a gravação imediatamente antes do unload da aba/recarregar.
  useEffect(() => {
    if (!draftKey || mode !== 'create') return;
    const flush = () => writeDraft(draftKey, formValues, currentStep);
    window.addEventListener('beforeunload', flush);
    window.addEventListener('pagehide', flush);
    return () => {
      window.removeEventListener('beforeunload', flush);
      window.removeEventListener('pagehide', flush);
    };
  }, [draftKey, mode, formValues, currentStep]);

  // Detecção de dirty state: só ativa quando o snapshot foi capturado.
  const isDirty = useMemo(() => {
    if (!enableDirtyDetection || !initialSnapshot || isViewMode) return false;
    return stableStringify(formValues) !== stableStringify(initialSnapshot);
  }, [enableDirtyDetection, initialSnapshot, formValues, isViewMode]);

  // Inicialização IDEMPOTENTE: para cada campo definido em steps/fields, garante
  // que existe um valor (default) sem nunca sobrescrever o que já está em formValues.
  // Isso é crucial porque `steps` em vários wizards muda de referência ao longo
  // do tempo (CEP, isManualAddress, generatedInternalCode), e a versão antiga
  // resetava o formulário a cada mudança.
  useEffect(() => {
    setFormValues(prev => {
      const allFields = steps ? steps.flatMap(step => step.fields || []) : fields || [];
      let mutated = false;
      const next: Record<string, any> = { ...prev };

      allFields.forEach(field => {
        const currentValue = next[field.field];
        const hasValue = currentValue !== undefined && currentValue !== null && currentValue !== '';
        
        const prevDV = prevDefaultValues.current[field.field];
        const newDV = field.defaultValue;

        if (hasValue) {
          // Se for código interno e o valor padrão recebido for diferente do anterior (novo fetch), nós forçamos a atualização
          if (field.field === 'internal_code' && newDV !== undefined && newDV !== prevDV) {
            next[field.field] = newDV;
            mutated = true;
          }
        } else {
          let defaultValue: any;
          if (newDV !== undefined) {
            defaultValue = newDV;
          } else {
            switch (field.type) {
              case 'checkbox':
              case 'boolean':
                defaultValue = false;
                break;
              case 'number':
                defaultValue = 0;
                break;
              case 'file':
              case 'custom':
                defaultValue = [];
                break;
              default:
                defaultValue = '';
            }
          }
          
          if (!hasValue) {
            next[field.field] = defaultValue;
            mutated = true;
          }
        }

        prevDefaultValues.current[field.field] = newDV;
      });

      return mutated ? next : prev;
    });

    // Em create, snapshot é capturado uma vez (após primeira inicialização)
    // para detecção de dirty state.
    if (mode === 'create') {
      setInitialSnapshot(snap => snap ?? {});
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [steps, fields]);

  useEffect(() => {
    if (mode !== 'create' && id) {
      const fetchData = async () => {
        try {
          setLoading(true);
          const response = await fetch(`${process.env.NEXT_PUBLIC_URL_API}/${resource}/${id}`);
          
          if (!response.ok) {
            throw new Error('Erro ao buscar dados');
          }

          const data = await response.json();
          const apiData = data.data || data;
          const formData = transformData ? transformData(apiData) : apiData;
          const updatedValues: Record<string, any> = {};
          
          const allFields = steps ? steps.flatMap(step => step.fields || []) : fields || [];
          
          allFields.forEach(field => {
            const value = formData[field.field];
            if (value !== undefined && value !== null) {
              updatedValues[field.field] = value;
            }
          });
          
          setFormValues((prev: Record<string, any>) => {
            const merged = { ...prev, ...updatedValues };
            // Snapshot dos valores carregados para detecção de dirty state.
            setInitialSnapshot(merged);
            return merged;
          });

          if (steps && !externalCompletedSteps) {
            const allStepsCompleted = steps.map((_, index) => index);
            setInternalCompletedSteps(allStepsCompleted);
          }

        } catch (error) {
          showMessage(`Erro ao carregar ${title.toLowerCase()}.`, 'error');
          router.push(basePath);
        } finally {
          setLoading(false);
        }
      };

      fetchData();
    }
  }, [mode, id, resource, router, showMessage, title, basePath, transformData, steps, fields, externalCompletedSteps]);

  const validateField = (field: FormFieldDef, value: any): string | null => {
    if (isViewMode) return null;
    
    let isHidden = false;
    if (typeof field.hidden === 'function') {
      isHidden = field.hidden(formValues);
    } else if (field.hidden === true) {
      isHidden = true;
    }
    
    if (isHidden || field.disabled) return null;
    
    if (field.required && (value === '' || value === null || value === undefined || 
        (Array.isArray(value) && value.length === 0))) {
      return `${field.label} é obrigatório`;
    }

    if (value && value.toString().trim() !== '' && !Array.isArray(value) && typeof value !== 'boolean') {
      const stringValue = value.toString();

      if (field.type === 'date') {
        if (stringValue.length < 10 && !stringValue.includes('-')) {
          return 'Data incompleta';
        }
        
        const dateRegex = /^\d{4}-\d{2}-\d{2}$/;
        if (dateRegex.test(stringValue)) {
          const [y, m, d] = stringValue.split('-').map(Number);
          const date = new Date(y, m - 1, d);
          
          if (date.getFullYear() !== y || date.getMonth() !== m - 1 || date.getDate() !== d) {
            return 'Data inválida';
          }
          if (y < 1900 || y > 2100) {
            return 'Ano inválido';
          }
        }
      }
      
      if (field.validation?.pattern && !field.validation.pattern.test(stringValue)) {
        return field.validation.patternMessage || 'Formato inválido';
      }

      if (field.validation?.minLength && stringValue.length < field.validation.minLength) {
        return `Mínimo ${field.validation.minLength} caracteres`;
      }

      if (field.validation?.maxLength && stringValue.length > field.validation.maxLength) {
        return `Máximo ${field.validation.maxLength} caracteres`;
      }

      if (field.validation?.custom) {
        const customError = field.validation.custom(value, formValues);
        if (customError) return customError;
      }

      if (field.type === 'email') {
        const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
        if (!emailRegex.test(stringValue)) return 'Email inválido';
      }

      if (field.field === 'password_confirm' && value !== formValues['password']) {
        return 'As senhas não coincidem';
      }
    }

    return null;
  };

  const validateCurrentStep = (): boolean => {
    if (isViewMode) return true;
    
    const newErrors: Record<string, string> = {};
    
    currentFields.forEach(field => {
      let isHidden = false;
      if (typeof field.hidden === 'function') {
        isHidden = field.hidden(formValues);
      } else if (field.hidden === true) {
        isHidden = true;
      }
      
      if (isHidden) return;
      
      const error = validateField(field, formValues[field.field]);
      if (error) {
        newErrors[field.field] = error;
      }
    });
    
    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const validateAllSteps = (): boolean => {
    if (isViewMode) return true;
    
    const allFields = steps ? steps.flatMap(step => step.fields || []) : fields || [];
    const newErrors: Record<string, string> = {};
    
    allFields.forEach(field => {
      let isHidden = false;
      if (typeof field.hidden === 'function') {
        isHidden = field.hidden(formValues);
      } else if (field.hidden === true) {
        isHidden = true;
      }
      
      if (isHidden) return;
      
      const error = validateField(field, formValues[field.field]);
      if (error) {
        if (field.field === 'password' || field.field === 'password_confirm') {
          newErrors[field.field] = error;
        } else {
          newErrors[field.field] = error;
        }
      }
    });
    
    setErrors(prev => {
      const filteredPrev = Object.keys(prev)
        .filter(key => key !== 'password' && key !== 'password_confirm')
        .reduce((obj, key) => {
          obj[key] = prev[key];
          return obj;
        }, {} as Record<string, string>);
      
      return { ...filteredPrev, ...newErrors };
    });
    
    return Object.keys(newErrors).length === 0;
  };

  const handleChange = (fieldName: string, rawValue: any) => {
    if (isViewMode) return;
    
    let parsedValue = rawValue;
    
    if (typeof rawValue === 'boolean') {
      parsedValue = rawValue;
    } else if (typeof rawValue === 'object' && rawValue !== null) {
      parsedValue = rawValue; // <-- Garante que Arrays (como os do IPTU) sejam passados limpos
    } else if (rawValue !== undefined && rawValue !== null) {
      parsedValue = String(rawValue);
    } else {
      parsedValue = '';
    }
      
    setFormValues(prev => ({ ...prev, [fieldName]: parsedValue }));

    const updatedValues = { ...formValues, [fieldName]: parsedValue };

    if (onFormValuesChange) {
      onFormValuesChange(updatedValues);
    }

    if (errors[fieldName]) {
      setErrors(prev => {
        const newErrors = { ...prev };
        delete newErrors[fieldName];
        return newErrors;
      });
    }

    if (hasSteps && !externalCompletedSteps) {
      const isCurrentStepComplete = validateStep(currentStep, updatedValues);
      if (isCurrentStepComplete && !internalCompletedSteps.includes(currentStep)) {
        setInternalCompletedSteps(prev => [...prev, currentStep]);
      }
    }

    if (onFieldChange) {
      Promise.resolve(onFieldChange(fieldName, parsedValue))
        .then(result => {
          if (result && typeof result === 'object') {
            setFormValues(current => ({ ...current, ...result }));
            if (onFormValuesChange) onFormValuesChange({ ...updatedValues, ...result });
          }
        })
        .catch(error => console.error(error));
    }
  };

  const handleNextStep = (): boolean => {
    if (!hasSteps) return true;
    
    if (validateCurrentStep()) {
      if (onStepComplete) {
        const nextValues = onStepComplete(currentStep, formValues);

        if (nextValues && typeof nextValues === 'object') {
          setFormValues(current => ({ ...current, ...nextValues }));
          if (onFormValuesChange) onFormValuesChange({ ...formValues, ...nextValues });
        }
      }
      
      if (!externalCompletedSteps && !internalCompletedSteps.includes(currentStep)) {
        setInternalCompletedSteps(prev => [...prev, currentStep]);
      }
      
      if (currentStep < steps!.length - 1) {
        setCurrentStep(prev => prev + 1);
        return true;
      }
    } else {
      showMessage('Preencha todos os campos obrigatórios antes de avançar', 'error');
    }
    
    return false;
  };

  const handleSaveAndProceed = async () => {
    if (isViewMode) return;
    
    setSubmitting(true);

    try {
      // Salvar no backend
      if (onSubmit) {
        const result = await onSubmit(formValues);
        
        // Atualizar snapshot após salvar
        setInitialSnapshot(formValues);
        
        // Se for modo create, agora temos um ID
        if (mode === 'create' && result?.data?.id) {
          // Mudar para modo edit com o novo ID
          const url = new URL(window.location.href);
          url.searchParams.delete('mode');
          url.pathname = url.pathname.replace('/cadastrar', `/editar/${result.data.id}`);
          window.history.replaceState({}, '', url.toString());
        }
        
        // Prosseguir para próxima etapa
        if (handleNextStep()) {
          return;
        }
      } else {
        // Fallback: tentar salvar direto na API
        const url = mode === 'create'
          ? `${process.env.NEXT_PUBLIC_URL_API}/${resource}`
          : `${process.env.NEXT_PUBLIC_URL_API}/${resource}/${id}`;

        const method = mode === 'create' ? 'POST' : 'PUT';
        const dataToSend = transformResponse ? transformResponse(formValues) : formValues;

        const response = await fetch(url, {
          method,
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify(dataToSend),
        });

        if (!response.ok) {
          const errorData = await response.json().catch(() => ({}));
          throw new Error(errorData.message || `Erro ao ${mode === 'create' ? 'cadastrar' : 'atualizar'}`);
        }

        const result = await response.json();
        
        // Atualizar snapshot após salvar
        setInitialSnapshot(formValues);
        
        // Se for modo create, agora temos um ID
        if (mode === 'create' && result?.data?.id) {
          const url = new URL(window.location.href);
          url.searchParams.delete('mode');
          url.pathname = url.pathname.replace('/cadastrar', `/editar/${result.data.id}`);
          window.history.replaceState({}, '', url.toString());
        }
        
        // Prosseguir para próxima etapa
        if (handleNextStep()) {
          return;
        }
      }
    } catch (error: any) {
      showMessage(error.message || `Erro ao salvar ${title.toLowerCase()}.`, 'error');
    } finally {
      setSubmitting(false);
    }
  };

  const handlePrevStep = () => {
    if (hasSteps && currentStep > 0) {
      setCurrentStep(prev => prev - 1);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (isViewMode) return;
    
    const passwordError = errors['password'] || errors['password_confirm'];
    if (passwordError) {
      showMessage(passwordError, 'error');
      return;
    }
    
    if (hasSteps) {
      if (!validateCurrentStep()) {
        showMessage('Por favor, corrija os erros no formulário.', 'error');
        return;
      }
      
      if (!isLastStep) {
        if (handleNextStep()) {
          return;
        }
      }
    }
    
    if (!validateAllSteps()) {
      showMessage('Por favor, corrija os erros no formulário.', 'error');
      return;
    }

    setSubmitting(true);

    const finalizeSuccess = (resultData: any) => {
      if (draftKey) clearDraft(draftKey);
      setInitialSnapshot(formValues);
      if (onSubmitSuccess) {
        onSubmitSuccess(resultData);
      } else {
        showMessage(
          `${title} ${mode === 'create' ? 'cadastrado' : 'atualizado'} com sucesso!`,
          'success'
        );
        router.push(basePath);
      }
    };

    try {
      if (onSubmit) {
        const result = await onSubmit(formValues);
        finalizeSuccess(result?.data || result);
      } else {
        const url = mode === 'create'
          ? `${process.env.NEXT_PUBLIC_URL_API}/${resource}`
          : `${process.env.NEXT_PUBLIC_URL_API}/${resource}/${id}`;

        const method = mode === 'create' ? 'POST' : 'PUT';
        const dataToSend = transformResponse ? transformResponse(formValues) : formValues;

        const response = await fetch(url, {
          method,
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify(dataToSend),
        });

        if (!response.ok) {
          const errorData = await response.json().catch(() => ({}));
          throw new Error(errorData.message || `Erro ao ${mode === 'create' ? 'cadastrar' : 'atualizar'}`);
        }

        const result = await response.json();
        finalizeSuccess(result?.data || result);
      }
    } catch (error: any) {
      showMessage(error.message || `Erro ao salvar ${title.toLowerCase()}.`, 'error');
    } finally {
      setSubmitting(false);
    }
  };

  const shouldRenderField = (field: FormFieldDef): boolean => {
    if (field.hidden === true) return false;
    
    if (typeof field.hidden === 'function') {
      try {
        return !field.hidden(formValues);
      } catch (error) {
        return true;
      }
    }
    
    return true;
  };

  const renderField = (field: FormFieldDef, index: number) => {
    let value = formValues[field.field];
    if (value === undefined || value === null) {
      // Importante não transformar array em string vazia, pois custom components quebram
      value = field.type === 'custom' ? [] : '';
    } else if (['text', 'email', 'password', 'tel', 'date'].includes(field.type)) {
      value = String(value);
    }
    
    const error = errors[field.field];
    const isDisabled = isViewMode || field.disabled || loading || submitting;
    const isReadOnly = isViewMode || field.readOnly;

    if (!shouldRenderField(field)) {
      return null;
    }

    let shouldDisable = isDisabled;
    
    if (hasSteps && currentStep === 1 && !completedSteps.includes(0) && !isViewMode && !externalCompletedSteps) {
      shouldDisable = true;
    }

    const commonProps = {
      id: field.field,
      label: field.label,
      required: field.required,
      placeholder: field.placeholder,
      disabled: shouldDisable,
      value: value,
      onChange: (e: React.ChangeEvent<HTMLInputElement>) => {
        handleChange(field.field, e.target.value);
      },
      onBlur: (e: React.FocusEvent<HTMLInputElement>) => {
        (field as any).onBlur?.(e.target.value);
      },
      tabIndex: field.tabIndex,
      autoFocus: field.autoFocus,
      svg: field.icon,
      mask: field.mask as any,
      maxLength: field.maxLength,
      showIncrementButtons: field.type === 'number' && field.showIncrementButtons,
      min: field.min,
      max: field.max,
      full: (field as any).full,
    };

    switch (field.type) {
      case 'text':
      case 'email':
      case 'tel':
      case 'number':
      case 'date':
        return (
          <div 
            key={`${field.field}-${index}`} 
            className={`${field.className || ''} min-w-0`}
          >
            <Input
              {...commonProps}
              type={field.type}
            />
            {(field as any).renderBottom && (field as any).renderBottom(value, formValues)}
            {error && <p className="text-state-error text-sm mt-1">{error}</p>}
          </div>
        );

      case 'password':
        const isPasswordField = field.field === 'password';
        const isConfirmField = field.field === 'password_confirm';
        
        const otherField = isPasswordField 
          ? currentFields.find(f => f.field === 'password_confirm')
          : isConfirmField
            ? currentFields.find(f => f.field === 'password')
            : null;
        
        if (isPasswordField && otherField) {
          const confirmField = otherField;
          let confirmValue = formValues[confirmField.field];
          if (confirmValue === undefined || confirmValue === null) confirmValue = '';
          
          return (
            <div 
              key={`password-group-${index}`}
              className={`flex flex-col md:flex-row gap-3 w-full ${field.className || ''}`}
              style={{ flexBasis: '100%' }}
            >
              <div className="min-w-0 flex-1">
                <Input
                  {...commonProps}
                  type="password"
                  password
                />
                {(field as any).renderBottom && (field as any).renderBottom(value, formValues)}
                {field.validation?.patternMessage && !error && !(field as any).renderBottom && (
                  <p className="text-content-muted text-xs mt-1">
                    {field.validation.patternMessage}
                  </p>
                )}
                {error && <p className="text-state-error text-sm mt-1">{error}</p>}
              </div>
              
              <div className="min-w-0 flex-1">
                <Input
                  id={confirmField.field}
                  label={confirmField.label}
                  required={confirmField.required}
                  type="password"
                  password
                  placeholder={confirmField.placeholder}
                  disabled={shouldDisable}
                  value={String(confirmValue)}
                  onChange={(e: React.ChangeEvent<HTMLInputElement>) => 
                    handleChange(confirmField.field, e.target.value)
                  }
                />
                {errors[confirmField.field] && <p className="text-state-error text-sm mt-1">{errors[confirmField.field]}</p>}
              </div>
            </div>
          );
        }
        
        if (isConfirmField) return null;
        
        return (
          <div 
            key={`${field.field}-${index}`} 
            className={`${field.className || ''} w-full`}
          >
            <Input
              {...commonProps}
              type="password"
              password
            />
            {(field as any).renderBottom && (field as any).renderBottom(value, formValues)}
            {error && <p className="text-state-error text-sm mt-1">{error}</p>}
          </div>
        );

      case 'select':
        return (
          <div 
            key={`${field.field}-${index}`} 
            className={`${field.className || ''} min-w-0`}
          >
            <Select
              id={field.field}
              label={field.label}
              required={field.required}
              disabled={shouldDisable}
              options={typeof field.options === 'function' ? field.options(formValues) : (field.options || [])}
              value={value}
              onChange={(selectedValue: string | number) => handleChange(field.field, selectedValue)}
              placeholder={field.placeholder || "Selecione..."}
              svg={field.icon}
              tabIndex={field.tabIndex}
              searchable={(field as any).searchable}
            />
            {(field as any).renderBottom && (field as any).renderBottom(value, formValues)}
            {error && <p className="text-state-error text-sm mt-1">{error}</p>}
          </div>
        );

      case 'textarea':
        return (
          <div 
            key={`${field.field}-${index}`} 
            className={`${field.className || 'w-full block'}`} style={{flex: '1 1 100%', display: 'block'}}
          >
            <TextArea
              id={field.field}
              label={field.label}
              required={field.required}
              value={value}
              onChange={(e: React.ChangeEvent<HTMLTextAreaElement>) => 
                handleChange(field.field, e.target.value)
              }
              placeholder={field.placeholder || ''}
              svg={field.icon}
              tabIndex={field.tabIndex}
              disabled={shouldDisable}
              rows={field.rows || 3}
              error={error}
              maxLength={field.maxLength}
              autoFocus={field.autoFocus} 
            />
            {(field as any).renderBottom && (field as any).renderBottom(value, formValues)}
          </div>
        );

      case 'checkbox':
      case 'boolean':
        return (
          <div
            key={`${field.field}-${index}`}
            className="flex items-center min-w-0"
          >
            <Toggle
              checked={!!value}
              onChange={(checked) => handleChange(field.field, checked)}
              label={field.label}
              disabled={shouldDisable || isReadOnly}
            />
            {(field as any).renderBottom && (field as any).renderBottom(value, formValues)}
          </div>
        );

      case 'file':
        return (
          <div 
            key={`${field.field}-${index}`} 
            className={`${field.className || ''} min-w-0 h-full`}
          >
            <InputFile
              id={field.field}
              label={field.label}
              accept={field.accept || ''}
              textButton={field.textButton || field.buttonText}
              value={Array.isArray(value) ? value : []}
              onChange={(files) => handleChange(field.field, files)}
              svg={field.icon}
              multiple={field.multiple}
              disabled={shouldDisable}
              required={field.required}
              placeholder={field.placeholder}
              maxFiles={field.maxFiles}
              isViewMode={isViewMode}
              enableFeatureSelection={(field as any).enableFeatureSelection}
            />
            {(field as any).renderBottom && (field as any).renderBottom(value, formValues)}
          </div>
        );

      case 'custom':
        // O COMPONENTE CUSTOM RECEBE SEU VALOR (value) AQUI
        return (
          <div 
            key={`${field.field}-${index}`} 
            className={`${field.className || 'w-full'}`}
          >
            <label className="block text-sm font-medium text-content-secondary mb-1">
              {field.label}
            </label>
            <div className="mt-1">
              {field.render ? field.render(value, formValues, (newValue: any) => handleChange(field.field, newValue)) : null}
            </div>
            {(field as any).renderBottom && (field as any).renderBottom(value, formValues)}
          </div>
        );

      default:
        return (
          <div 
            key={`${field.field}-${index}`} 
            className={`${field.className || ''} min-w-0`}
          >
            <Input
              {...commonProps}
              type="text"
            />
            {(field as any).renderBottom && (field as any).renderBottom(value, formValues)}
            {error && <p className="text-state-error text-sm mt-1">{error}</p>}
          </div>
        );
    }
  };

  if (mode !== 'create' && loading) {
    return (
      <Section 
        title={`${mode === 'edit' ? 'Editar' : 'Visualizar'} ${title}`} 
        href={basePath} 
        hrefText="Voltar"
      >
        <div className="bg-surface p-5 rounded-xl" style={{ boxShadow: '0px 4px 8px 3px var(--color-shadow-soft)' }}>
          <div className="animate-pulse">
            <div className="h-6 bg-ui-border-soft rounded w-1/4 mb-6"></div>
            <div className="space-y-4">
              <div className="h-10 bg-ui-border-soft rounded"></div>
              <div className="h-10 bg-ui-border-soft rounded"></div>
              <div className="h-10 bg-ui-border-soft rounded"></div>
            </div>
          </div>
        </div>
      </Section>
    );
  }

  const currentStepData = hasSteps ? steps![currentStep] : null;
  const visibleFields = currentFields.filter(shouldRenderField);

  return (
    <Section 
      title={`${mode === 'create' ? 'Cadastrar' : mode === 'edit' ? 'Editar' : 'Visualizar'} ${title}`} 
      href={basePath} 
      hrefText="Voltar"
    >
      <div className="bg-surface p-5 rounded-xl" style={{ boxShadow: '0px 4px 8px 3px var(--color-shadow-soft)' }}>
        {mode === 'edit' && isDirty && (
          <div className="mb-4 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2 px-3 py-2 rounded-lg border border-amber-300 bg-amber-50 text-amber-900 text-sm">
            <span>Você possui alterações não salvas.</span>
            <button
              type="button"
              onClick={handleSaveAndProceed}
              disabled={submitting}
              className="px-3 py-1.5 bg-amber-600 hover:bg-amber-700 text-white rounded-md text-xs font-medium disabled:opacity-60"
            >
              {submitting ? 'Salvando...' : 'Salvar alterações'}
            </button>
          </div>
        )}
        {hasSteps && (
          <ProgressBar
            steps={steps!.map((step, index) => ({
              title: step.title,
              icon: step.icon,
              index,
            }))}
            currentStep={currentStep}
            completedSteps={completedSteps}
            onStepClick={handleStepClick}
          />
        )}

        <Form
          ref={formRef}
          className="flex flex-col gap-3"
          title={currentStepData?.title || `Dados do ${title}`}
          onSubmit={handleSubmit}
          svg={currentStepData?.icon}
        >
          {visibleFields.length > 0 ? (
            <div className="w-full flex flex-wrap gap-3 h-full md:flex-row flex-column">
              {visibleFields.map((field, index) => renderField(field, index))}
            </div>
          ) : (
            <div className="col-span-full text-center py-8 text-content-muted">
              Nenhum campo configurado para este passo.
            </div>
          )}

          <div className="w-full flex justify-end">
            {isViewMode ? (
              <div className="flex items-center gap-5 mt-8 border-t-2 pt-6 border-ui-border w-full justify-end">
                <button
                  type="button"
                  onClick={() => router.push(`${basePath}/editar/${id}`)}
                  className="flex justify-center gap-3 items-center max-w-[250px] w-full h-[50px] bg-gradient-to-r from-brand to-brand-hover rounded-lg text-[16px] font-medium text-content-inverse border border-brand drop-shadow-purple-soft"
                >
                  Editar
                </button>
              </div>
            ) : (
              <>
                {onCancel && (
                  <button
                    type="button"
                    onClick={onCancel}
                    className="flex justify-center items-center max-w-[150px] w-full h-[50px] bg-ui-border rounded-lg text-[16px] font-medium text-content-secondary mr-4"
                  >
                    Cancelar
                  </button>
                )}
                <NavigationButtons
                  submitButton={!hasSteps || isLastStep}
                  textSubmitButton={mode === 'create' ? 'Cadastrar' : 'Salvar Alterações'}
                  svg={
                    <svg width="21" height="20" viewBox="0 0 21 20" fill="none" xmlns="http://www.w3.org/2000/svg">
                      <path d="M9.5 15H11.5V11H15.5V9H11.5V5H9.5V9H5.5V11H9.5V15ZM10.5 20C9.11667 20 7.81667 19.7375 6.6 19.2125C5.38333 18.6875 4.325 17.975 3.425 17.075C2.525 16.175 1.8125 15.1167 1.2875 13.9C0.7625 12.6833 0.5 11.3833 0.5 10C0.5 8.61667 0.7625 7.31667 1.2875 6.1C1.8125 4.88333 2.525 3.825 3.425 2.925C4.325 2.025 5.38333 1.3125 6.6 0.7875C7.81667 0.2625 9.11667 0 10.5 0C11.8833 0 13.1833 0.2625 14.4 0.7875C15.6167 1.3125 16.675 2.025 17.575 2.925C18.475 3.825 19.1875 4.88333 19.7125 6.1C20.2375 7.31667 20.5 8.61667 20.5 10C20.5 11.3833 20.2375 12.6833 19.7125 13.9C19.1875 15.1167 18.475 16.175 17.575 17.075C16.675 17.975 15.6167 18.6875 14.4 19.2125C13.1833 19.7375 11.8833 20 10.5 20ZM10.5 18C12.7333 18 14.625 17.225 16.175 15.675C17.725 14.125 18.5 12.2333 18.5 10C18.5 7.76667 17.725 5.875 16.175 4.325C14.625 2.775 12.7333 2 10.5 2C8.26667 2 6.375 2.775 4.825 4.325C3.275 5.875 2.5 7.76667 2.5 10C2.5 12.2333 3.275 14.125 4.825 15.675C6.375 17.225 8.26667 18 10.5 18Z" fill="var(--color-bg-subtle)" />
                    </svg>
                  }
                  loading={submitting}
                  textLoading={mode === 'create' ? 'Cadastrando...' : 'Salvando...'}
                  formComplete={false}
                  tabIndex={10}
                  
                  showPrevious={hasSteps && currentStep > 0}
                  showNext={hasSteps && !isLastStep}
                  isLastStep={isLastStep}
                  onPrevious={handlePrevStep}
                  onNext={handleNextStep}
                />
              </>
            )}
          </div>
        </Form>
      </div>
    </Section>
  );
}
