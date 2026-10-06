import { cookies } from 'next/headers';
import type { CompanyBranding } from '@/types/branding';
import { getPublicBrandingData } from '@/server/queries/company';
import { getPublicSiteCompanySlug } from '@/server/queries/public-site';

const COMPANY_SLUG = process.env.NEXT_PUBLIC_COMPANY_SLUG ?? 'nairim';
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

// Visitantes usam a empresa da vitrine salva no banco. Sessoes autenticadas
// usam sua propria empresa. Tambem usado por `generateMetadata` em
// layouts aninhados (`/dashboard`, `/login`) que precisam do mesmo título dinâmico
// do layout raiz, em vez do `NEXT_PUBLIC_COMPANY_NAME` fixo do `.env`.
export async function getActiveBranding(): Promise<{ branding: CompanyBranding | null; name: string }> {
  const cookieStore = await cookies();
  let slug = cookieStore.get('authToken')?.value ? cookieStore.get('company_slug')?.value ?? COMPANY_SLUG : COMPANY_SLUG;
  if (!cookieStore.get('authToken')?.value) {
    try { slug = await getPublicSiteCompanySlug(); } catch { return { branding: null, name: FALLBACK_NAME }; }
  }
  const branding = await fetchBranding(slug);
  const name = branding?.company_name ?? FALLBACK_NAME;
  return { branding, name };
}
