# Locações — Histórico

Atualize aqui a cada alteração no módulo. Mais recente primeiro.

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
