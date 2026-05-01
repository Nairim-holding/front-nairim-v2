'use client';

import React, { useRef } from 'react';
import { Mail, Lock, Eye, EyeOff } from 'lucide-react';
import { SubmitButton } from '@/components/ui/SubmitButton';
import { ErrorMessage } from '@/components/ui/ErrorMessage';

interface LoginFormProps {
  onSubmit: (e: React.FormEvent) => Promise<void>;
  isLoading: boolean;
  isBlocked: boolean;
  showPassword: boolean;
  togglePassword: () => void;
  error: string;
  timeRemaining: number;
  formatTimeRemaining: (seconds: number) => string;
  emailInputRef?: React.RefObject<HTMLInputElement | null>;
}

export const LoginForm: React.FC<LoginFormProps> = ({
  onSubmit,
  isLoading,
  isBlocked,
  showPassword,
  togglePassword,
  error,
  timeRemaining,
  formatTimeRemaining,
  emailInputRef,
}) => {
  const internalEmailRef = useRef<HTMLInputElement>(null);
  const emailRef = emailInputRef || internalEmailRef;

  return (
    <form className="flex flex-col gap-6 w-full max-w-md" onSubmit={onSubmit}>
      <div className="relative">
        <Mail className="absolute left-4 top-1/2 transform -translate-y-1/2 text-content-placeholder" size={20} />
        <input
          ref={emailRef}
          type="email"
          name="email"
          placeholder="exemplo@gmail.com"
          className="h-[56px] text-content w-full pl-12 pr-4 py-3 bg-surface border border-ui-border rounded-full focus:border-brand focus:ring-1 focus:ring-brand outline-none transition-all duration-200 placeholder:text-content-placeholder disabled:opacity-50 disabled:cursor-not-allowed"
          required
          disabled={isLoading || isBlocked}
          aria-label="Email"
          autoComplete="email"
          autoFocus
        />
      </div>

      <div className="relative">
        <Lock className="absolute left-4 top-1/2 transform -translate-y-1/2 text-content-placeholder" size={20} />
        <input
          type={showPassword ? "text" : "password"}
          name="password"
          placeholder="senha"
          className="h-[56px] text-content w-full pl-12 pr-12 py-3 bg-surface border border-ui-border rounded-full focus:border-brand focus:ring-1 focus:ring-brand outline-none transition-all duration-200 placeholder:text-content-placeholder disabled:opacity-50 disabled:cursor-not-allowed"
          required
          disabled={isLoading || isBlocked}
          aria-label="Senha"
          autoComplete="current-password"
        />
        <button
          type="button"
          onClick={togglePassword}
          className="absolute right-4 top-1/2 transform -translate-y-1/2 text-content-placeholder hover:text-brand transition-colors duration-200 disabled:opacity-50"
          disabled={isLoading || isBlocked}
          aria-label="Mostrar senha"
        >
          {showPassword ? <Eye size={20} /> : <EyeOff size={20} />}
        </button>
      </div>

      <ErrorMessage message={error} />

      <SubmitButton
        isLoading={isLoading}
        isBlocked={isBlocked}
        timeRemaining={timeRemaining}
        formatTimeRemaining={formatTimeRemaining}
      />
    </form>
  );
};
