'use client';

import { useAuth } from '@/contexts/AuthContext';
import { useRouter } from 'next/navigation';
import { ReactNode, useEffect, useState } from 'react';

interface SuperAdminOnlyProps {
  children: ReactNode;
}

export default function SuperAdminOnly({ children }: SuperAdminOnlyProps) {
  const { user, isLoading } = useAuth();
  const router = useRouter();
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  useEffect(() => {
    if (!mounted || isLoading) return;

    if (!user || user.role !== 'SUPER_ADMIN') {
      router.push('/dashboard');
      return;
    }
  }, [user, isLoading, mounted, router]);

  if (isLoading || !mounted) {
    return <div className="flex items-center justify-center min-h-screen">Carregando...</div>;
  }

  if (!user || user.role !== 'SUPER_ADMIN') {
    return null;
  }

  return <>{children}</>;
}
