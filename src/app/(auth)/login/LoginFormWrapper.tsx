'use client';

import React, { useState, useRef } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/contexts/AuthContext';
import { useRateLimit } from '@/hooks/useRateLimit';
import { LoginForm } from '@/components/auth/Form';
import { RateLimitWarning } from '@/components/auth/RateLimitWarning';
import { RateLimitBlocked } from '@/components/auth/RateLimitBlocked';
import { ApiResponse } from '@/types/types';

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
    incrementFailedAttempts,
    handleRateLimitError,
    resetAttempts,
    formatTimeRemaining,
    getAttemptWarningColor,
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
      const response = await fetch(
        `${process.env.NEXT_PUBLIC_URL_API}/auth/login`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({ email, password }),
        }
      );

      const data: ApiResponse = await response.json();

      if (!response.ok || !data.success) {
        throw new Error(data.message || `HTTP error! status: ${response.status}`);
      }
      
      // Successful login - reset failed attempts
      resetAttempts();

      // Slug da empresa: vem da URL /[slug]/login ou da resposta do login
      const slug = companySlug ?? data.data.user.company_slug ?? '';
      if (slug) {
        document.cookie = `company_slug=${slug}; path=/; SameSite=Lax`;
      }

      login(data.data.token, data.data.user);

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
        } else {
          // Regular login error - increment failed attempts
          incrementFailedAttempts();
        }
      } else if (typeof err === 'string') {
        errorMessage = err;
        incrementFailedAttempts();
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
          warningColor={getAttemptWarningColor()}
        />
      )}

      {/* Blocked State */}
      {isBlocked && (
        <RateLimitBlocked 
          timeRemaining={timeRemaining}
          initialTime={initialTime}
          formatTimeRemaining={formatTimeRemaining}
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
