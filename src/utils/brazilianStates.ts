/**
 * Unidades federativas do Brasil.
 *
 * Estava duplicada em PropertyFilter (array local) e GuarantorManager (27
 * `<option>` escritos à mão). Centralizado aqui para os campos de UF do
 * sistema saírem sempre da mesma lista.
 */

export const BRAZILIAN_STATES = [
  'AC', 'AL', 'AP', 'AM', 'BA', 'CE', 'DF', 'ES', 'GO', 'MA',
  'MT', 'MS', 'MG', 'PA', 'PB', 'PR', 'PE', 'PI', 'RJ', 'RN',
  'RS', 'RO', 'RR', 'SC', 'SP', 'SE', 'TO',
] as const;

export type BrazilianState = (typeof BRAZILIAN_STATES)[number];

/** No formato `{ label, value }` que o Select do sistema espera. */
export const BRAZILIAN_STATE_OPTIONS = BRAZILIAN_STATES.map((uf) => ({ label: uf, value: uf }));
