# Imobiliárias

Cadastro de imobiliárias parceiras, com endereço, contatos e a configuração de comissão usada na geração financeira das locações.

| Aspecto | Detalhe |
|---|---|
| Menu | Cadastrar > Imobiliária |
| Rota | `/dashboard/imobiliarias` |
| Permissão | recurso `agencies` (ver, criar, editar, excluir) |
| Modelos Prisma | `Agency`, `AgencyAddress` |
| Server | `server/actions/agency.ts`, `server/queries/agency.ts` |
| Domínio | `core/use-cases/agency/crud.ts`, `core/entities/agency.ts` |
| Infra | `infra/repositories/prisma-agencies-repository.ts` |

## Arquivos desta pasta
[domain.md](domain.md) · [actions.md](actions.md) · [queries.md](queries.md) · [telas.md](telas.md) · [patterns.md](patterns.md) · [changelog.md](changelog.md)

## Para mexer neste módulo, saiba que
1. CNPJ não pode se repetir na empresa. Exclusão é lógica (`deleted_at`); restaurar só funciona em registro excluído.
2. Para cadastrar uma locação a imobiliária precisa de categoria, subcategoria e **% de comissão** (zero é aceito); o formulário exige esses campos e o servidor revalida (`AGENCY_FINANCIAL_SETUP_ERROR`).
3. `commission_percentage` é gravado na criação e na edição; edição parcial preserva categoria/subcategoria ausentes do pedido. Valores antigos nunca gravados precisam ser informados de novo (não são estimados).
4. A geração financeira cria um espelho `Supplier` (código `AG-...`) por imobiliária e procura um cadastro único pelo CNPJ antes de criar; casos ambíguos exigem consolidação (`scripts/consolidate-agency-suppliers.mjs`, modo prévia por padrão).
