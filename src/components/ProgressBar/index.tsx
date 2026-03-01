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
    <div className="flex border-b-2 pb-3 border-ui-border pt-2">
      <ul className="flex items-center gap-4 flex-wrap justify-center sm:justify-start">
        {steps.map((step, index) => {
          const status = getStepStatus(index);
          const accessible = isStepAccessible(index);
          const isClickable = accessible;

          return (
            <li key={index} className={status === 'active' ? 'z-10' : 'z-0'}>
              <button
                type="button"
                onClick={() => handleStepClick(index)}
                disabled={!isClickable}
                className={`
                  flex items-center gap-2 px-5 py-3 rounded-xl
                  transition-all duration-300
                  ${isClickable ? 'cursor-pointer hover:scale-105' : 'cursor-not-allowed'}
                  ${status === 'active' 
                    ? 'bg-gradient-to-r from-brand to-brand-hover drop-shadow-purple-soft text-content-inverse ring-2 ring-brand ring-offset-2 scale-105 font-bold border-transparent'
                    : status === 'completed'
                    ? 'bg-brand text-content-inverse opacity-80 border border-transparent shadow-sm'
                    : 'bg-surface-subtle text-content-muted opacity-50 border border-ui-border-muted drop-shadow-custom-black'
                  }
                `}
              >
                <div className={`
                  ${status === 'active' || status === 'completed' ? 'text-content-inverse' : 'text-content-muted'}
                `}>
                  {step.icon}
                </div>
                <p className={`text-[18px] font-poppins ${status === 'active' ? 'font-semibold' : 'font-medium'}`}>
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