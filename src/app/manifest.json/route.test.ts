import { beforeEach, describe, expect, it, vi } from 'vitest';

const getActiveBranding = vi.hoisted(() => vi.fn());
vi.mock('@/lib/fetchBranding', () => ({ getActiveBranding }));

import { GET } from './route';

describe('manifest da empresa ativa', () => {
  beforeEach(() => getActiveBranding.mockReset());

  it('usa a identidade configurada e impede cache compartilhado entre empresas', async () => {
    getActiveBranding.mockResolvedValue({
      name: 'I Holding',
      branding: {
        trade_name: 'I Holding', app_title: 'I Holding Imóveis',
        app_description: 'Gestão da I Holding',
        favicon_url: 'https://cdn.iholding.com.br/imagens/icon.png',
        primary_color: '#123456', bg_color: '#ffffff',
      },
    });
    const response = await GET();
    const manifest = await response.json();
    expect(manifest.name).toBe('I Holding Imóveis');
    expect(manifest.icons[0].src).toBe('https://cdn.iholding.com.br/imagens/icon.png');
    expect(manifest.theme_color).toBe('#123456');
    expect(response.headers.get('Cache-Control')).toBe('private, no-store');
    expect(response.headers.get('Vary')).toBe('Cookie');
  });

  it('na empresa sem personalizacao, usa seu nome e um icone neutro', async () => {
    getActiveBranding.mockResolvedValue({ name: 'Outra empresa', branding: null });
    const response = await GET();
    const manifest = await response.json();
    expect(manifest.name).toBe('Outra empresa');
    expect(manifest.short_name).toBe('Outra empresa');
    expect(manifest.icons[0].src).toBe('/app-icon.svg');
    expect(JSON.stringify(manifest)).not.toMatch(/nairim/i);
  });
});
