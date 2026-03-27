// Ponto de entrada centralizado para todos os contextos da aplicação.
// Prefira importar daqui em vez de importar dos arquivos individuais.

export { AuthProvider, useAuth, useUserRole, useIsAuthenticated } from './AuthContext';
export { FilterProvider, useFilters } from './filter-context';
export type { PropertyFiltersState, PropertyTransactionType, PropertySearchType } from './filter-context';
export { MessageProvider, useMessageContext } from './MessageContext';
export { PopupProvider, usePopupContext } from './PopupContext';
export { ThemeProvider, useTheme } from './ThemeContext';
export type { Theme } from './ThemeContext';
