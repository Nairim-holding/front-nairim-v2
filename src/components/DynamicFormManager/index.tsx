/* eslint-disable @typescript-eslint/no-explicit-any */
'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import { useRouter } from 'next/navigation';
import Section from '@/components/Section';
import Form from '@/components/Ui/Form';
import Input from '@/components/Ui/Input';
import Select from '@/components/Ui/Select';
import TextArea from '@/components/Ui/TextArea';
import InputFile from '@/components/Ui/InputFile';
import { useMessageContext } from '@/contexts/MessageContext';
import { FormFieldDef, FormStep } from '@/types/types';
import NavigationButtons from '../NavigationButtons';
import ProgressBar from '../ProgressBar';

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
  onStepComplete?: (stepIndex: number) => void;
  canNavigateToStep?: (targetStep: number, currentStep: number, data: any) => boolean;
}

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
}: DynamicFormManagerProps) {
  const router = useRouter();
  const { showMessage } = useMessageContext();
  const formRef = useRef<HTMLFormElement>(null);
  
  const [loading, setLoading] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [currentStep, setCurrentStep] = useState(0);
  const [formValues, setFormValues] = useState<Record<string, any>>({});
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [internalCompletedSteps, setInternalCompletedSteps] = useState<number[]>([]);
  
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

  useEffect(() => {
    const initialValues: Record<string, any> = {};
    const allFields = steps ? steps.flatMap(step => step.fields || []) : fields || [];
    
    allFields.forEach(field => {
      if (field.defaultValue !== undefined) {
        initialValues[field.field] = field.defaultValue;
      } else {
        switch (field.type) {
          case 'checkbox':
          case 'boolean':
            initialValues[field.field] = false;
            break;
          case 'number':
            initialValues[field.field] = 0;
            break;
          case 'file':
          case 'custom':
            initialValues[field.field] = [];
            break;
          default:
            initialValues[field.field] = '';
        }
      }
    });
    
    setFormValues(initialValues);
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
          
          setFormValues((prev: Record<string, any>) => ({ ...prev, ...updatedValues }));

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

    if (value && value.toString().trim() !== '' && !Array.isArray(value)) {
      const stringValue = value.toString();
      
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
    
    // CORREÇÃO: Preserva Arrays e Objetos para campos Custom/File
    const parsedValue = (typeof rawValue === 'object' && rawValue !== null) 
      ? rawValue 
      : (rawValue !== undefined && rawValue !== null ? String(rawValue) : '');
    
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
            setFormValues(current => {
              const newVals = { ...current, ...result };
              if (onFormValuesChange) onFormValuesChange(newVals);
              return newVals;
            });
          }
        })
        .catch(error => console.error('Erro no onFieldChange:', error));
    }
  };

  const handleNextStep = (): boolean => {
    if (!hasSteps) return true;
    
    if (validateCurrentStep()) {
      if (onStepComplete) {
        onStepComplete(currentStep);
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
    
    try {
      if (onSubmit) {
        const result = await onSubmit(formValues);
        
        showMessage(
          result.message || `${title} ${mode === 'create' ? 'criado' : 'atualizado'} com sucesso!`,
          'success'
        );

        if (onSubmitSuccess) {
          onSubmitSuccess(result.data || result);
        } else {
          router.push(basePath);
        }
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
          throw new Error(errorData.message || `Erro ao ${mode === 'create' ? 'criar' : 'atualizar'}`);
        }

        const result = await response.json();
        
        showMessage(
          result.message || `${title} ${mode === 'create' ? 'criado' : 'atualizado'} com sucesso!`,
          'success'
        );

        if (onSubmitSuccess) {
          onSubmitSuccess(result.data || result);
        } else {
          router.push(basePath);
        }
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
      value = '';
    } else if (['text', 'email', 'password', 'tel'].includes(field.type)) {
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
      onChange: (e: React.ChangeEvent<HTMLInputElement>) => handleChange(field.field, e.target.value),
      tabIndex: field.tabIndex,
      autoFocus: field.autoFocus,
      svg: field.icon,
      mask: field.mask as any,
      maxLength: field.maxLength,
      showIncrementButtons: field.type === 'number' && field.showIncrementButtons,
      min: field.min,
      max: field.max,
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
              options={field.options || []}
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
            <input
              type="checkbox"
              id={field.field}
              checked={!!value}
              onChange={(e: React.ChangeEvent<HTMLInputElement>) => 
                handleChange(field.field, e.target.checked)
              }
              disabled={shouldDisable}
              readOnly={isReadOnly}
              className="h-4 w-4 text-brand border-ui-border rounded focus:ring-brand"
            />
            <label htmlFor={field.field} className="ml-2 block text-sm text-content-secondary">
              {field.label}
            </label>
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
            />
            {(field as any).renderBottom && (field as any).renderBottom(value, formValues)}
          </div>
        );

      case 'custom':
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
