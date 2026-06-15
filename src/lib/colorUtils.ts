/**
 * Utilitários para conversão de cores entre light e dark mode
 */

/**
 * Converte uma cor hex para RGB
 */
function hexToRgb(hex: string): { r: number; g: number; b: number } | null {
  const result = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex);
  return result
    ? {
        r: parseInt(result[1], 16),
        g: parseInt(result[2], 16),
        b: parseInt(result[3], 16),
      }
    : null;
}

/**
 * Converte RGB para HSL
 */
function rgbToHsl(r: number, g: number, b: number): { h: number; s: number; l: number } {
  r /= 255;
  g /= 255;
  b /= 255;

  const max = Math.max(r, g, b);
  const min = Math.min(r, g, b);
  let h = 0;
  let s = 0;
  const l = (max + min) / 2;

  if (max !== min) {
    const d = max - min;
    s = l > 0.5 ? d / (2 - max - min) : d / (max + min);

    switch (max) {
      case r:
        h = ((g - b) / d + (g < b ? 6 : 0)) / 6;
        break;
      case g:
        h = ((b - r) / d + 2) / 6;
        break;
      case b:
        h = ((r - g) / d + 4) / 6;
        break;
    }
  }

  return { h: h * 360, s: s * 100, l: l * 100 };
}

/**
 * Converte HSL para RGB
 */
function hslToRgb(h: number, s: number, l: number): { r: number; g: number; b: number } {
  h /= 360;
  s /= 100;
  l /= 100;

  let r: number, g: number, b: number;

  if (s === 0) {
    r = g = b = l;
  } else {
    const hue2rgb = (p: number, q: number, t: number) => {
      if (t < 0) t += 1;
      if (t > 1) t -= 1;
      if (t < 1 / 6) return p + (q - p) * 6 * t;
      if (t < 1 / 2) return q;
      if (t < 2 / 3) return p + (q - p) * (2 / 3 - t) * 6;
      return p;
    };

    const q = l < 0.5 ? l * (1 + s) : l + s - l * s;
    const p = 2 * l - q;

    r = hue2rgb(p, q, h + 1 / 3);
    g = hue2rgb(p, q, h);
    b = hue2rgb(p, q, h - 1 / 3);
  }

  return {
    r: Math.round(r * 255),
    g: Math.round(g * 255),
    b: Math.round(b * 255),
  };
}

/**
 * Converte RGB para Hex
 */
function rgbToHex(r: number, g: number, b: number): string {
  return '#' + [r, g, b].map(x => {
    const hex = x.toString(16);
    return hex.length === 1 ? '0' + hex : hex;
  }).join('');
}

/**
 * Ajusta a luminância de uma cor
 */
function adjustLuminance(hex: string, targetLuminance: number): string {
  const rgb = hexToRgb(hex);
  if (!rgb) return hex;

  const hsl = rgbToHsl(rgb.r, rgb.g, rgb.b);
  hsl.l = targetLuminance;

  const newRgb = hslToRgb(hsl.h, hsl.s, hsl.l);
  return rgbToHex(newRgb.r, newRgb.g, newRgb.b);
}

/**
 * Escurece uma cor
 */
function darkenColor(hex: string, amount: number): string {
  const rgb = hexToRgb(hex);
  if (!rgb) return hex;

  const hsl = rgbToHsl(rgb.r, rgb.g, rgb.b);
  hsl.l = Math.max(0, hsl.l - amount);

  const newRgb = hslToRgb(hsl.h, hsl.s, hsl.l);
  return rgbToHex(newRgb.r, newRgb.g, newRgb.b);
}

/**
 * Clareia uma cor
 */
function lightenColor(hex: string, amount: number): string {
  const rgb = hexToRgb(hex);
  if (!rgb) return hex;

  const hsl = rgbToHsl(rgb.r, rgb.g, rgb.b);
  hsl.l = Math.min(100, hsl.l + amount);

  const newRgb = hslToRgb(hsl.h, hsl.s, hsl.l);
  return rgbToHex(newRgb.r, newRgb.g, newRgb.b);
}

/**
 * Calcula a luminância relativa de uma cor (0-1)
 */
function getRelativeLuminance(hex: string): number {
  const rgb = hexToRgb(hex);
  if (!rgb) return 0.5;

  const a = [rgb.r, rgb.g, rgb.b].map(v => {
    v /= 255;
    return v <= 0.03928 ? v / 12.92 : Math.pow((v + 0.055) / 1.055, 2.4);
  });

  return a[0] * 0.2126 + a[1] * 0.7152 + a[2] * 0.0722;
}

/**
 * Determina se uma cor é escura
 */
function isDarkColor(hex: string): boolean {
  return getRelativeLuminance(hex) < 0.5;
}

/**
 * Converte uma cor light para dark baseada no tipo de cor
 */
export function convertLightToDarkColor(lightColor: string, colorType: string): string {
  if (!lightColor || !lightColor.startsWith('#')) {
    return lightColor;
  }

  const rgb = hexToRgb(lightColor);
  if (!rgb) return lightColor;

  const hsl = rgbToHsl(rgb.r, rgb.g, rgb.b);

  switch (colorType) {
    case 'bg_color':
    case 'card_color':
      // Fundo escuro para dark mode
      return adjustLuminance(lightColor, isDarkColor(lightColor) ? hsl.l : 10);

    case 'text_color':
      // Texto claro para dark mode
      return isDarkColor(lightColor) ? lightColor : '#f3f4f6';

    case 'border_color':
      // Bordas mais escuras
      return darkenColor(lightColor, 20);

    case 'primary_color':
    case 'secondary_color':
    case 'accent_color':
      // Cores funcionais: clarear levemente para melhor contraste em fundo escuro
      if (isDarkColor(lightColor)) {
        return lightColor;
      }
      // Aumentar luminância em 15-20% para melhor visibilidade em fundo escuro
      return lightenColor(lightColor, 15);

    case 'success_color':
    case 'warning_color':
    case 'error_color':
    case 'info_color':
      // Cores de estado: manter saturação, ajustar luminância para fundo escuro
      if (isDarkColor(lightColor)) {
        return lightColor;
      }
      // Clarear um pouco para melhor contraste
      return lightenColor(lightColor, 10);

    default:
      return lightColor;
  }
}

/**
 * Gera todas as cores dark mode baseadas nas cores light mode
 */
export function generateDarkColorsFromLight(lightColors: Record<string, string>): Record<string, string> {
  const darkColors: Record<string, string> = {};

  const colorMappings: Record<string, string> = {
    primary_color: 'primary_color',
    secondary_color: 'secondary_color',
    accent_color: 'accent_color',
    success_color: 'success_color',
    warning_color: 'warning_color',
    error_color: 'error_color',
    info_color: 'info_color',
    bg_color: 'bg_color',
    card_color: 'card_color',
    border_color: 'border_color',
    text_color: 'text_color',
  };

  for (const [lightKey, darkKey] of Object.entries(colorMappings)) {
    const lightColor = lightColors[lightKey];
    if (lightColor) {
      darkColors[`${darkKey}_dark`] = convertLightToDarkColor(lightColor, darkKey);
    }
  }

  return darkColors;
}
