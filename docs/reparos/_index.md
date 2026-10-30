# Reparos

Reparos e reformas dos imóveis: itens de serviço e material, profissionais, custos, situação e fotos/vídeos de antes e depois.

| Aspecto | Detalhe |
|---|---|
| Menu | Reparos |
| Rota | `/dashboard/reparos` |
| Permissão | recurso `repairs` (ver, criar, editar, excluir) |
| Modelos Prisma | `Repair`, `RepairItem`, `RepairProfessional`, `RepairMedia` |
| Server | `server/actions/repair.ts` |
| Domínio | `core/entities/repair.ts` |
| Infra | `infra/repositories/prisma-repairs-repository.ts` |

## Arquivos desta pasta
[domain.md](domain.md) · [actions.md](actions.md) · [queries.md](queries.md) · [telas.md](telas.md) · [patterns.md](patterns.md) · [changelog.md](changelog.md) · [regras-itens-e-profissionais.md](regras-itens-e-profissionais.md)

## Para mexer neste módulo, saiba que
1. Recurso de permissão `repairs`. Lista à esquerda e formulário ao lado (empilhados em telas estreitas), padrão da tela de Contatos.
2. Situação: planejado, em andamento, concluído ou cancelado; **concluído exige data de conclusão**. Lista com 25 por página; busca por imóvel, descrição e profissional; filtros por imóvel, situação e período.
3. Responsáveis são Contatos do Financeiro (`supplier_id`), ativos e da empresa; nome novo (2–150 caracteres) pode ser criado ao salvar se houver permissão de criar contatos.
4. Com itens (descrição, tipo mão de obra/materiais, contato, valor), os totais são calculados em centavos na tela e no servidor; sem itens valem os campos gerais (registros antigos).
5. Mídias (Antes e Depois): até 10 arquivos de 20 MB por etapa (JPG, PNG, WebP, AVIF, MP4, WebM); imagens compatíveis são convertidas para AVIF; exclusão de mídia remove registro e arquivo; exclusão do reparo é lógica.
6. Backup e auditoria incluem reparos; mídias vão por URL, sem embutir arquivos.
