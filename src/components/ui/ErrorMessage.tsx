'use client';

import React from 'react';

interface ErrorMessageProps {
  message: string;
  className?: string;
}

export const ErrorMessage: React.FC<ErrorMessageProps> = ({ 
  message, 
  className = 'text-red-600 text-sm bg-red-50 border border-red-200 rounded-lg px-4 py-3' 
}) => {
  if (!message) return null;
  
  return (
    <div className={`${className} animate-slide-up`}>
      {message}
    </div>
  );
};
