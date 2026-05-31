import type { CompanyBranding } from '@/types/branding';

const API_URL = process.env.NEXT_PUBLIC_URL_API ?? '';

export async function fetchBranding(slug: string | undefined): Promise<CompanyBranding | null> {
  if (!slug) return null;
  try {
    const res = await fetch(`${API_URL}/company/branding?slug=${encodeURIComponent(slug)}`, {
      next: { revalidate: 300 },
    });
    if (!res.ok) return null;
    const json = await res.json();
    return (json?.data?.branding ?? null) as CompanyBranding | null;
  } catch {
    return null;
  }
}
