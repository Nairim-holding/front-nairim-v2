'use client';

import type { ReactNode } from 'react';

interface ProgressStep {
  title: string;
  icon: ReactNode;
  index: number;
}

interface ProgressBarProps {
  steps: ProgressStep[];
  currentStep: number;
  completedSteps: number[];
  onStepClick: (stepIndex: number) => void;
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

function isStepAccessible(stepIndex: number, currentStep: number, completedSteps: number[]): boolean {
  if (stepIndex === currentStep || stepIndex < currentStep) return true;
  if (completedSteps.includes(stepIndex)) return true;

  for (let i = 0; i < stepIndex; i++) {
    if (!completedSteps.includes(i) && i !== currentStep) return false;
  }
  return true;
}

type StepStatus = 'active' | 'completed' | 'pending';

function getStepStatus(stepIndex: number, currentStep: number, completedSteps: number[]): StepStatus {
  if (stepIndex === currentStep) return 'active';
  if (completedSteps.includes(stepIndex)) return 'completed';
  return 'pending';
}

const STEP_STYLES: Record<StepStatus, string> = {
  active:
    'bg-gradient-to-r from-brand to-brand-hover drop-shadow-purple-soft text-content-inverse ring-2 ring-brand ring-offset-2 scale-105 font-bold border-transparent',
  completed:
    'bg-brand text-content-inverse opacity-80 border border-transparent shadow-sm',
  pending:
    'bg-surface-subtle text-content-muted opacity-50 border border-ui-border-muted drop-shadow-custom-black',
};

// ─── Component ────────────────────────────────────────────────────────────────

export default function ProgressBar({ steps, currentStep, completedSteps, onStepClick }: ProgressBarProps) {
  return (
    <div className="flex border-b-2 pb-3 border-ui-border pt-2">
      <ul className="flex items-center gap-4 flex-wrap justify-center sm:justify-start">
        {steps.map((step, index) => {
          const status = getStepStatus(index, currentStep, completedSteps);
          const accessible = isStepAccessible(index, currentStep, completedSteps);

          return (
            <li key={index} className={status === 'active' ? 'z-10' : 'z-0'}>
              <button
                type="button"
                onClick={() => accessible && onStepClick(index)}
                disabled={!accessible}
                className={`
                  flex items-center gap-2 px-5 py-3 rounded-xl transition-all duration-300
                  ${accessible ? 'cursor-pointer hover:scale-105' : 'cursor-not-allowed'}
                  ${STEP_STYLES[status]}
                `}
              >
                <span className={status === 'active' || status === 'completed' ? 'text-content-inverse' : 'text-content-muted'}>
                  {step.icon}
                </span>
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
