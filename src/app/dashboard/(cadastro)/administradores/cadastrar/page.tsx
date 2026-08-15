/* eslint-disable @typescript-eslint/no-explicit-any */
'use client';

import { useMemo, useRef } from 'react';
import { useRouter } from 'next/navigation';
import DynamicForm from '@/components/form/DynamicForm';
import { FormStep } from '@/types/types';
import { useMessageContext } from '@/contexts/MessageContext';
import { useUserGroupOptions } from '@/hooks/useUserGroupOptions';
import { createUserAction, uploadUserPhotoAction, setUserScheduleAction } from '@/server/actions/user';
import {
  User,
  UserIcon,
  Mail,
  Calendar,
  Users,
  ShieldCheck,
  Lock,
  KeyRound,
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
  profilePayload,
  schedulePayload,
} from '../_lib/fields';

export default function CadastrarAdministradorPage() {
  const { showMessage } = useMessageContext();
  const router = useRouter();
  const { options: userGroupOptions } = useUserGroupOptions();
  // As rotas de foto e agenda são /users/:id/..., e no cadastro ainda não há
  // id. Os valores escolhidos ficam aqui e sobem logo depois de criar o usuário.
  const pendingPhotoRef = useRef<File | null>(null);
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
          // Sem id ainda: o arquivo é guardado e sobe após criar o usuário
          photoField(undefined),
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
            label: 'Senha',
            type: 'password',
            required: true,
            placeholder: 'Insira a senha',
            icon: <Lock size={20} />,
            full: true,
            validation: {
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
            label: 'Confirmar Senha',
            type: 'password',
            required: true,
            placeholder: 'Confirme sua senha',
            icon: <KeyRound size={20} />,
            full: true,
            validation: {
              custom: (value: any, formValues: { password: any }) => {
                if (value !== formValues.password) return 'As senhas não coincidem';
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
          timeRestrictionToggleField(),
          accessScheduleField(undefined),
        ],
      },
    ],
    [userGroupOptions]
  );

  const transformResponse = (data: any) => {
    // `photo`, `access_schedules` e `password_confirm` não fazem parte do
    // payload de /users — sobem depois, quando o id já existe.
    const { photo, password_confirm, ...rest } = data;
    void password_confirm;

    pendingPhotoRef.current = photo instanceof File ? photo : null;
    pendingScheduleRef.current = {
      has_time_restriction: data.has_time_restriction === true,
      access_schedules: Array.isArray(data.access_schedules) ? data.access_schedules : [],
    };

    return {
      ...rest,
      ...profilePayload(data),
      role: 'ADMIN',
    };
  };

  const handleSubmit = async (data: any) => {
    const payload = transformResponse(data);
    const result = await createUserAction(payload);

    if (!result.ok) {
      if (result.status === 409) throw new Error('E-mail já cadastrado');
      throw new Error(result.error || 'Erro ao criar administrador');
    }

    return result;
  };

  const onSubmitSuccess = async (result: any) => {
    // O DynamicForm já desembrulha a resposta antes de chamar onSubmitSuccess
    // (finalizeSuccess passa `result.data` do envelope da API) — aqui `result`
    // É o usuário criado, não o envelope inteiro.
    const createdId = result?.id;
    if (!createdId) return;

    const pendingPhoto = pendingPhotoRef.current;
    const pendingSchedule = pendingScheduleRef.current;

    if (pendingPhoto) {
      try {
        const body = new FormData();
        body.append('file', pendingPhoto);
        const photoResult = await uploadUserPhotoAction(createdId, body);
        if (!photoResult.ok) {
          console.error('Usuário criado, mas a foto não foi enviada:', photoResult.error);
        }
      } catch (e) {
        // O usuário já foi criado; a foto pode ser enviada depois pela edição
        console.error('Usuário criado, mas a foto não foi enviada:', e);
      } finally {
        pendingPhotoRef.current = null;
      }
    }

    if (pendingSchedule) {
      try {
        const { schedules } = schedulePayload(pendingSchedule);
        const scheduleResult = await setUserScheduleAction(createdId, schedules);
        if (!scheduleResult.ok) {
          console.error('Usuário criado, mas a jornada não foi salva:', scheduleResult.error);
        }
      } catch (e) {
        console.error('Usuário criado, mas a jornada não foi salva:', e);
      } finally {
        pendingScheduleRef.current = null;
      }
    }

    showMessage('Administrador criado com sucesso!', 'success');
    router.push('/dashboard/administradores');
  };

  return (
    <DynamicForm
      resource="users"
      title="Administrador"
      basePath="/dashboard/administradores"
      mode="create"
      draftKey="form:users:create"
      steps={steps}
      onSubmit={handleSubmit}
      onSubmitSuccess={onSubmitSuccess}
    />
  );
}
