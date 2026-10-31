# Relatórios de locações — Histórico

Atualize aqui a cada alteração no módulo. Mais recente primeiro.

### 2026-10-30 — Correções de 28/10
- **Imóvel repetido:** linhas por imóvel + inquilino + competência; a retenção de IRRF vinculada a outro contrato do mesmo inquilino/imóvel entra na mesma linha (usa o contrato que recebeu o aluguel). Corrige também a base do quadro de Retenções e a dedução nos DARF.
- **Total:** o rodapé impresso/exportado não desloca mais os totais uma coluna (a coluna de arrastar saía da impressão, mas o "Total" ainda a contava).
- **Quadros fiscais impressos** no modelo da planilha: Faturamento Aluguéis, Aplicações Financeiras Trimestral e Faturamento Trimestral (alíquota, imposto, a pagar com dedução da retenção e aplicação financeira). Rótulo IRPI corrigido para IRPJ.
- **Arredondamento:** o "a pagar" subtrai a retenção sem arredondar antes (199,536 − 144,624 = 54,91, como na planilha).

### 2026-10-09 — Competência e atrasos
- Linha por contrato e competência; condomínio na receita; novo relatório de atrasos.

### 2026-08-25 — Relatório de locações
- Implementação inicial do relatório (migration de campos do relatório, `20260825000000`).

### 2026-10-30 — Documentação inicial
- **Arquivos:** esta pasta. **Razão:** economizar leitura de código em futuras sessões.
