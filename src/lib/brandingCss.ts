import type { CompanyBranding } from '@/types/branding';

export function buildBrandingCss(branding: CompanyBranding | null): string {
  const p = branding?.primary_color;
  const s = branding?.secondary_color ?? p;
  if (!p) return '';
  return [
    ':root {',
    `  --color-brand: ${p};`,
    `  --color-brand-hover: ${s};`,
    `  --color-brand-primary: ${p};`,
    `  --color-brand-primary-hover: ${s};`,
    `  --color-brand-logo: ${p};`,
    '}',
    '.dark {',
    `  --color-brand: ${p};`,
    `  --color-brand-hover: ${s};`,
    `  --color-brand-primary: ${p};`,
    `  --color-brand-primary-hover: ${s};`,
    '  --color-brand-logo: #ffffff;',
    '}',
  ].join('\n');
}
