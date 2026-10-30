# Alertas de atrasos

Alertas de aluguéis atrasados e repasses pendentes: sino "Alertas de locações" no menu lateral e a tela de alertas, com cobrança manual por WhatsApp e marcação da situação (notificado ou em negociação).

| Aspecto | Detalhe |
|---|---|
| Menu | Locações > Alertas de atrasos (e sino "Alertas de locações" no menu) |
| Rota | `/dashboard/locacoes/atrasadas` |
| Permissão | recurso `leases` (ver, criar, editar, excluir) |
| Modelos Prisma | `LeaseNotification` |
| Server | `server/actions/lease-overdue.ts`, `server/queries/lease-overdue.ts`, `server/queries/lease-overdue-report.ts` |
| Domínio | `core/entities/lease-overdue.ts` |
| Infra | — |

## Arquivos desta pasta
[domain.md](domain.md) · [actions.md](actions.md) · [queries.md](queries.md) · [telas.md](telas.md) · [patterns.md](patterns.md) · [changelog.md](changelog.md)

## Para mexer neste módulo, saiba que
1. Os alertas usam as mesmas regras do relatório de atrasos: reconhecem lançamentos sem vínculo explícito quando a descrição identifica um único contrato da mesma empresa, sem atribuir dívida a contrato de outro período.
2. Cada competência é separada, inclusive de anos anteriores. Lançamentos formalmente cancelados e parcelas comuns vencendo a partir do cancelamento não entram.
3. Prazos de tolerância de repasse e dias úteis (feriados em `Holiday`) são aplicados.
4. A cobrança é **manual**: o botão abre o WhatsApp com a mensagem pronta (`buildWhatsAppLink`) para o número escolhido nos contatos da imobiliária (`resolveAgencyAlertContact`). Sem número selecionado o botão fica desabilitado.
5. A situação do alerta (`LeaseOverdueStatus`: `NOTIFIED` ou `NEGOTIATING`, ou nenhuma) é gravada no lançamento (`Transaction.overdue_status`) por `updateLeaseOverdueStatusAction` (exige `leases:edit`).
6. `LeaseNotification` só é lida (último aviso); nenhum código grava nela hoje e a tabela segue vazia no banco de desenvolvimento. Não remova sem conferir os dados de produção.
7. O painel do sino abre fora da área limitada pelo menu, com altura calculada pela janela e rolagem interna; a contagem de "a vencer" fica acima do valor aguardando repasse.
