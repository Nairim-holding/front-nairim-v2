import { beforeEach, describe, expect, it, vi } from 'vitest';
const theme = vi.hoisted(() => ({ bgSurface: '#ffffff', bgSubtle: '#f1f5f9', borderSoft: '#e2e8f0', textPrimary: '#0f172a', textSecondary: '#475569' }));
vi.mock('@/utils/getThemeTokens', () => ({ getThemeTokens: () => theme }));
import { buildCustomTooltipHTML } from './echartsTooltip';
describe('tooltip seguro e adaptado ao tema', () => {
  beforeEach(() => { theme.bgSurface = '#ffffff'; theme.bgSubtle = '#f1f5f9'; });
  it('escapa textos do banco e rejeita cores com HTML/CSS injetado', () => {
    const html = buildCustomTooltipHTML('<img src=x onerror=alert(1)>', [{ label: '<script>x</script>', value: '" onclick="x', color: 'red;" onmouseover="x', formattedValue: '<b>valor</b>' }]);
    expect(html).toContain('&lt;img');
    expect(html).toContain('&lt;script&gt;');
    expect(html).toContain('&lt;b&gt;valor&lt;/b&gt;');
    expect(html).not.toContain('<img');
    expect(html).not.toContain('<script>');
    expect(html).not.toContain('onmouseover');
    expect(html).toContain('background-color: #3b82f6');
  });
  it('usa a superfície escura e destaca o saldo com o mesmo fundo do cabeçalho', () => {
    theme.bgSurface = '#12101d'; theme.bgSubtle = '#211a37';
    const html = buildCustomTooltipHTML('Jan/2026', [{ label: 'Saldo', value: -123.45, emphasized: true }]);
    expect(html).toContain('background-color: #12101d');
    expect(html.match(/background-color: #211a37/g)).toHaveLength(2);
    expect(html).toContain('123,45');
  });
});
