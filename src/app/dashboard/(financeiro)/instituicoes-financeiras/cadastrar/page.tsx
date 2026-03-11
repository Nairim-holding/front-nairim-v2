'use client';

import DynamicForm from "@/components/DynamicFormManager";
import { FormFieldDef } from "@/types/types";

export default function CadastrarInstituicaoPage() {
  const fields: FormFieldDef[] = [
    {
      field: 'name',
      label: 'Nome da Instituição',
      type: 'text',
      required: true,
      placeholder: 'Ex: Banco do Brasil, Itaú, Nubank',
    }
  ];

  return (
    <DynamicForm
      resource="financial-institution"
      title="Instituição Financeira"
      basePath="/dashboard/instituicoes-financeiras"
      mode="create"
      fields={fields}
    />
  );
}