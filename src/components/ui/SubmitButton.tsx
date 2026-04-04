'use client';

import React from 'react';
import { Clock } from 'lucide-react';

interface SubmitButtonProps {
  isLoading: boolean;
  isBlocked: boolean;
  timeRemaining: number;
  formatTimeRemaining: (seconds: number) => string;
  disabled?: boolean;
  className?: string;
  children?: React.ReactNode;
}

export const SubmitButton: React.FC<SubmitButtonProps> = ({
  isLoading,
  isBlocked,
  timeRemaining,
  formatTimeRemaining,
  disabled = false,
  className = `
    bg-brand hover:bg-brand-hover
    text-white font-normal rounded-full py-3 px-6
    transition-all duration-200
    disabled:opacity-50 disabled:cursor-not-allowed
    mt-2 h-[56px]
  `,
  children = 'Entrar'
}) => {
  const isDisabled = disabled || isLoading || isBlocked;
  
  return (
    <button
      type="submit"
      disabled={isDisabled}
      className={className}
    >
      {isLoading ? (
        <span className="flex items-center justify-center">
          <svg className="animate-spin -ml-1 mr-3 h-5 w-5 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
          </svg>
          Entrando...
        </span>
      ) : isBlocked ? (
        <span className="flex items-center justify-center">
          <Clock size={20} className="mr-2" />
          Aguarde {formatTimeRemaining(timeRemaining)}
        </span>
      ) : children}
    </button>
  );
};
