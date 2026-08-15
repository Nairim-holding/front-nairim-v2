'use client';

import React, { useState, useRef } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/contexts/AuthContext';
import { getTokenMaxAgeSeconds } from '@/utils/jwt';
import { useRateLimit } from '@/hooks/useRateLimit';
import { LoginForm } from '@/components/auth/Form';
import { RateLimitWarning } from '@/components/auth/RateLimitWarning';
import { RateLimitBlocked } from '@/components/auth/RateLimitBlocked';
import { loginAction } from '@/server/actions/auth';

interface LoginFormWrapperProps {
  companySlug?: string;
}

export const LoginFormWrapper = ({ companySlug }: LoginFormWrapperProps = {}) => {
  const navigation = useRouter();
  const { login } = useAuth();
  const [showPassword, setShowPassword] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState('');
  const emailInputRef = useRef<HTMLInputElement>(null);
  const {
    failedAttempts,
    isBlocked,
    timeRemaining,
    initialTime,
    shouldWarnAboutBlockage,
    blockDurationMinutes,
    incrementFailedAttempts,
    handleRateLimitError,
    resetAttempts,
    formatTimeRemaining,
    getAttemptWarningColor,
    getMaxLoginAttempts,
    updateFromBackendStatus,
  } = useRateLimit();

  const togglePassword = () => setShowPassword((prev) => !prev);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();

    // Prevent submission if blocked
    if (isBlocked) {
      return;
    }

    setIsLoading(true);
    setError('');

    const formData = new FormData(e.target as HTMLFormElement);
    const email = formData.get('email') as string;
    const password = formData.get('password') as string;
    try {
      const data = await loginAction({ email, password });

      if (!data.ok) {
        // Se temos status de rate limit da action, usamos
        if (data.rateLimit) {
          const {
            failedAttempts: backendAttempts,
            isBlocked: backendIsBlocked,
            blockedUntilSeconds,
            shouldWarnAboutBlockage: backendShouldWarn,
            blockDurationMinutes: backendBlockDurationMinutes,
          } = data.rateLimit;
          // Atualiza estado do front para refletir o backend
          updateFromBackendStatus(backendAttempts, backendIsBlocked, blockedUntilSeconds ?? undefined, backendShouldWarn, backendBlockDurationMinutes);
        } else {
          // Fallback para contagem local se a action não devolver status
          incrementFailedAttempts();
        }
        throw new Error(data.message || 'Erro ao tentar fazer login. Verifique suas credenciais.');
      }

      // Login bem-sucedido - reseta tentativas falhas
      resetAttempts();

      // Slug da empresa: vem da URL /[slug]/login ou da resposta do login
      const slug = companySlug ?? data.slug ?? data.user.company_slug ?? '';
      if (slug) {
        const maxAge = getTokenMaxAgeSeconds(data.token, 12 * 60 * 60);
        document.cookie = `company_slug=${slug}; path=/; SameSite=Lax; max-age=${maxAge}`;
      }

      login(data.token, data.user);

      navigation.push(slug ? `/${slug}/dashboard` : '/dashboard');
    } catch (err: unknown) {
      let errorMessage = 'Erro ao tentar fazer login. Verifique suas credenciais.';

      if (err instanceof Error) {
        errorMessage = err.message;

        // Check if it's a rate limit error from backend
        if (errorMessage.includes('Muitas tentativas de login falharam')) {
          handleRateLimitError(errorMessage);
          // Don't show error message since we'll show the blocked state UI
          return;
        }
      } else if (typeof err === 'string') {
        errorMessage = err;
      }

      setError(errorMessage);
      // Focar no campo de email após erro de login
      setTimeout(() => {
        emailInputRef.current?.focus();
      }, 0);
    } finally {
      setIsLoading(false);
    }
  }

  return (
    <>
      {/* Rate Limiting Status */}
      {!isBlocked && failedAttempts > 0 && (
        <RateLimitWarning
          failedAttempts={failedAttempts}
          maxAttempts={getMaxLoginAttempts()}
          warningColor={getAttemptWarningColor()}
          shouldWarnAboutBlockage={shouldWarnAboutBlockage}
          blockDurationMinutes={blockDurationMinutes}
        />
      )}

      {/* Blocked State */}
      {isBlocked && (
        <RateLimitBlocked
          timeRemaining={timeRemaining}
          initialTime={initialTime}
          formatTimeRemaining={formatTimeRemaining}
          blockDurationMinutes={blockDurationMinutes}
          maxAttempts={getMaxLoginAttempts()}
        />
      )}

      <LoginForm
        onSubmit={onSubmit}
        isLoading={isLoading}
        isBlocked={isBlocked}
        showPassword={showPassword}
        togglePassword={togglePassword}
        error={error}
        timeRemaining={timeRemaining}
        formatTimeRemaining={formatTimeRemaining}
        emailInputRef={emailInputRef}
      />
    </>
  );
};
