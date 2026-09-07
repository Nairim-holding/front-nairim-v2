/**
 * Locações atrasadas e notificações (Etapa 8).
 *
 * "Atrasado" aqui é o repasse pendente da imobiliária: existe um lançamento de
 * aluguel da locação, vencido, que ainda não está COMPLETED. O sininho do
 * dashboard conta essas locações e a tela lista os detalhes.
 *
 * Camada: core (regra pura, sem I/O).
 */

/** Acompanhamento manual do atraso, marcado pelo usuário. */
export type LeaseOverdueStatus = 'NOTIFIED' | 'NEGOTIATING';

export type LeaseNotificationChannel = 'EMAIL' | 'WHATSAPP';

/** Uma locação atrasada, como a tela precisa exibir. */
export interface OverdueLease {
  /** Lançamento financeiro mensal que está pendente. */
  transaction_id: string;
  lease_id: string;
  contract_number: string;
  property_title: string;
  tenant_name: string;
  agency_name: string;
  /** Dia do vencimento do aluguel no contrato. */
  rent_due_day: number;
  /** Data do vencimento em atraso. */
  due_date: Date;
  /** Primeiro dia em que a cobrança pode ser disparada automaticamente. */
  automatic_notification_date: Date;
  /** Dias corridos entre o vencimento e hoje. */
  days_overdue: number;
  amount: number;
  /** Competência do aluguel atrasado. */
  reference_month: number;
  reference_year: number;
  overdue_status: LeaseOverdueStatus | null;
  /** Contato da imobiliária, para o envio. */
  agency_email: string | null;
  agency_phone: string | null;
  /** Quando o último aviso foi enviado, se houve. */
  last_notified_at: Date | null;
  /** Quantos avisos já foram registrados para esta competência. */
  notification_count: number;
  whatsapp_notification_count: number;
  last_notification_channel: LeaseNotificationChannel | null;
}

const MS_PER_DAY = 86_400_000;

/**
 * Datas `@db.Date` chegam do Prisma à meia-noite UTC; datas criadas pela tela
 * costumam estar à meia-noite local. Esta distinção preserva o dia civil nos
 * dois casos sem o conhecido deslocamento de um dia no fuso brasileiro.
 */
function calendarParts(date: Date): { year: number; month: number; day: number } {
  const isUtcDateOnly = date.getUTCHours() === 0
    && date.getUTCMinutes() === 0
    && date.getUTCSeconds() === 0
    && date.getUTCMilliseconds() === 0;
  return isUtcDateOnly
    ? { year: date.getUTCFullYear(), month: date.getUTCMonth(), day: date.getUTCDate() }
    : { year: date.getFullYear(), month: date.getMonth(), day: date.getDate() };
}

/** Diferença em dias corridos, ignorando hora. */
export function daysBetween(from: Date, to: Date): number {
  const fromParts = calendarParts(from);
  const toParts = calendarParts(to);
  const a = Date.UTC(fromParts.year, fromParts.month, fromParts.day);
  const b = Date.UTC(toParts.year, toParts.month, toParts.day);
  return Math.round((b - a) / MS_PER_DAY);
}

/** Vencida se a data já passou — o próprio dia do vencimento não conta. */
export function isOverdue(dueDate: Date, today: Date = new Date()): boolean {
  return daysBetween(dueDate, today) > 0;
}

/**
 * Faixas de severidade do atraso, para colorir a lista. Os cortes seguem o
 * uso corrente da imobiliária: até 5 dias é atraso de repasse comum; acima de
 * 30 já é caso de cobrança.
 */
export type OverdueSeverity = 'recent' | 'attention' | 'critical';

export function severityOf(daysOverdue: number): OverdueSeverity {
  if (daysOverdue > 30) return 'critical';
  if (daysOverdue > 5) return 'attention';
  return 'recent';
}

/** Mais atrasadas primeiro; empate desempata por imobiliária e imóvel. */
export function sortOverdueLeases(leases: OverdueLease[]): OverdueLease[] {
  return [...leases].sort(
    (a, b) =>
      b.days_overdue - a.days_overdue
      || a.agency_name.localeCompare(b.agency_name, 'pt-BR')
      || a.property_title.localeCompare(b.property_title, 'pt-BR'),
  );
}

/** Total exibido no badge do sininho. */
export function overdueCount(leases: OverdueLease[]): number {
  return leases.length;
}

/** Soma dos valores em atraso, para o resumo do painel. */
export function overdueTotal(leases: OverdueLease[]): number {
  const total = leases.reduce((acc, lease) => acc + (Number(lease.amount) || 0), 0);
  return Math.round((total + Number.EPSILON) * 100) / 100;
}

// ─── Mensagem da notificação ────────────────────────────────────────────────

const currency = (value: number) =>
  value.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });

const shortDate = (date: Date) => {
  const parts = calendarParts(date);
  return `${String(parts.day).padStart(2, '0')}/${String(parts.month + 1).padStart(2, '0')}/${parts.year}`;
};

/** Texto padrão da cobrança enviada à imobiliária pelo WhatsApp. */
export function buildNotificationMessage(lease: OverdueLease): string {
  return [
    `Prezados, ${lease.agency_name},`,
    '',
    `Consta em aberto o repasse do aluguel do imóvel ${lease.property_title}`,
    `(locatário: ${lease.tenant_name}).`,
    '',
    `Vencimento: ${shortDate(lease.due_date)}`,
    `Dias em atraso: ${lease.days_overdue}`,
    `Valor: ${currency(Number(lease.amount) || 0)}`,
    '',
    'Solicitamos a verificação e o retorno sobre a previsão de repasse.',
  ].join('\n');
}

/**
 * Link do WhatsApp com a mensagem pré-preenchida (wa.me).
 *
 * O número é reduzido a dígitos e recebe o DDI 55 quando vem só com DDD —
 * sem isso o wa.me abre uma conversa vazia em vez da do destinatário.
 * Devolve `null` sem telefone utilizável, para a tela poder desabilitar o botão.
 */
export function buildWhatsAppLink(lease: OverdueLease): string | null {
  const digits = String(lease.agency_phone ?? '').replace(/\D/g, '');
  if (digits.length < 10) return null;
  const withCountryCode = digits.startsWith('55') ? digits : `55${digits}`;
  return `https://wa.me/${withCountryCode}?text=${encodeURIComponent(buildNotificationMessage(lease))}`;
}
