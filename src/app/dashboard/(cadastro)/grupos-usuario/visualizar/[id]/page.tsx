/* eslint-disable @typescript-eslint/no-explicit-any */
'use client';

import { useParams } from 'next/navigation';
import { useMemo } from 'react';
import DynamicFormManager from '@/components/form/DynamicForm';
import PermissionMatrix from '@/components/domain/userGroups/PermissionMatrix';
import AuditFooter from '@/components/domain/userGroups/AuditFooter';
import { FormStep } from '@/types/types';
import { Users, Tag, ShieldCheck } from 'lucide-react';

export default function VisualizarGrupoUsuarioPage() {
  const params = useParams();
  const id = params.id as string;

  const transformData = (apiData: any) => {
    if (!apiData) return {};
    const data = apiData.data || apiData;

    return {
      description: data.description || '',
      created_by_name: data.creator?.name || null,
      created_at: data.created_at || null,
      updated_by_name: data.updater?.name || null,
      updated_at: data.updated_at || null,
    };
  };

  const steps: FormStep[] = useMemo(
    () => [
      {
        title: 'Informações do Grupo de Usuário',
        icon: <Users size={20} />,
        fields: [
          {
            field: 'description',
            label: 'Descrição',
            type: 'textarea',
            required: true,
            placeholder: 'Ex: Administradores, Financeiro, Consulta, etc.',
            icon: <Tag size={20} />,
            className: 'col-span-full',
            readOnly: true,
          },
          {
            field: 'audit',
            label: '',
            type: 'custom',
            className: 'col-span-full',
            render: (_value: any, formValues: any) => (
              <AuditFooter
                createdBy={formValues?.created_by_name}
                createdAt={formValues?.created_at}
                updatedBy={formValues?.updated_by_name}
                updatedAt={formValues?.updated_at}
              />
            ),
          },
        ],
      },
      {
        title: 'Diretivas de Acesso',
        icon: <ShieldCheck size={20} />,
        fields: [
          {
            field: 'permissions',
            label: 'Permissões por item de menu',
            type: 'custom',
            className: 'col-span-full',
            render: (value: any, _formValues: any, onChange: any) => (
              <PermissionMatrix value={value} onChange={onChange} groupId={id} disabled />
            ),
          },
        ],
      },
    ],
    [id]
  );

  return (
    <DynamicFormManager
      resource="user-groups"
      title="Grupo de Usuário"
      basePath="/dashboard/grupos-usuario"
      mode="view"
      id={id}
      steps={steps}
      transformData={transformData}
    />
  );
}
