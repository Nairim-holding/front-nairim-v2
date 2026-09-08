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
});
