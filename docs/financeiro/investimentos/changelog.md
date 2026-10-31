# Meus investimentos — Histórico

### 2026-10-31 — Verificação do item 4 das correções 53
- **Arquivos:** `src/infra/repositories/prisma-investments-repository.test.ts`; documentação do módulo.
- **Razão:** confirmar os exemplos do documento e a continuidade dos cálculos nos meses subsequentes.
- **Impacto:** teste adicional seleciona apenas fevereiro e usa janeiro como saldo anterior, sem repetir o capital inicial em Aplicado. A regra existente e o teste de interface reproduzem R$ 18.998,32 e 94,99% em janeiro.

Atualize aqui a cada alteração no módulo. Mais recente primeiro.

### 2026-10-21 — Capital inicial (correções 51)
- Capital inicial separado dos aportes líquidos; Aplicado/Total aplicado não repetem o saldo inicial; base do rendimento preservada fora do período exibido.

### 2026-10-09 — Saldos e aportes iniciais
- Saldo informado com edição e exclusão explícita; aporte inicial sincronizado com o Valor Investido.

### 2026-08-27 — Módulo criado
- Migration `20260827000000_add_investments`; rodada de 01/09/26 com filtro de 1 ano, modal de Resgate e multi-mês.

### 2026-10-30 — Documentação inicial
- **Arquivos:** esta pasta. **Razão:** economizar leitura de código em futuras sessões.
