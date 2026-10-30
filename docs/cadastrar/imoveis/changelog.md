# Imóveis — Histórico

Atualize aqui a cada alteração no módulo. Mais recente primeiro.

### 2026-10-17 — Vínculos financeiros e cadastros rápidos
- Formulários de imóvel e imobiliária exigem os campos financeiros; zero é aceito como comissão explícita.
- Cadastro rápido de proprietário, tipo e imobiliária no imóvel.

### 2026-10-09 — Duplicação de imóveis
- Ícone de duplicar com seleção de empresas de destino; resultado de falhas por imóvel e empresa e logs atribuídos ao usuário.

### 2026-09-06 — Confirmação da localização
- Migration `20260906000000_property_location_confirmation` (coluna `location_confirmation` em `Address`). Detalhes em [localizacao.md](localizacao.md).

### 2026-09-03 — Disponibilidade e IPTU legado
- Contratos vencidos deixam de manter o imóvel ocupado; IPTUs antigos inalterados não bloqueiam mudança de status.

### 2026-10-30 — Documentação inicial
- **Arquivos:** esta pasta. **Razão:** economizar leitura de código em futuras sessões.
