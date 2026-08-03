/* eslint-disable @typescript-eslint/no-explicit-any */
'use client';

import { useMemo } from 'react';
import DynamicForm from '@/components/form/DynamicForm';
import { FormStep } from '@/types/types';
import { useParams } from 'next/navigation';
import {
  User,
  UserIcon,
  Mail,
  Calendar,
  Users,
  ShieldCheck,
  BadgeCheck,
  Clock,
  Phone,
  Power,
} from 'lucide-react';
import { photoField, contactFields, accessScheduleField } from '../../_lib/fields';

const ROLE_LABEL: Record<string, string> = {
  DEFAULT: 'Padrão',
  ADMIN: 'Administrador',
  SUPER_ADMIN: 'Super Administrador',
};

const GENDER_LABEL: Record<string, string> = {
  MALE: 'Masculino',
  FEMALE: 'Feminino',
  OTHER: 'Outro',
};

export default function VisualizarAdministradorPage() {
  const params = useParams();
  const id = params.id as string;

  // Em visualização tudo é só leitura: texto simples lê melhor que select
  // desabilitado e não depende de casar o valor com uma opção da lista.
  const steps: FormStep[] = useMemo(
    () => [
      {
        title: 'Dados do Administrador',
        icon: <User size={20} />,
        fields: [
          { field: 'name', label: 'Nome', type: 'text', readOnly: true, icon: <UserIcon size={20} /> },
          { field: 'email', label: 'Email', type: 'email', readOnly: true, icon: <Mail size={20} /> },
          { field: 'birth_date', label: 'Data de Nascimento', type: 'date', readOnly: true, icon: <Calendar size={20} /> },
          { field: 'gender_label', label: 'Sexo', type: 'text', readOnly: true, icon: <Users size={20} /> },
          photoField(id, true),
        ],
      },
      {
        title: 'Contato',
        icon: <Phone size={20} />,
        fields: contactFields(true),
      },
      {
        title: 'Acesso e Permissões',
        icon: <ShieldCheck size={20} />,
        fields: [
          { field: 'active_label', label: 'Ativo', type: 'text', readOnly: true, icon: <Power size={20} /> },
          { field: 'user_group_name', label: 'Grupo de Usuário', type: 'text', readOnly: true, icon: <Users size={20} /> },
          { field: 'role_label', label: 'Papel (Role)', type: 'text', readOnly: true, icon: <BadgeCheck size={20} /> },
          { field: 'time_restriction_label', label: 'Horário restrito', type: 'text', readOnly: true, icon: <Clock size={20} /> },
          accessScheduleField(id, true),
        ],
      },
      {
        title: 'Registro',
        icon: <Clock size={20} />,
        fields: [
          { field: 'created_by_name', label: 'Cadastrado por', type: 'text', readOnly: true, icon: <UserIcon size={20} /> },
          { field: 'created_at', label: 'Criado em', type: 'date', readOnly: true, icon: <Calendar size={20} /> },
          { field: 'updated_by_name', label: 'Alterado por', type: 'text', readOnly: true, icon: <UserIcon size={20} /> },
          { field: 'updated_at', label: 'Atualizado em', type: 'date', readOnly: true, icon: <Calendar size={20} /> },
        ],
      },
    ],
    [id]
  );

  const transformData = (apiResponse: any) => {
    const userData = apiResponse.data || apiResponse;

    const janela = userData.has_time_restriction === true ? 'Sim' : 'Não';

    return {
      name: userData.name || '',
      email: userData.email || '',
      birth_date: userData.birth_date ? userData.birth_date.split('T')[0] : '',
      gender_label: GENDER_LABEL[userData.gender] || '—',
      photo: userData.photo_url || null,

      phone_country_code: userData.phone_country_code || '',
      phone_area_code: userData.phone_area_code || '',
      phone: userData.phone || '',
      phone_extension: userData.phone_extension || '',

      active_label: userData.is_active === false ? 'Não' : 'Sim',
      user_group_name: userData.group?.description || 'Sem grupo',
      role_label: ROLE_LABEL[userData.role] || userData.role || '—',
      has_time_restriction: userData.has_time_restriction === true,
      time_restriction_label: janela,

      created_by_name: userData.creator?.name || '—',
      updated_by_name: userData.updater?.name || '—',
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
      steps={steps}
      transformData={transformData}
    />
  );
}
