import { cookies } from 'next/headers';
import type { CompanyBranding } from '@/types/branding';
import { getPublicBrandingData } from '@/server/queries/company';

const COMPANY_SLUG = 'nairim';
const FALLBACK_NAME = process.env.NEXT_PUBLIC_COMPANY_NAME ?? 'Sistema';

export async function fetchBranding(slug: string | undefined): Promise<CompanyBranding | null> {
  if (!slug) return null;
  try {
    const result = await getPublicBrandingData(slug);
    return (result?.branding ?? null) as CompanyBranding | null;
  } catch {
    return null;
  }
}

// Resolve o branding da empresa ativa (cookie `company_slug`, com fallback para o
// slug configurado via env) e o nome a exibir — usado por `generateMetadata` em
// layouts aninhados (`/dashboard`, `/login`) que precisam do mesmo título dinâmico
// do layout raiz, em vez do `NEXT_PUBLIC_COMPANY_NAME` fixo do `.env`.
export async function getActiveBranding(): Promise<{ branding: CompanyBranding | null; name: string }> {
  const cookieStore = await cookies();
  const slug = cookieStore.get('company_slug')?.value ?? COMPANY_SLUG;
  const branding = await fetchBranding(slug);
  const name = branding?.company_name ?? FALLBACK_NAME;
  return { branding, name };
}
