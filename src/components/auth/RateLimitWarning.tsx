'use client';

import React from 'react';
import { AlertTriangle } from 'lucide-react';

interface RateLimitWarningProps {
  failedAttempts: number;
  maxAttempts: number;
  warningColor: string;
}

export const RateLimitWarning: React.FC<RateLimitWarningProps> = ({
  failedAttempts,
  maxAttempts,
  warningColor
}) => {
  if (failedAttempts === 0) return null;

  const remainingAttempts = maxAttempts - failedAttempts;
  const attemptPlural = failedAttempts === 1 ? 'tentativa' : 'tentativas';
  const remainingPlural = remainingAttempts === 1 ? 'tentativa' : 'tentativas';

  return (
    <div className={`w-full max-w-md mb-6 text-sm rounded-lg px-4 py-3 border animate-slide-up ${warningColor}`}>
      <div className="flex items-center gap-2">
        <AlertTriangle size={16} />
        <span>
          {failedAttempts} {attemptPlural} falhada(s). Restam {remainingAttempts} {remainingPlural} antes do bloqueio.
        </span>
      </div>
    </div>
  );
};
