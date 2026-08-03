/* eslint-disable @typescript-eslint/no-explicit-any */
'use client';

import { useParams, useRouter } from 'next/navigation';
import { useMemo } from 'react';
import { useMessageContext } from '@/contexts/MessageContext';
import DynamicFormManager from '@/components/form/DynamicForm';
import PermissionMatrix from '@/components/domain/userGroups/PermissionMatrix';
import AuditFooter from '@/components/domain/userGroups/AuditFooter';
import { FormStep } from '@/types/types';
import { Users, Tag, ShieldCheck } from 'lucide-react';

/** Converte o estado da matriz no payload de PUT /user-groups/:id/permissions */
function toPermissionsPayload(state: any) {
  if (!state || Array.isArray(state)) return [];

  return Object.entries(state).map(([resource, flags]: [string, any]) => ({
    resource,
    can_view: flags?.can_view === true,
    can_create: flags?.can_create === true,
    can_edit: flags?.can_edit === true,
    can_delete: flags?.can_delete === true,
    can_export: flags?.can_export === true,
    can_custom_field: flags?.can_custom_field === true,
  }));
}

export default function EditarGrupoUsuarioPage() {
  const params = useParams();
  const id = params.id as string;

  const { showMessage } = useMessageContext();
  const router = useRouter();

  const handleSubmit = async (data: any) => {
    try {
      const API_URL = process.env.NEXT_PUBLIC_URL_API;

      // 1. Dados do grupo
      const response = await fetch(`${API_URL}/user-groups/${id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ description: data.description }),
      });

      const responseText = await response.text();
      let result;
      try {
        result = JSON.parse(responseText);
      } catch {
        throw new Error('Resposta inválida do servidor');
      }

      if (!response.ok) {
        if (response.status === 409) {
          throw new Error('Grupo de usuário já existe');
        }
        throw new Error(result.message || `Erro ${response.status}`);
      }

      // 2. Diretivas de acesso (substitui a matriz inteira)
      const permRes = await fetch(`${API_URL}/user-groups/${id}/permissions`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ permissions: toPermissionsPayload(data.permissions) }),
      });

      if (!permRes.ok) {
        const permText = await permRes.text();
        console.error('❌ Falha ao salvar diretivas:', permText);
        throw new Error('Dados salvos, mas as diretivas de acesso não foram gravadas.');
      }

      return result;
    } catch (error: any) {
      console.error('❌ Erro no submit:', error);
      throw new Error(error.message);
    }
  };

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
        title: 'Dados do Grupo de Usuário',
        icon: <Users size={20} />,
        fields: [
          {
            field: 'description',
            label: 'Descrição',
            type: 'textarea',
            required: true,
            placeholder: 'Ex: Administradores, Financeiro, Consulta, etc.',
            autoFocus: true,
            icon: <Tag size={20} />,
            validation: { minLength: 3, maxLength: 100 },
            maxLength: 100,
            className: 'col-span-full',
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
              <PermissionMatrix value={value} onChange={onChange} groupId={id} />
            ),
          },
        ],
      },
    ],
    [id]
  );

  const onSubmitSuccess = () => {
    showMessage('Grupo de usuário atualizado com sucesso!', 'success');
    router.push('/dashboard/grupos-usuario');
  };

  return (
    <DynamicFormManager
      resource="user-groups"
      title="Grupo de Usuário"
      basePath="/dashboard/grupos-usuario"
      mode="edit"
      id={id}
      steps={steps}
      onSubmit={handleSubmit}
      onSubmitSuccess={onSubmitSuccess}
      transformData={transformData}
    />
  );
}
