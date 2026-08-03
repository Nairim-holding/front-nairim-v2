/* eslint-disable @typescript-eslint/no-explicit-any */
'use client';

import { useMemo, useRef } from 'react';
import DynamicForm from '@/components/form/DynamicForm';
import { FormStep } from '@/types/types';
import { useParams, useRouter } from 'next/navigation';
import { useAuth } from '@/contexts/AuthContext';
import { useMessageContext } from '@/contexts/MessageContext';
import { useUserGroupOptions } from '@/hooks/useUserGroupOptions';
import {
  User,
  UserIcon,
  Mail,
  Calendar,
  Users,
  ShieldCheck,
  Lock,
  KeyRound,
  BadgeCheck,
  Phone,
} from 'lucide-react';
import {
  SELECT_W,
  PASSWORD_PATTERN,
  PasswordHelpers,
  photoField,
  contactFields,
  activeField,
  timeRestrictionToggleField,
  accessScheduleField,
  profileFormValues,
  profilePayload,
  schedulePayload,
} from '../../_lib/fields';

export default function EditarAdministradorPage() {
  const params = useParams();
  const id = params.id as string;
  const { showMessage } = useMessageContext();
  const router = useRouter();
  const { user } = useAuth();
  const isSuperAdmin = user?.role === 'SUPER_ADMIN';
  const { options: userGroupOptions } = useUserGroupOptions();
  // A agenda vive em /users/:id/schedule, fora do payload de PUT /users/:id.
  // Capturada em transformPayload (que recebe os formValues completos) e
  // enviada em onSubmitSuccess, depois que os dados do usuário já salvaram.
  const pendingScheduleRef = useRef<{ has_time_restriction: boolean; access_schedules: any[] } | null>(null);

  const steps: FormStep[] = useMemo(
    () => [
      {
        title: 'Dados do Administrador',
        icon: <User size={20} />,
        fields: [
          {
            field: 'name',
            label: 'Nome',
            type: 'text',
            required: true,
            placeholder: 'Nome do administrador',
            autoFocus: true,
            icon: <UserIcon size={20} />,
          },
          {
            field: 'email',
            label: 'Email',
            type: 'email',
            required: true,
            placeholder: 'email@exemplo.com',
            icon: <Mail size={20} />,
            validation: {
              pattern: /^[^\s@]+@[^\s@]+\.[^\s@]+$/,
              patternMessage: 'Email inválido',
            },
          },
          {
            field: 'birth_date',
            label: 'Data de Nascimento',
            type: 'date',
            required: true,
            icon: <Calendar size={20} />,
            renderBottom: (value: any) => {
              if (!value) return null;
              const [year, month, day] = value.split('-').map(Number);
              if (!year || !month || !day) return null;

              const today = new Date();
              let age = today.getFullYear() - year;
              const m = today.getMonth() - (month - 1);
              if (m < 0 || (m === 0 && today.getDate() < day)) age--;
              if (age < 0 || age > 130) return null;

              return (
                <span className="text-sm font-medium text-[#8B5CF6] mt-1.5 inline-block">
                  Idade: {age} anos
                </span>
              );
            },
          } as any,
          {
            field: 'gender',
            label: 'Sexo',
            type: 'select',
            required: true,
            icon: <Users size={20} />,
            className: SELECT_W,
            options: [
              { label: 'Masculino', value: 'MALE' },
              { label: 'Feminino', value: 'FEMALE' },
              { label: 'Outro', value: 'OTHER' },
            ],
          },
          // Em edição o usuário já existe: a foto sobe na hora
          photoField(id),
        ],
      },
      {
        title: 'Contato',
        icon: <Phone size={20} />,
        fields: contactFields(),
      },
      {
        title: 'Acesso e Permissões',
        icon: <ShieldCheck size={20} />,
        fields: [
          activeField(),
          {
            field: 'password',
            label: 'Nova Senha',
            type: 'password',
            required: false,
            placeholder: 'Deixe em branco para manter a atual',
            icon: <Lock size={20} />,
            full: true,
            validation: {
              // O DynamicForm não valida pattern em campo vazio
              pattern: PASSWORD_PATTERN,
              patternMessage: 'A senha não atende aos requisitos mínimos.',
            },
            renderBottom: (value: any, _formValues: any, setFieldValue: any) => (
              <PasswordHelpers
                value={value}
                onGenerate={(pwd) => {
                  setFieldValue?.('password', pwd);
                  setFieldValue?.('password_confirm', pwd);
                }}
              />
            ),
          } as any,
          {
            field: 'password_confirm',
            label: 'Confirmar Nova Senha',
            type: 'password',
            required: false,
            placeholder: 'Confirme a nova senha',
            icon: <KeyRound size={20} />,
            full: true,
            validation: {
              custom: (value: any, formValues: { password: any }) => {
                if (formValues.password && value !== formValues.password) {
                  return 'As senhas não coincidem';
                }
                if (formValues.password && !value) {
                  return 'Por favor, confirme a nova senha';
                }
                return null;
              },
            },
          } as any,
          {
            field: 'user_group_id',
            label: 'Grupo de Usuário',
            type: 'select',
            required: false,
            icon: <Users size={20} />,
            className: SELECT_W,
            options: userGroupOptions,
            placeholder: 'Sem grupo',
          },
          ...(isSuperAdmin
            ? [
                {
                  field: 'role',
                  label: 'Papel (Role)',
                  type: 'select',
                  required: true,
                  icon: <BadgeCheck size={20} />,
                  className: SELECT_W,
                  options: [
                    { label: 'Administrador', value: 'ADMIN' },
                    { label: 'Super Administrador', value: 'SUPER_ADMIN' },
                  ],
                } as any,
              ]
            : []),
          timeRestrictionToggleField(),
          accessScheduleField(id),
        ],
      },
    ],
    [id, isSuperAdmin, userGroupOptions]
  );

  const transformData = (apiResponse: any) => {
    const userData = apiResponse.data || apiResponse;
    return {
      name: userData.name || '',
      email: userData.email || '',
      birth_date: userData.birth_date ? userData.birth_date.split('T')[0] : '',
      gender: userData.gender || 'MALE',
      password: '', // Inicia sempre vazio
      password_confirm: '',
      user_group_id: userData.user_group_id || '',
      ...profileFormValues(userData),
      ...(isSuperAdmin && { role: userData.role || 'ADMIN' }),
    };
  };

  const transformPayload = (data: any) => {
    // `photo` sobe pela rota própria; `access_schedules` vai por PUT .../schedule;
    // `password_confirm` não vai para a API.
    const { photo, access_schedules, password_confirm, ...rest } = data;
    void photo;
    void access_schedules;
    void password_confirm;

    pendingScheduleRef.current = {
      has_time_restriction: data.has_time_restriction === true,
      access_schedules: Array.isArray(data.access_schedules) ? data.access_schedules : [],
    };

    const payload: any = { ...rest, ...profilePayload(data) };

    if (!payload.password || String(payload.password).trim() === '') {
      delete payload.password;
    }

    // Somente SUPER_ADMIN pode alterar o papel
    if (!isSuperAdmin) {
      delete payload.role;
    }

    return payload;
  };

  const onSubmitSuccess = async () => {
    const pending = pendingScheduleRef.current;

    if (pending) {
      try {
        await fetch(`${process.env.NEXT_PUBLIC_URL_API}/users/${id}/schedule`, {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(schedulePayload(pending)),
        });
      } catch (e) {
        console.error('Dados salvos, mas a jornada não foi gravada:', e);
      } finally {
        pendingScheduleRef.current = null;
      }
    }

    showMessage('Administrador atualizado com sucesso!', 'success');
    router.push('/dashboard/administradores');
  };

  return (
    <DynamicForm
      resource="users"
      title="Administrador"
      basePath="/dashboard/administradores"
      mode="edit"
      id={id}
      steps={steps}
      transformData={transformData}
      transformResponse={transformPayload}
      onSubmitSuccess={onSubmitSuccess}
    />
  );
}
