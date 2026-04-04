'use client';

import React from 'react';
import { Clock } from 'lucide-react';

interface RateLimitBlockedProps {
  timeRemaining: number;
  initialTime: number;
  formatTimeRemaining: (seconds: number) => string;
}

export const RateLimitBlocked: React.FC<RateLimitBlockedProps> = ({ 
  timeRemaining, 
  initialTime,
  formatTimeRemaining
}) => {
  const progressPercentage = initialTime > 0 ? (timeRemaining / initialTime) * 100 : 0;
  
  return (
    <div className="w-full max-w-md mb-6 text-red-600 bg-red-50 border border-red-200 rounded-lg px-6 py-4 animate-slide-up">
      <div className="flex flex-col items-center text-center gap-4">
        <div className="flex items-center gap-2">
          <Clock size={20} className="text-red-600" />
          <span className="font-semibold text-lg">Conta temporariamente bloqueada</span>
        </div>
        <p className="text-sm">
          Muitas tentativas de login falharam. Tente novamente em {formatTimeRemaining(timeRemaining)}.
        </p>
        <div className="w-full bg-red-200 rounded-full h-2">
          <div 
            className="bg-red-600 h-2 rounded-full transition-all duration-1000 ease-linear"
            style={{ width: `${progressPercentage}%` }}
          />
        </div>
      </div>
    </div>
  );
};
