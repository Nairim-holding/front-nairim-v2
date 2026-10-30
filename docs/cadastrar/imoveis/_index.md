# Imóveis

Cadastro de imóveis (dados, endereço com localização no mapa, valores, IPTUs e documentos) em formulário de várias etapas, com duplicação entre empresas.

| Aspecto | Detalhe |
|---|---|
| Menu | Cadastrar > Imóvel |
| Rota | `/dashboard/imoveis` |
| Permissão | recurso `properties` (ver, criar, editar, excluir) |
| Modelos Prisma | `Property`, `PropertyValue`, `PropertyAddress`, `PropertyIptu`, `Document`, `Favorite` |
| Server | `server/actions/property.ts`, `server/actions/property-document-import.ts`, `server/actions/iptu-property.ts`, `server/queries/property.ts` |
| Domínio | `core/use-cases/iptu-property/get-filters.ts`, `core/use-cases/property/create-unified.ts`, `core/use-cases/property/crud.ts`, `core/entities/property.ts`, `core/entities/iptu-property.ts`, `core/entities/municipal-property-document.ts` |
| Infra | `infra/repositories/prisma-properties-repository.ts` |

## Arquivos desta pasta
[domain.md](domain.md) · [actions.md](actions.md) · [queries.md](queries.md) · [telas.md](telas.md) · [patterns.md](patterns.md) · [changelog.md](changelog.md) · [localizacao.md](localizacao.md)

## Para mexer neste módulo, saiba que
1. Criação e edição são "unificadas": dados, documentos novos e remoção de documentos numa única operação (`createUnifiedPropertyAction`, `updateUnifiedPropertyAction`).
2. O imóvel precisa de seis vínculos financeiros para cadastrar locações: Categoria Aluguel, Subcategoria Aluguel, Centro de Custo (Crédito), Centro de Custo (Débito), Categoria (Restituição de IPTU) e Subcategoria (Restituição de IPTU); o formulário os exige (`PROPERTY_FINANCIAL_FIELDS` em `shared/validators/lease-financial-setup.ts`).
3. Status (`AVAILABLE`, `OCCUPIED`, `SOLD`) vem do `PropertyValue` mais recente. Registrar venda exige antes encerrar ou cancelar a locação vigente. Contratos vencidos liberam o imóvel automaticamente (`property-occupancy.ts`); imóvel ocupado manualmente sem histórico de locação não é liberado.
4. IPTUs antigos inalterados não bloqueiam alteração de status; IPTUs novos ou alterados passam pela validação completa. Nenhuma data é inventada para o legado.
5. **Duplicar** (ícone entre filtro e exclusão, exige `create`): copia endereço, valores, IPTUs e arquivos independentes; não copia contratos, reparos nem lançamentos. Dependências equivalentes são reutilizadas por nome/tipo/categoria pai (proprietário por documento); ausentes são criadas; duplicidade ambígua interrompe aquela cópia. Uma transação por imóvel e empresa (`server/services/property-clone.ts`).
6. Localização: pin sugerido pela Geoapify, mas só vale após **confirmação** do usuário (ver [localizacao.md](localizacao.md)). Imóvel pendente salva, mas não aparece no mapa do Resumo.
7. Cadastro rápido de proprietário, tipo de imóvel e imobiliária direto no formulário (`quickCreateRecordAction`), com dados provisórios que exigem revisão.
8. Exclusão é lógica (`deleted_at`); restaurar só funciona em registro excluído.
