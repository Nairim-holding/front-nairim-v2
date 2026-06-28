'use client';

import { useState, useEffect } from 'react';

// Configuration constant - easy to change
const MAX_LOGIN_ATTEMPTS = 5;
const BLOCK_DURATION_SECONDS = 300; // 5 minutes

interface RateLimitState {
  failedAttempts: number;
  isBlocked: boolean;
  timeRemaining: number;
  initialTime: number;
}

export const useRateLimit = () => {
  const [state, setState] = useState<RateLimitState>({
    failedAttempts: 0,
    isBlocked: false,
    timeRemaining: 0,
    initialTime: 0,
  });

  // Load rate limiting state from localStorage on mount (client-side only)
  useEffect(() => {
    const storedAttempts = localStorage.getItem('loginFailedAttempts');
    const storedBlockExpiry = localStorage.getItem('loginBlockExpiry');
    
    const newState: Partial<RateLimitState> = {};
    
    if (storedAttempts) {
      newState.failedAttempts = parseInt(storedAttempts, 10);
    }
    
    if (storedBlockExpiry) {
      const expiryTime = parseInt(storedBlockExpiry, 10);
      const now = Date.now();
      
      if (now < expiryTime) {
        const remaining = Math.ceil((expiryTime - now) / 1000);
        newState.isBlocked = true;
        newState.timeRemaining = remaining;
        newState.initialTime = remaining;
      } else {
        // Block expired, clear stored data
        localStorage.removeItem('loginFailedAttempts');
        localStorage.removeItem('loginBlockExpiry');
        newState.failedAttempts = 0;
      }
    }
    
    if (Object.keys(newState).length > 0) {
      // Use setTimeout to avoid synchronous setState in effect
      setTimeout(() => {
        setState(prev => ({ ...prev, ...newState }));
      }, 0);
    }
  }, []);

  // Timer countdown effect
  useEffect(() => {
    if (state.isBlocked && state.timeRemaining > 0) {
      const timer = setTimeout(() => {
        setState(prev => ({ ...prev, timeRemaining: prev.timeRemaining - 1 }));
      }, 1000);
      
      return () => clearTimeout(timer);
    } else if (state.isBlocked && state.timeRemaining === 0) {
      // Timer expired, unblock user
      // Use setTimeout to avoid synchronous setState in effect
      setTimeout(() => {
        setState({
          failedAttempts: 0,
          isBlocked: false,
          timeRemaining: 0,
          initialTime: 0,
        });
        localStorage.removeItem('loginFailedAttempts');
        localStorage.removeItem('loginBlockExpiry');
      }, 0);
    }
  }, [state.isBlocked, state.timeRemaining]);

  const incrementFailedAttempts = () => {
    const newAttempts = state.failedAttempts + 1;
    setState(prev => ({ ...prev, failedAttempts: newAttempts }));
    localStorage.setItem('loginFailedAttempts', newAttempts.toString());

    // Auto-block after MAX_LOGIN_ATTEMPTS failed attempts
    if (newAttempts >= MAX_LOGIN_ATTEMPTS) {
      blockUser(BLOCK_DURATION_SECONDS);
    }

    return newAttempts;
  };

  const blockUser = (totalSeconds: number) => {
    const blockDuration = totalSeconds * 1000; // Convert to milliseconds
    const expiryTime = Date.now() + blockDuration;

    localStorage.setItem('loginBlockExpiry', expiryTime.toString());
    localStorage.setItem('loginFailedAttempts', MAX_LOGIN_ATTEMPTS.toString());

    setState({
      failedAttempts: MAX_LOGIN_ATTEMPTS,
      isBlocked: true,
      timeRemaining: totalSeconds,
      initialTime: totalSeconds,
    });
  };

  const handleRateLimitError = (errorMessage: string) => {
    // Extract time from message like "Tente novamente em 0m 52s."
    const timeMatch = errorMessage.match(/Tente novamente em (\d+m \d+s)/);
    
    if (timeMatch) {
      const timeString = timeMatch[1];
      const minutes = parseInt(timeString.match(/(\d+)m/)?.[1] || '0', 10);
      const seconds = parseInt(timeString.match(/(\d+)s/)?.[1] || '0', 10);
      const totalSeconds = minutes * 60 + seconds;
      
      blockUser(totalSeconds);
    } else {
      // Fallback to 5 minutes if time parsing fails
      blockUser(300);
    }
  };

  const resetAttempts = () => {
    setState({
      failedAttempts: 0,
      isBlocked: false,
      timeRemaining: 0,
      initialTime: 0,
    });
    localStorage.removeItem('loginFailedAttempts');
    localStorage.removeItem('loginBlockExpiry');
  };

  const formatTimeRemaining = (seconds: number) => {
    const minutes = Math.floor(seconds / 60);
    const remainingSeconds = seconds % 60;
    return `${minutes}m ${remainingSeconds}s`;
  };

  const getAttemptWarningColor = () => {
    if (state.failedAttempts === 0) return '';
    if (state.failedAttempts <= 2) return 'text-yellow-600 bg-yellow-50 border-yellow-200';
    if (state.failedAttempts <= 4) return 'text-orange-600 bg-orange-50 border-orange-200';
    return 'text-red-600 bg-red-50 border-red-200';
  };

  const getMaxLoginAttempts = () => MAX_LOGIN_ATTEMPTS;

  const updateFromBackendStatus = (backendAttempts: number, isBlocked: boolean, blockedUntilSeconds?: number) => {
    localStorage.setItem('loginFailedAttempts', backendAttempts.toString());

    if (isBlocked && blockedUntilSeconds) {
      const expiryTime = Date.now() + blockedUntilSeconds * 1000;
      localStorage.setItem('loginBlockExpiry', expiryTime.toString());
      setState({
        failedAttempts: backendAttempts,
        isBlocked: true,
        timeRemaining: blockedUntilSeconds,
        initialTime: blockedUntilSeconds,
      });
    } else {
      setState(prev => ({ ...prev, failedAttempts: backendAttempts }));
    }
  };

  return {
    ...state,
    incrementFailedAttempts,
    handleRateLimitError,
    resetAttempts,
    formatTimeRemaining,
    getAttemptWarningColor,
    getMaxLoginAttempts,
    updateFromBackendStatus,
  };
};
