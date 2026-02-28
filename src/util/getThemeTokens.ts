export interface ThemeTokens {
  brandPrimary: string;
  brandPrimaryHover: string;
  textPrimary: string;
  textSecondary: string;
  textMuted: string;
  textInverse: string;
  bgSurface: string;
  bgSubtle: string;
  borderDefault: string;
  borderSoft: string;
  overlay: string;
  chartSeries: [string, string, string, string, string, string];
  mapMaskFill: string;
  mapMaskStroke: string;
  mapOcean: string;
  success: string;
  warning: string;
  error: string;
}

const FALLBACK_TOKENS: ThemeTokens = {
  brandPrimary: "#8B5CF6",
  brandPrimaryHover: "#6D28D9",
  textPrimary: "#171717",
  textSecondary: "#111111B2",
  textMuted: "#666666",
  textInverse: "#FFFFFF",
  bgSurface: "#FFFFFF",
  bgSubtle: "#F3F4F6",
  borderDefault: "#CCCCCC",
  borderSoft: "#E5E7EB",
  overlay: "rgba(0, 0, 0, 0.5)",
  chartSeries: ["#8B5CF6", "#10B981", "#F59E0B", "#3B82F6", "#EF4444", "#EC4899"],
  mapMaskFill: "#374151",
  mapMaskStroke: "#4B5563",
  mapOcean: "#E5E7EB",
  success: "#10B981",
  warning: "#F59E0B",
  error: "#EF4444",
};

function readToken(styles: CSSStyleDeclaration, token: string, fallback: string): string {
  const value = styles.getPropertyValue(token).trim();
  return value || fallback;
}

export function getThemeTokens(): ThemeTokens {
  if (typeof document === "undefined") {
    return FALLBACK_TOKENS;
  }

  const styles = getComputedStyle(document.body);

  return {
    brandPrimary: readToken(styles, "--color-brand-primary", FALLBACK_TOKENS.brandPrimary),
    brandPrimaryHover: readToken(styles, "--color-brand-primary-hover", FALLBACK_TOKENS.brandPrimaryHover),
    textPrimary: readToken(styles, "--color-text-primary", FALLBACK_TOKENS.textPrimary),
    textSecondary: readToken(styles, "--color-text-secondary", FALLBACK_TOKENS.textSecondary),
    textMuted: readToken(styles, "--color-text-muted", FALLBACK_TOKENS.textMuted),
    textInverse: readToken(styles, "--color-text-inverse", FALLBACK_TOKENS.textInverse),
    bgSurface: readToken(styles, "--color-bg-surface", FALLBACK_TOKENS.bgSurface),
    bgSubtle: readToken(styles, "--color-bg-subtle", FALLBACK_TOKENS.bgSubtle),
    borderDefault: readToken(styles, "--color-border-default", FALLBACK_TOKENS.borderDefault),
    borderSoft: readToken(styles, "--color-border-soft", FALLBACK_TOKENS.borderSoft),
    overlay: readToken(styles, "--color-overlay", FALLBACK_TOKENS.overlay),
    chartSeries: [
      readToken(styles, "--chart-series-1", FALLBACK_TOKENS.chartSeries[0]),
      readToken(styles, "--chart-series-2", FALLBACK_TOKENS.chartSeries[1]),
      readToken(styles, "--chart-series-3", FALLBACK_TOKENS.chartSeries[2]),
      readToken(styles, "--chart-series-4", FALLBACK_TOKENS.chartSeries[3]),
      readToken(styles, "--chart-series-5", FALLBACK_TOKENS.chartSeries[4]),
      readToken(styles, "--chart-series-6", FALLBACK_TOKENS.chartSeries[5]),
    ],
    mapMaskFill: readToken(styles, "--color-map-mask-fill", FALLBACK_TOKENS.mapMaskFill),
    mapMaskStroke: readToken(styles, "--color-map-mask-stroke", FALLBACK_TOKENS.mapMaskStroke),
    mapOcean: readToken(styles, "--color-map-ocean", FALLBACK_TOKENS.mapOcean),
    success: readToken(styles, "--color-success", FALLBACK_TOKENS.success),
    warning: readToken(styles, "--color-warning", FALLBACK_TOKENS.warning),
    error: readToken(styles, "--color-error", FALLBACK_TOKENS.error),
  };
}
