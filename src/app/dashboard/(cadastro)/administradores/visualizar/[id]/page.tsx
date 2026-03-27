/* eslint-disable @typescript-eslint/no-explicit-any */
'use client';

import DynamicForm from '@/components/form/DynamicForm';
import { FormFieldDef } from '@/types/types';
import { useParams } from 'next/navigation';

export default function VisualizarAdministradorPage() {
  const params = useParams();
  const id = params.id as string;

  const fields: FormFieldDef[] = [
    {
      field: 'name',
      label: 'Nome',
      type: 'text',
      readOnly: true,
    },
    {
      field: 'email',
      label: 'Email',
      type: 'email',
      readOnly: true,
    },
    {
      field: 'birth_date',
      label: 'Data de Nascimento',
      type: 'date',
      readOnly: true,
    },
    {
      field: 'gender',
      label: 'Sexo',
      type: 'select',
      readOnly: true,
      options: [
        { label: 'Masculino', value: 'MALE' },
        { label: 'Feminino', value: 'FEMALE' },
      ],
    },
    {
      field: 'created_at',
      label: 'Criado em',
      type: 'date',
      readOnly: true,
    },
    {
      field: 'updated_at',
      label: 'Atualizado em',
      type: 'date',
      readOnly: true,
    },
  ];

  // Transformar dados da API para o formato do formulário
  const transformData = (apiResponse: any) => {
    console.log('📥 Dados brutos da API:', apiResponse);
    
    const userData = apiResponse.data || apiResponse;
    
    console.log('👤 Dados do usuário:', userData);
    
    return {
      name: userData.name || '',
      email: userData.email || '',
      birth_date: userData.birth_date ? userData.birth_date.split('T')[0] : '',
      gender: userData.gender || 'MALE',
      created_at: userData.created_at ? userData.created_at.split('T')[0] : '',
      updated_at: userData.updated_at ? userData.updated_at.split('T')[0] : '',
    };
  };

  return (
    <DynamicForm
      resource="users"
      title="Administrador"
      basePath="/dashboard/administradores"
      mode="view"
      id={id}
      fields={fields}
      transformData={transformData}
    />
  );
}