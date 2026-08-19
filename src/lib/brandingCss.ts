import type { CompanyBranding } from '@/types/branding';

interface ColorMapping {
  cssVar: string;
  lightField: keyof CompanyBranding;
  darkField: keyof CompanyBranding;
}

// Mapeia cada campo de cor do branding para a variável CSS correspondente
// (ver `globals.css` `body`/`body.dark`/`@theme inline`) — sobrescrita aqui
// é o que propaga a identidade visual do tenant para toda a aplicação.
const COLOR_MAPPINGS: ColorMapping[] = [
  { cssVar: '--color-brand-primary', lightField: 'primary_color', darkField: 'primary_color_dark' },
  { cssVar: '--color-brand-primary-hover', lightField: 'secondary_color', darkField: 'secondary_color_dark' },
  { cssVar: '--color-accent', lightField: 'accent_color', darkField: 'accent_color_dark' },
  { cssVar: '--color-success', lightField: 'success_color', darkField: 'success_color_dark' },
  { cssVar: '--color-warning', lightField: 'warning_color', darkField: 'warning_color_dark' },
  { cssVar: '--color-error', lightField: 'error_color', darkField: 'error_color_dark' },
  { cssVar: '--color-info', lightField: 'info_color', darkField: 'info_color_dark' },
  { cssVar: '--color-bg-page', lightField: 'bg_color', darkField: 'bg_color_dark' },
  { cssVar: '--color-bg-surface', lightField: 'card_color', darkField: 'card_color_dark' },
  { cssVar: '--color-border-default', lightField: 'border_color', darkField: 'border_color_dark' },
  { cssVar: '--color-text-primary', lightField: 'text_color', darkField: 'text_color_dark' },
];

function buildBlock(selector: string, branding: CompanyBranding, mode: 'light' | 'dark'): string {
  const lines: string[] = [];

  for (const { cssVar, lightField, darkField } of COLOR_MAPPINGS) {
    const lightValue = branding[lightField] as string | null;
    const value = mode === 'light' ? lightValue : ((branding[darkField] as string | null) ?? lightValue);
    if (value) lines.push(`  ${cssVar}: ${value};`);
  }

  // Aliases legados (`--color-brand`, `--color-brand-hover`, `--color-brand-logo`)
  // ainda consumidos por componentes existentes (Logo, checkboxes, etc.)
  const primary = mode === 'light'
    ? branding.primary_color
    : (branding.primary_color_dark ?? branding.primary_color);
  const secondary = mode === 'light'
    ? (branding.secondary_color ?? branding.primary_color)
    : (branding.secondary_color_dark ?? branding.secondary_color ?? branding.primary_color_dark ?? branding.primary_color);

  if (primary) {
    lines.push(`  --color-brand: ${primary};`);
    lines.push(`  --color-brand-logo-raw: ${mode === 'dark' ? '#ffffff' : primary};`);
  }
  if (secondary) lines.push(`  --color-brand-hover: ${secondary};`);

  if (lines.length === 0) return '';
  return [`${selector} {`, ...lines, '}'].join('\n');
}

export function buildBrandingCss(branding: CompanyBranding | null): string {
  if (!branding) return '';
  // `globals.css` redeclara essas mesmas custom properties diretamente em `body`/`body.dark`
  // (não em `:root`/`.dark`) com os valores padrão. Como toda a aplicação vive dentro de
  // `<body>`, uma redeclaração no próprio elemento sempre vence o que seria herdado de
  // `:root` — por isso o override do tenant precisa mirar os MESMOS seletores (`body`/
  // `body.dark`), vencendo pela ordem de declaração (este `<style>` é injetado depois do
  // `globals.css` no documento), e não por especificidade.
  const blocks = [buildBlock('body', branding, 'light'), buildBlock('body.dark', branding, 'dark')];
  return blocks.filter(Boolean).join('\n');
}
