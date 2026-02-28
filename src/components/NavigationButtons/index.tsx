// src/components/Admin/NavigationButtons.tsx
'use client';

import Link from 'next/link';

interface NavigationButtonsProps {
  nextUrl?: string;
  submitButton?: boolean;
  textSubmitButton?: string;
  svg?: React.ReactNode;
  loading?: boolean;
  textLoading?: string;
  formComplete?: boolean;
  tabIndex?: number;
  onNext?: () => void;
  onPrevious?: () => void;
  showPrevious?: boolean;
  showNext?: boolean;
  isLastStep?: boolean;
}

export default function NavigationButtons({
  nextUrl,
  submitButton,
  textSubmitButton,
  svg,
  loading,
  textLoading,
  formComplete,
  tabIndex,
  onNext,
  onPrevious,
  showPrevious,
  showNext,
  isLastStep,
}: NavigationButtonsProps) {
  return (
    <div className="flex items-center gap-5 mt-3 border-t-2 pt-3 border-ui-border w-full justify-end">
      {showPrevious && (
        <button
          type="button"
          onClick={onPrevious}
          className="flex justify-center items-center max-w-[250px] w-full h-[50px] bg-gradient-to-r from-content-placeholder to-content-muted rounded-lg text-[16px] font-medium text-content-inverse border border-ui-border drop-shadow-soft"
        >
          Anterior
        </button>
      )}
      
      {showNext && !isLastStep && (
        <button
          type="button"
          onClick={onNext}
          className="flex justify-center items-center max-w-[250px] w-full h-[50px] bg-gradient-to-r from-brand to-brand-hover rounded-lg text-[16px] font-medium text-content-inverse border border-brand drop-shadow-purple-soft"
        >
          Próximo
        </button>
      )}
      
      {submitButton && (
        <button
          tabIndex={tabIndex}
          disabled={loading || formComplete}
          type="submit"
          className={`flex justify-center gap-3 items-center max-w-[250px] w-full h-[50px] bg-gradient-to-r from-brand to-brand-hover rounded-lg text-[16px] font-medium text-content-inverse border border-brand drop-shadow-purple-soft ${(loading || formComplete) ? 'opacity-50 cursor-not-allowed' : ''}`}
        >
          {svg}
          <p>{loading ? textLoading : textSubmitButton}</p>
        </button>
      )}
      
      {nextUrl && (
        <Link
          href={nextUrl}
          className="flex justify-center items-center max-w-[250px] w-full h-[50px] bg-gradient-to-r from-brand to-brand-hover rounded-lg text-[16px] font-medium text-content-inverse border border-brand drop-shadow-purple-soft"
        >
          Próximo
        </Link>
      )}
    </div>
  );
}