# Relatórios financeiros — Histórico

### 2026-10-31 — Alinhamento do Demonstrativo (correções 53)
- **Arquivos:** `src/app/dashboard/(financeiro)/relatorios/_components/DemonstrativoView.tsx`.
- **Razão:** as linhas sintéticas tinham uma coluna física excedente em relação aos lançamentos expandidos.
- **Impacto:** cabeçalho, grupos e detalhes usam 13 colunas; preservadas as 12 colunas de dados e o percentual de comprometimento. Carregamento assíncrono compatível com a regra de efeitos do ESLint.

Atualize aqui a cada alteração no módulo. Mais recente primeiro.

### 2026-10-21 — Extrato bancário
- Formato bancário e ordem pela sequência de conclusão.

### 2026-10-02 — Correções 44
- Impressão/PDF com UTF-8 e numeração de páginas; cores no extrato, receitas/despesas e demonstrativo; totais únicos.

### 2026-10-30 — Documentação inicial
- **Arquivos:** esta pasta. **Razão:** economizar leitura de código em futuras sessões.
