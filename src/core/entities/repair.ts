export const REPAIR_EVENT_LABELS = { REPAIR: 'Reparo', RENOVATION: 'Reforma' } as const;
export const REPAIR_PROBLEM_LABELS = {
  STRUCTURAL: 'Estrutural', ELECTRICAL: 'Elétrico', HYDRAULIC: 'Hidráulico', FINISHING: 'Revestimento e acabamento',
} as const;
export const REPAIR_STATUS_LABELS = { PLANNED: 'Planejado', IN_PROGRESS: 'Em andamento', COMPLETED: 'Concluído', CANCELLED: 'Cancelado' } as const;
export interface RepairMedia {
  id: string; stage: 'BEFORE' | 'AFTER'; filename: string; url: string; content_type: string;
}
export interface Repair {
  id: string; property_id: string; property: { id: string; title: string };
  event_date: string; event_type: keyof typeof REPAIR_EVENT_LABELS; problem_type: keyof typeof REPAIR_PROBLEM_LABELS;
  description: string; professional: string; service_amount: number; materials_amount: number;
  payment_method: string; payment_conditions: string; status: keyof typeof REPAIR_STATUS_LABELS;
  start_date: string | null; completion_date: string | null; notes: string | null; media: RepairMedia[];
}
