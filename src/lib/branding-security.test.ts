import { describe, expect, it } from 'vitest';
import { buildBrandingCss } from './brandingCss';
import { pickBrandingFields } from '@/shared/validators/company';
import type { CompanyBranding } from '@/types/branding';

describe('branding injection protection', () => {
  it.each(['</style><script>alert(1)</script>', 'red; } body { background:url(https://evil.test)', 'url(https://evil.test)', '<svg onload=alert(1)>'])
   ('rejects malicious color values at input and rendering', (value) => {
      expect(() => pickBrandingFields({ primary_color: value })).toThrow();
      const css = buildBrandingCss({ primary_color: value, secondary_color_dark: value } as CompanyBranding);
      expect(css).not.toContain(value);
      expect(css).not.toContain('<');
      expect(css).not.toContain('url(');
    });
  it('preserves valid colors and dark-mode fallback', () => {
    expect(pickBrandingFields({ primary_color: '#123456' })).toEqual({ primary_color: '#123456' });
    const css = buildBrandingCss({ primary_color: '#123456' } as CompanyBranding);
    expect(css).toContain('body.dark');
    expect(css).toContain('--color-brand: #123456;');
  });
  it('does not paint dark-mode cards white when only light branding is configured', () => {
    const css = buildBrandingCss({ primary_color: '#123456', card_color: '#ffffff', text_color: '#111111' } as CompanyBranding);
    const dark = css.split('body.dark')[1];
    expect(dark).not.toContain('--color-bg-surface: #ffffff');
    expect(dark).not.toContain('--color-text-primary: #111111');
    expect(dark).toContain('--color-brand-primary: #123456');
  });
  it('honors an explicit dark card color', () => {
    const css = buildBrandingCss({ card_color: '#ffffff', card_color_dark: '#202020' } as CompanyBranding);
    expect(css.split('body.dark')[1]).toContain('--color-bg-surface: #202020');
  });
});
