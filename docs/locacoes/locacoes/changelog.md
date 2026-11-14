# Locações — Histórico

Atualize aqui a cada alteração no módulo. Mais recente primeiro.

### 2026-11-13 — Créditos a maior de aluguel

**Arquivo**  `src/core/entities/lease-transaction-kind.ts`.

**Razão**  Um complemento de aluguel pode ocorrer na mesma competência da parcela contratual.

**Impacto**  A sincronização e os avisos de sobreposição do Histórico Financeiro tratam esses créditos como complementos e continuam considerando a parcela integral.

### 2026-10-17 — Condomínio e validação financeira
- Geração mensal inclui condomínio; conciliação o considera no líquido e na quitação dos repasses.
- Servidor valida os vínculos financeiros do imóvel e da imobiliária antes de salvar.
- Histórico financeiro com cabeçalho fixo e cores por natureza.

### 2026-10-14 — Cancelamentos e duplicidade
- Alertas reconhecem aluguéis antigos do relatório de atrasos; novos lançamentos que repetem parcela gerada (mesma natureza e competência) são recusados; cancelamento por edição ou exclusão encerra pendências futuras.
- Script `npm run audit:lease-cancellations` (somente leitura, rollback) audita contratos cancelados.

### 2026-09-03 — Disponibilidade
- Recalculo da ocupação em criação, edição, cancelamento, exclusão e restauração de locações.

### 2026-10-30 — Documentação inicial
- **Arquivos:** esta pasta. **Razão:** economizar leitura de código em futuras sessões.
