'use client';

import { createContext, useContext, useMemo, type ReactNode } from 'react';
import type { CompanyBranding } from '@/types/branding';

interface BrandingContextValue {
  branding: CompanyBranding | null;
  companyName: string;
  logoUrl: string | null;
  faviconUrl: string | null;
  primaryColor: string;
  secondaryColor: string;
}

const DEFAULT_PRIMARY = '#8b5cf6';
const DEFAULT_SECONDARY = '#6d28d9';
const DEFAULT_NAME = process.env.NEXT_PUBLIC_COMPANY_NAME ?? 'Sistema';

const BrandingContext = createContext<BrandingContextValue>({
  branding: null,
  companyName: DEFAULT_NAME,
  logoUrl: null,
  faviconUrl: null,
  primaryColor: DEFAULT_PRIMARY,
  secondaryColor: DEFAULT_SECONDARY,
});

export function BrandingProvider({
  children,
  initialBranding,
}: {
  children: ReactNode;
  initialBranding?: CompanyBranding | null;
}) {
  const value = useMemo<BrandingContextValue>(() => {
    const b = initialBranding ?? null;
    return {
      branding: b,
      companyName: b?.company_name ?? DEFAULT_NAME,
      logoUrl: b?.logo_url ?? null,
      faviconUrl: b?.favicon_url ?? null,
      primaryColor: b?.primary_color ?? DEFAULT_PRIMARY,
      secondaryColor: b?.secondary_color ?? DEFAULT_SECONDARY,
    };
  }, [initialBranding]);

  return <BrandingContext.Provider value={value}>{children}</BrandingContext.Provider>;
}

export function useBranding(): BrandingContextValue {
  return useContext(BrandingContext);
}
