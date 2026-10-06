/** Equivalence requires the full semantic path, never a tenant-specific UUID. */
export function reportingIdentity(...parts: (string | null | undefined)[]): string {
  return JSON.stringify(parts.map(value => (value ?? '').normalize('NFC').trim().replace(/\s+/g, ' ').toLocaleLowerCase('pt-BR')));
}
