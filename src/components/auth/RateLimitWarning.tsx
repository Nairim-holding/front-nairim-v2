'use client';

import React from 'react';
import { AlertTriangle } from 'lucide-react';

interface RateLimitWarningProps {
  failedAttempts: number;
  maxAttempts: number;
  warningColor: string;
  shouldWarnAboutBlockage?: boolean;
}

export const RateLimitWarning: React.FC<RateLimitWarningProps> = ({
  failedAttempts,
  maxAttempts,
  warningColor,
  shouldWarnAboutBlockage
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
      {shouldWarnAboutBlockage && (
        <div className="mt-3 pt-3 border-t border-current opacity-75 text-xs">
          Ao esgotar as {maxAttempts} tentativas de login, o sistema ficará bloqueado por 5 minutos, como medida de segurança. Preste atenção!
        </div>
      )}
    </div>
  );
};
