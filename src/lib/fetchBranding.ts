import { cookies } from 'next/headers';
import type { CompanyBranding } from '@/types/branding';

const API_URL = process.env.NEXT_PUBLIC_URL_API ?? '';
const COMPANY_SLUG = 'nairim';
const FALLBACK_NAME = process.env.NEXT_PUBLIC_COMPANY_NAME ?? 'Sistema';

export async function fetchBranding(slug: string | undefined): Promise<CompanyBranding | null> {
  if (!slug) return null;
  try {
    // O backend já mantém um cache em memória (60s, invalidado em updateBranding/upload).
    // Usar `no-store` aqui evita que o Data Cache do Next.js sirva uma versão obsoleta
    // por até 5 minutos após salvar configurações ou trocar de empresa (router.refresh()
    // não invalida o cache de `fetch`, só o Router Cache do cliente).
    const res = await fetch(`${API_URL}/company/branding?slug=${encodeURIComponent(slug)}`, {
      cache: 'no-store',
    });
    if (!res.ok) return null;
    const json = await res.json();
    return (json?.data?.branding ?? null) as CompanyBranding | null;
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
