// src/components/Ui/ProgressBar/index.tsx
'use client';

interface ProgressStep {
  title: string;
  icon: React.ReactNode;
  index: number;
}

interface ProgressBarProps {
  steps: ProgressStep[];
  currentStep: number;
  completedSteps: number[];
  onStepClick: (stepIndex: number) => void;
}

export default function ProgressBar({ 
  steps, 
  currentStep, 
  completedSteps, 
  onStepClick 
}: ProgressBarProps) {
  
  const isStepAccessible = (stepIndex: number): boolean => {
    // O step é acessível se:
    // 1. É o step atual, OU
    // 2. Já foi completado (está na lista de completedSteps), OU
    // 3. É um step anterior ao atual (sempre pode voltar)
    if (stepIndex === currentStep) return true;
    if (completedSteps.includes(stepIndex)) return true;
    if (stepIndex < currentStep) return true;
    
    // Para steps futuros, verifica se todos os anteriores foram completados
    for (let i = 0; i < stepIndex; i++) {
      if (!completedSteps.includes(i) && i !== currentStep) {
        return false;
      }
    }
    return true;
  };

  const getStepStatus = (stepIndex: number) => {
    if (stepIndex === currentStep) return 'active';
    if (completedSteps.includes(stepIndex)) return 'completed';
    return 'pending';
  };

  const handleStepClick = (stepIndex: number) => {
    if (isStepAccessible(stepIndex)) {
      onStepClick(stepIndex);
    }
  };

  return (
    <div className="flex border-b-2 pb-3 border-ui-border">
      <ul className="flex items-center gap-3 flex-wrap justify-center sm:justify-start">
        {steps.map((step, index) => {
          const status = getStepStatus(index);
          const accessible = isStepAccessible(index);
          const isClickable = accessible;

          return (
            <li key={index}>
              <button
                type="button"
                onClick={() => handleStepClick(index)}
                disabled={!isClickable}
                className={`
                  flex items-center gap-2 px-5 py-3 border border-ui-border-muted rounded-xl drop-shadow-custom-black
                  transition-all duration-200
                  ${isClickable ? 'cursor-pointer hover:scale-105' : 'cursor-not-allowed'}
                  ${status === 'active' || status === 'completed'
                    ? 'bg-gradient-to-r from-brand to-brand-hover drop-shadow-purple-soft text-content-inverse'
                    : 'bg-surface-subtle text-content-muted opacity-50'
                  }
                `}
              >
                <div className={`
                  ${status === 'active' || status === 'completed' ? 'text-content-inverse' : 'text-content-muted'}
                `}>
                  {step.icon}
                </div>
                <p className="text-[18px] font-medium font-poppins">
                  {step.title}
                </p>
              </button>
            </li>
          );
        })}
      </ul>
    </div>
  );
}