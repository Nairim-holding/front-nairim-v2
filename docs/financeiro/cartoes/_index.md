# Cartões de crédito

Cartões de crédito, faturas e o painel de cartões (gasto, pendência e limite por cartão, gráfico anual e composição por categoria).

| Aspecto | Detalhe |
|---|---|
| Menu | Financeiro > Cartões de Crédito |
| Rota | `/dashboard/cartoes` |
| Permissão | recurso `financial-cards` (ver, criar, editar, excluir) |
| Modelos Prisma | `Card`, `Invoice` |
| Server | `server/actions/financial-card.ts`, `server/actions/financial-invoice.ts`, `server/actions/credit-card-dashboard.ts`, `server/queries/financial-card.ts`, `server/queries/financial-invoice.ts`, `server/queries/credit-card-dashboard.ts` |
| Domínio | `core/use-cases/financial-card/crud.ts`, `core/use-cases/financial-invoice/crud.ts`, `core/entities/financial-card.ts`, `core/entities/financial-invoice.ts`, `core/entities/credit-card-dashboard.ts` |
| Infra | `infra/repositories/prisma-financial-cards-repository.ts`, `infra/repositories/prisma-financial-invoices-repository.ts` |

## Arquivos desta pasta
[domain.md](domain.md) · [actions.md](actions.md) · [queries.md](queries.md) · [telas.md](telas.md) · [patterns.md](patterns.md) · [changelog.md](changelog.md)

## Para mexer neste módulo, saiba que
1. Cartão: nome obrigatório, limite numérico, dia de fechamento e de vencimento entre 1 e 31. Excluir cartão com lançamentos é recusado. Exclusão é lógica (`deleted_at`); restaurar só funciona em registro excluído.
2. Fatura duplicada (cartão+mês+ano) é recusada; fatura já concluída não pode ser concluída de novo.
3. **Painel**: seleção inicial usa cartões ativos (inativos podem ser incluídos); limpar seleção esvazia gráficos e lançamentos. Fatura vinculada define mês/ano; sem vínculo usa a data efetiva; a compra aparece pela data do evento.
4. Entram despesas não excluídas, não canceladas e que não sejam transferência; pagas e pendentes compõem o gasto; pagamentos não contam como compra.
5. Limite disponível no mês = limite cadastrado − pendências da competência (não é o limite global do emissor).
6. A consulta exige `financial-cards:view` e restringe cartões, categorias, faturas e transações à empresa da sessão; IDs de outra empresa são rejeitados. Ler o painel não cria faturas nem altera lançamentos.
7. Cadastro, edição e exclusão ficam em **Gerenciar cartões**, respeitando permissões; ao fechar, o painel recarrega e volta à seleção de ativos.
