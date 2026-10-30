# Alertas de atrasos — Domínio

## Modelos Prisma (`prisma/schema.prisma`)
### LeaseNotification
- Campos: lease_id: String; channel: LeaseNotificationChannel; recipient: String?; message: String?; reference_month: Int; reference_year: Int; days_overdue: Int?; sent_at: DateTime; sent_by_id: String?
- Relações: company → Company; lease → Lease; sent_by → User
- Padrão: id, company_id, created_at, updated_at, deleted_at (exclusão lógica)

## Entidades e tipos (`src/core/entities`)
`LeaseOverdueStatus`, `LeaseNotificationChannel`, `OverdueLease`, `daysBetween`, `isOverdue`, `isLeaseReceivableDue`, `OverdueSeverity`, `severityOf`, `sortOverdueLeases`, `overdueCount`, `overdueTotal`, `buildNotificationMessage`, `buildWhatsAppLink`

## Validação (Zod, `src/shared/validators`)
—

## Regras de negócio
- Os alertas usam as mesmas regras do relatório de atrasos: reconhecem lançamentos sem vínculo explícito quando a descrição identifica um único contrato da mesma empresa, sem atribuir dívida a contrato de outro período.
- Cada competência é separada, inclusive de anos anteriores. Lançamentos formalmente cancelados e parcelas comuns vencendo a partir do cancelamento não entram.
- Prazos de tolerância de repasse e dias úteis (feriados em `Holiday`) são aplicados.
- A cobrança é **manual**: o botão abre o WhatsApp com a mensagem pronta (`buildWhatsAppLink`) para o número escolhido nos contatos da imobiliária (`resolveAgencyAlertContact`). Sem número selecionado o botão fica desabilitado.
- A situação do alerta (`LeaseOverdueStatus`: `NOTIFIED` ou `NEGOTIATING`, ou nenhuma) é gravada no lançamento (`Transaction.overdue_status`) por `updateLeaseOverdueStatusAction` (exige `leases:edit`).
- `LeaseNotification` só é lida (último aviso); nenhum código grava nela hoje e a tabela segue vazia no banco de desenvolvimento. Não remova sem conferir os dados de produção.
- O painel do sino abre fora da área limitada pelo menu, com altura calculada pela janela e rolagem interna; a contagem de "a vencer" fica acima do valor aguardando repasse.
