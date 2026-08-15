import { defineConfig } from 'vitest/config';
import { fileURLToPath } from 'node:url';

/**
 * Configuração do Vitest para os testes da migração (use-cases e, futuramente,
 * handlers). Resolve o alias `@` → `src` para os imports absolutos do projeto.
 */
export default defineConfig({
  test: {
    environment: 'node',
    include: ['src/**/*.test.ts'],
  },
  resolve: {
    alias: {
      '@': fileURLToPath(new URL('./src', import.meta.url)),
    },
  },
});
