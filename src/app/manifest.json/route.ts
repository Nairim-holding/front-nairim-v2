import type { MetadataRoute } from 'next';
import { NextResponse } from 'next/server';
import { getActiveBranding } from '@/lib/fetchBranding';
import { isSafeBrandingColor } from '@/shared/validators/branding-color';

export const dynamic = 'force-dynamic';

export async function GET() {
  const { branding, name } = await getActiveBranding();
  const icon = branding?.favicon_url || '/app-icon.svg';
  const manifest: MetadataRoute.Manifest = {
    id: '/',
    name: branding?.app_title || branding?.trade_name || name,
    short_name: branding?.trade_name || name,
    description: branding?.app_description || `Plataforma de gestão imobiliária — ${name}`,
    theme_color: isSafeBrandingColor(branding?.primary_color) ? branding.primary_color : '#334155',
    background_color: isSafeBrandingColor(branding?.bg_color) ? branding.bg_color : '#ffffff',
    display: 'standalone',
    scope: '/',
    start_url: '/',
    orientation: 'any',
    icons: [{ src: icon, sizes: 'any', purpose: 'any', ...(icon === '/app-icon.svg' ? { type: 'image/svg+xml' } : {}) }],
  };

  // O branding segue a empresa ativa: nunca compartilhar esta resposta entre empresas.
  return NextResponse.json(manifest, {
    headers: {
      'Content-Type': 'application/manifest+json',
      'Cache-Control': 'private, no-store',
      Vary: 'Cookie',
    },
  });
}
