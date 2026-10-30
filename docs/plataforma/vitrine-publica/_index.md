# Vitrine pública de imóveis

Páginas públicas de imóveis (sem login) e endpoints de leitura pública usados pela vitrine do site da empresa.

| Aspecto | Detalhe |
|---|---|
| Menu | Páginas públicas (/casas, /imoveis, /apartamentos, /comerciais) |
| Rota | `/imoveis/[id]`, `/casas/[id]`, `/api/properties` |
| Permissão | pública |
| Modelos Prisma | `Property` |
| Server | `server/actions/public.ts`, `server/queries/public.ts` |
| Domínio | `core/use-cases/public/crud.ts`, `core/entities/public-property.ts` |
| Infra | `infra/repositories/prisma-public-repository.ts` |

## Arquivos desta pasta
[domain.md](domain.md) · [actions.md](actions.md) · [queries.md](queries.md) · [telas.md](telas.md) · [patterns.md](patterns.md) · [changelog.md](changelog.md)

## Para mexer neste módulo, saiba que
1. Rotas públicas (sem login): `/casas/[id]`, `/imoveis/[id]` e os prefixos `/apartamentos/` e `/comerciais/` (lista `PUBLIC_PREFIXES` em `src/middleware.ts`).
2. Paginação pública em `core/utils/public-pagination.ts`; parâmetros validados em `shared/validators/public.ts`.
3. A vitrine expõe **apenas campos de vitrine**: endereço parcial (rua, número, bairro, cidade, estado, país), documentos só do tipo `IMAGE` e o valor mais recente do imóvel (`core/entities/public-property.ts`). Mantenha assim ao alterar a seleção.
4. O formulário de contato chega em `POST /api/lead`, que repassa para `NEXT_PUBLIC_URL_API`.
