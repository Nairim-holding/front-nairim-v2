'use client';

import Section from "@/components/Section";
import DynamicTableManager from "@/components/DynamicTableManager";
import { ColumnDef } from "@/types/types";

export default function FornecedoresPage() {
  const columns: ColumnDef[] = [
    { field: "sequential_id", label: "Cód.", sortParam: "sequential_id", type: "text" },
    { field: "legal_name", label: "Razão Social", sortParam: "legal_name", type: "text" },
    { field: "trade_name", label: "Nome Fantasia", sortParam: "trade_name", type: "text" },
    { field: "cnpj", label: "CNPJ", sortParam: "cnpj", type: "text", formatter: "cpfCnpj" },
    { field: "state_registration", label: "Inscrição Estadual", type: "text" },
    { field: "municipal_registration", label: "Inscrição Municipal", type: "text" },
    { field: "zip_code", label: "CEP", type: "text", sortParam: "zip_code", formatter: "cep" },
    { field: "state", label: "UF", type: "text", sortParam: "state" },
    { field: "city", label: "Cidade", type: "text", sortParam: "city" },
    { field: "district", label: "Bairro", type: "text", sortParam: "district" },
    { field: "address", label: "Endereço", type: "text", sortParam: "street" },
    { field: "complement", label: "Complemento", type: "text", sortParam: "complement" },
    { field: "contact", label: "Contato", type: "text", sortParam: "contact_name" },
    { field: "telephone", label: "Fone", type: "text", formatter: "phone" },
    { field: "cellphone", label: "Celular", type: "text", sortParam: "cellphone", formatter: "phone" },
    { field: "email", label: "E-mail", type: "text", sortParam: "email" },
    { field: "actions", label: "Ação", type: "custom" }
  ];

  return (
    <Section title="Fornecedores">
      <DynamicTableManager
        resource="financial-supplier"
        title="Fornecedor"
        columns={columns}
        basePath="/dashboard/fornecedores"
        autoFocusSearch={true}
      />
    </Section>
  );
}