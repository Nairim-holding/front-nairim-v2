export const COLOR_FIELDS = [
  { key: 'primary_color', label: 'Primária', defaultValue: '#8b5cf6', darkDefault: '#8b5cf6', group: 'Marca' },
  { key: 'secondary_color', label: 'Secundária / hover', defaultValue: '#6d28d9', darkDefault: '#7c3aed', group: 'Marca' },
  { key: 'accent_color', label: 'Destaque', defaultValue: '#ec4899', darkDefault: '#f472b6', group: 'Marca' },
  { key: 'bg_color', label: 'Fundo da página', defaultValue: '#ffffff', darkDefault: '#0f1115', group: 'Superfícies e texto' },
  { key: 'card_color', label: 'Fundo dos cards', defaultValue: '#ffffff', darkDefault: '#12101d', group: 'Superfícies e texto' },
  { key: 'border_color', label: 'Bordas', defaultValue: '#cccccc', darkDefault: '#4b5563', group: 'Superfícies e texto' },
  { key: 'text_color', label: 'Texto principal', defaultValue: '#171717', darkDefault: '#f3f4f6', group: 'Superfícies e texto' },
  { key: 'success_color', label: 'Sucesso', defaultValue: '#10b981', darkDefault: '#10b981', group: 'Estados e avisos' },
  { key: 'warning_color', label: 'Aviso', defaultValue: '#f59e0b', darkDefault: '#f59e0b', group: 'Estados e avisos' },
  { key: 'error_color', label: 'Erro', defaultValue: '#ef4444', darkDefault: '#ef4444', group: 'Estados e avisos' },
  { key: 'info_color', label: 'Informação', defaultValue: '#3b82f6', darkDefault: '#60a5fa', group: 'Estados e avisos' },
] as const;

export const BRANDING_COLOR_KEYS = COLOR_FIELDS.flatMap(({ key }) => [key, `${key}_dark`] as const);

