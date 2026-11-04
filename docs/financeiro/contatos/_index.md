# Contatos (fornecedores)

Contatos do financeiro (fornecedores, prestadores, imobiliárias espelho): pessoas e empresas que recebem ou pagam nos lançamentos e nos reparos.

| Aspecto | Detalhe |
|---|---|
| Menu | Financeiro > Contatos |
| Rota | `/dashboard/fornecedores` |
| Permissão | recurso `financial-suppliers` (ver, criar, editar, excluir) |
| Modelos Prisma | `Supplier`, `SupplierAddress`, `Contact`, `ContactChannel` |
| Server | `server/actions/financial-supplier.ts`, `server/queries/financial-supplier.ts` |
| Domínio | `core/use-cases/financial-supplier/crud.ts`, `core/entities/financial-supplier.ts`, `core/entities/financial-supplier-search.ts`, `core/entities/contact-channel.ts` |
| Infra | `infra/repositories/prisma-financial-suppliers-repository.ts` |

## Arquivos desta pasta
[domain.md](domain.md) · [actions.md](actions.md) · [queries.md](queries.md) · [telas.md](telas.md) · [patterns.md](patterns.md) · [changelog.md](changelog.md)

## Para mexer neste módulo, saiba que
1. Nome/Razão Social obrigatório; CNPJ com 14 dígitos e CPF com 11; duplicidade de CNPJ/CPF recusada (409) em português. Exclusão é lógica (`deleted_at`); restaurar só funciona em registro excluído.
2. Contatos com código `AG-...` são espelhos de imobiliária (Supplier), não do cadastro de contatos de telefone (`Contact`).
3. O responsável pelo reparo é um contato ativo da empresa (`supplier_id`); cadastro rápido permitido com a permissão de criar contatos.
4. Consolidação de duplicados: `scripts/consolidate-agency-suppliers.mjs` (prévia por padrão; `--apply` com backup e IDs escolhidos pela identidade cadastral).
