/** The color picker stores hex colors. Never interpolate arbitrary CSS/HTML. */
export function isSafeBrandingColor(value: unknown): value is string {
  return typeof value === 'string' && /^#(?:[0-9a-f]{3}|[0-9a-f]{4}|[0-9a-f]{6}|[0-9a-f]{8})$/i.test(value);
}
