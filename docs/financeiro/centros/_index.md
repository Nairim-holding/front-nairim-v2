# Centros

Centros de receita e despesa (imóveis, projetos etc.) usados nos lançamentos, no gráfico por centro do Resumo e no ROI, com importação por Excel.

| Aspecto | Detalhe |
|---|---|
| Menu | Financeiro > Centros |
| Rota | `/dashboard/centros` |
| Permissão | recurso `financial-centers` (ver, criar, editar, excluir) |
| Modelos Prisma | `Center` |
| Server | `server/actions/financial-center.ts`, `server/actions/center-summary.ts`, `server/actions/financial-center-import.ts`, `server/queries/financial-center.ts` |
| Domínio | `core/use-cases/financial-center/crud.ts`, `core/entities/financial-center.ts`, `core/entities/center-summary.ts` |
| Infra | `infra/repositories/prisma-financial-centers-repository.ts` |

## Arquivos desta pasta
[domain.md](domain.md) · [actions.md](actions.md) · [queries.md](queries.md) · [telas.md](telas.md) · [patterns.md](patterns.md) · [changelog.md](changelog.md)

## Para mexer neste módulo, saiba que
1. Excluir centro com lançamentos é recusado (`ConflictError`). Exclusão é lógica (`deleted_at`); restaurar só funciona em registro excluído.
2. Nomes de receitas terminam com **(CR)** e de despesas com **(DB)**, sem acumular sufixos. Na manutenção, Despesa fica laranja e Receita verde.
3. **Importar Excel** (`.xlsx`/`.xls`, até 2 MB e 5.000 linhas): coluna Nome ou Endereço (pode vir após linhas de título), coluna Tipo opcional (Receita/CR, Despesa/DB); sem tipo, o usuário escolhe receitas, despesas ou ambos. Gera prévia, ignora nomes repetidos na planilha e centros já cadastrados, mostra a empresa de destino e revalida tudo no servidor antes da inserção atômica. Fórmulas, nomes vazios e tipos inválidos bloqueiam.
4. A listagem carrega todas as páginas de centros (não corta nos primeiros 100).
5. Centros usados por mais de um imóvel não têm valores atribuídos a um imóvel no ROI.
