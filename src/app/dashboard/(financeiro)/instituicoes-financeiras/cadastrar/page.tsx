import type { FormFieldDef } from '@/types/types';
import DynamicForm from '@/components/form/DynamicForm';

const FIELDS: FormFieldDef[] = [
  {
    field: 'name',
    label: 'Nome da Instituição',
    type: 'text',
    required: true,
    placeholder: 'Ex: Banco do Brasil, Itaú, Nubank',
  },
];

export default function CadastrarInstituicaoPage() {
  return (
    <DynamicForm
      resource="financial-institution"
      title="Instituição Financeira"
      basePath="/dashboard/instituicoes-financeiras"
      mode="create"
      fields={FIELDS}
    />
  );
}
