'use client';

import { createContext, useContext, useMemo, type ReactNode } from 'react';
import type { CompanyBranding } from '@/types/branding';

export interface BrandingColorSet {
  primary: string;
  secondary: string;
  accent: string;
  success: string;
  warning: string;
  error: string;
  info: string;
  bg: string;
  card: string;
  border: string;
  text: string;
}

interface BrandingContextValue {
  branding: CompanyBranding | null;
  companyName: string;
  tradeName: string;
  appTitle: string;
  appDescription: string;
  logoUrl: string | null;
  logoSidebarUrl: string | null;
  logoDarkUrl: string | null;
  faviconUrl: string | null;
  ogImageUrl: string | null;
  primaryColor: string;
  secondaryColor: string;
  colors: { light: BrandingColorSet; dark: BrandingColorSet };
}

// Defaults espelham os valores definidos em `globals.css` (`body` / `body.dark`),
// garantindo consistência visual quando uma empresa não personalizou um campo.
const DEFAULT_NAME = process.env.NEXT_PUBLIC_COMPANY_NAME ?? 'Sistema';

const DEFAULT_LIGHT_COLORS: BrandingColorSet = {
  primary: '#8b5cf6',
  secondary: '#6d28d9',
  accent: '#ec4899',
  success: '#10b981',
  warning: '#f59e0b',
  error: '#ef4444',
  info: '#3b82f6',
  bg: '#ffffff',
  card: '#ffffff',
  border: '#cccccc',
  text: '#171717',
};

const DEFAULT_DARK_COLORS: BrandingColorSet = {
  primary: '#8b5cf6',
  secondary: '#7c3aed',
  accent: '#f472b6',
  success: '#10b981',
  warning: '#f59e0b',
  error: '#ef4444',
  info: '#60a5fa',
  bg: '#0f1115',
  card: '#12101d',
  border: '#4b5563',
  text: '#f3f4f6',
};

const DEFAULT_VALUE: BrandingContextValue = {
  branding: null,
  companyName: DEFAULT_NAME,
  tradeName: DEFAULT_NAME,
  appTitle: DEFAULT_NAME,
  appDescription: `Plataforma de gestão imobiliária — ${DEFAULT_NAME}`,
  logoUrl: null,
  logoSidebarUrl: null,
  logoDarkUrl: null,
  faviconUrl: null,
  ogImageUrl: null,
  primaryColor: DEFAULT_LIGHT_COLORS.primary,
  secondaryColor: DEFAULT_LIGHT_COLORS.secondary,
  colors: { light: DEFAULT_LIGHT_COLORS, dark: DEFAULT_DARK_COLORS },
};

const BrandingContext = createContext<BrandingContextValue>(DEFAULT_VALUE);

type ColorKey = keyof BrandingColorSet;

const LIGHT_FIELD_BY_KEY: Record<ColorKey, keyof CompanyBranding> = {
  primary: 'primary_color',
  secondary: 'secondary_color',
  accent: 'accent_color',
  success: 'success_color',
  warning: 'warning_color',
  error: 'error_color',
  info: 'info_color',
  bg: 'bg_color',
  card: 'card_color',
  border: 'border_color',
  text: 'text_color',
};

const DARK_FIELD_BY_KEY: Record<ColorKey, keyof CompanyBranding> = {
  primary: 'primary_color_dark',
  secondary: 'secondary_color_dark',
  accent: 'accent_color_dark',
  success: 'success_color_dark',
  warning: 'warning_color_dark',
  error: 'error_color_dark',
  info: 'info_color_dark',
  bg: 'bg_color_dark',
  card: 'card_color_dark',
  border: 'border_color_dark',
  text: 'text_color_dark',
};

function resolveColorSet(
  branding: CompanyBranding | null,
  fieldByKey: Record<ColorKey, keyof CompanyBranding>,
  fallback: BrandingColorSet,
  defaults: BrandingColorSet,
): BrandingColorSet {
  const result = {} as BrandingColorSet;
  (Object.keys(fieldByKey) as ColorKey[]).forEach((key) => {
    const value = branding?.[fieldByKey[key]] as string | null | undefined;
    result[key] = value ?? fallback[key] ?? defaults[key];
  });
  return result;
}

export function BrandingProvider({
  children,
  initialBranding,
}: {
  children: ReactNode;
  initialBranding?: CompanyBranding | null;
}) {
  const value = useMemo<BrandingContextValue>(() => {
    const b = initialBranding ?? null;
    const name = b?.company_name ?? DEFAULT_NAME;

    const light = resolveColorSet(b, LIGHT_FIELD_BY_KEY, DEFAULT_LIGHT_COLORS, DEFAULT_LIGHT_COLORS);
    // Mantém as cores da marca, usando fundos/textos próprios do tema escuro.
    const dark = resolveColorSet(b, DARK_FIELD_BY_KEY, {
      ...light, bg: DEFAULT_DARK_COLORS.bg, card: DEFAULT_DARK_COLORS.card,
      border: DEFAULT_DARK_COLORS.border, text: DEFAULT_DARK_COLORS.text,
    }, DEFAULT_DARK_COLORS);

    return {
      branding: b,
      companyName: name,
      tradeName: b?.trade_name ?? name,
      appTitle: b?.app_title ?? name,
      appDescription: b?.app_description ?? `Plataforma de gestão imobiliária — ${name}`,
      logoUrl: b?.logo_url ?? null,
      logoSidebarUrl: b?.logo_sidebar_url ?? b?.logo_url ?? null,
      logoDarkUrl: b?.logo_dark_url ?? null,
      faviconUrl: b?.favicon_url ?? null,
      ogImageUrl: b?.og_image_url ?? null,
      primaryColor: light.primary,
      secondaryColor: light.secondary,
      colors: { light, dark },
    };
  }, [initialBranding]);

  return <BrandingContext.Provider value={value}>{children}</BrandingContext.Provider>;
}

export function useBranding(): BrandingContextValue {
  return useContext(BrandingContext);
}
