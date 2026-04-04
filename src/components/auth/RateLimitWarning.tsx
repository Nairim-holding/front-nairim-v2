'use client';

import React from 'react';
import { AlertTriangle } from 'lucide-react';

interface RateLimitWarningProps {
  failedAttempts: number;
  warningColor: string;
}

export const RateLimitWarning: React.FC<RateLimitWarningProps> = ({ 
  failedAttempts, 
  warningColor 
}) => {
  if (failedAttempts === 0) return null;
  
  return (
    <div className={`w-full max-w-md mb-6 text-sm rounded-lg px-4 py-3 border animate-slide-up ${warningColor}`}>
      <div className="flex items-center gap-2">
        <AlertTriangle size={16} />
        <span>
          {failedAttempts === 1 
            ? '1 tentativa falhou. Restam 2 tentativas antes do bloqueio.'
            : '2 tentativas falharam. Resta 1 tentativa antes do bloqueio.'
          }
        </span>
      </div>
    </div>
  );
};
