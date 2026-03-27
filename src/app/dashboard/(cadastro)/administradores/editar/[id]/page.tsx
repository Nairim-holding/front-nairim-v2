/* eslint-disable @typescript-eslint/no-explicit-any */
'use client';

import DynamicForm from '@/components/form/DynamicForm';
import { FormFieldDef } from '@/types/types';
import { useParams } from 'next/navigation';
import { Check, Circle } from 'lucide-react';

export default function EditarAdministradorPage() {
  const params = useParams();
  const id = params.id as string;

  const fields: FormFieldDef[] = [
    {
      field: 'name',
      label: 'Nome',
      type: 'text',
      required: true,
      placeholder: 'Nome do administrador',
    },
    {
      field: 'email',
      label: 'Email',
      type: 'email',
      required: true,
      placeholder: 'email@exemplo.com',
      validation: {
        pattern: /^[^\s@]+@[^\s@]+\.[^\s@]+$/,
        patternMessage: 'Email inválido'
      },
    },
    {
      field: 'birth_date',
      label: 'Data de Nascimento',
      type: 'date',
      required: true,
      renderBottom: (value: any) => {
        if (!value) return null;
        
        const [year, month, day] = value.split('-').map(Number);
        if (!year || !month || !day) return null;
        
        const today = new Date();
        let age = today.getFullYear() - year;
        const m = today.getMonth() - (month - 1);
        
        if (m < 0 || (m === 0 && today.getDate() < day)) {
          age--;
        }

        if (age < 0 || age > 130) return null;

        return (
          <span className="text-sm font-medium text-[#8B5CF6] mt-1.5 inline-block">
            Idade: {age} anos
          </span>
        );
      }
    } as any,
    {
      field: 'gender',
      label: 'Sexo',
      type: 'select',
      required: true,
      options: [
        { label: 'Masculino', value: 'MALE' },
        { label: 'Feminino', value: 'FEMALE' },
      ],
    },
    {
      field: 'password',
      label: 'Nova Senha',
      type: 'password',
      required: false, // É opcional
      placeholder: 'Deixe em branco para manter a atual',
      validation: {
        // Usamos o pattern direto, igual no Cadastro.
        // O DynamicFormManager já é inteligente o suficiente para não validar se o campo estiver vazio!
        pattern: /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[@$!%*?#&])[A-Za-z\d@$!%*?#&]{8,}$/,
        patternMessage: 'A senha não atende aos requisitos mínimos.'
      },
      className: 'mt-6',
      renderBottom: (value: any) => {
        const val = typeof value === 'string' ? value : '';
        
        // Só mostra o checklist na edição se o usuário começar a digitar uma nova senha
        if (!val) return null;

        const requirements = [
          { label: 'Pelo menos 8 caracteres', met: val.length >= 8 },
          { label: 'Letra maiúscula', met: /[A-Z]/.test(val) },
          { label: 'Letra minúscula', met: /[a-z]/.test(val) },
          { label: 'Número', met: /\d/.test(val) },
          { label: 'Símbolo (@$!%*?#&)', met: /[@$!%*?#&]/.test(val) },
        ];

        return (
          <div className="mt-3 p-3 bg-gray-50 border border-gray-200 rounded-lg max-w-[300px]">
            <p className="text-xs font-semibold text-gray-600 mb-2">Requisitos da senha:</p>
            <div className="flex flex-col gap-1.5">
              {requirements.map((req, idx) => (
                <div key={idx} className={`flex items-center gap-2 text-xs transition-colors ${req.met ? 'text-green-600 font-medium' : 'text-gray-400'}`}>
                  {req.met ? <Check size={14} className="text-green-600" /> : <Circle size={14} className="text-gray-300" />}
                  <span>{req.label}</span>
                </div>
              ))}
            </div>
          </div>
        );
      }
    } as any,
    {
      field: 'password_confirm',
      label: 'Confirmar Nova Senha',
      type: 'password',
      required: false,
      placeholder: 'Confirme a nova senha',
      validation: {
        custom: (value: any, formValues: { password: any }) => {
          if (formValues.password && value !== formValues.password) {
            return 'As senhas não coincidem';
          }
          if (formValues.password && !value) {
            return 'Por favor, confirme a nova senha';
          }
          return null;
        }
      },
      className: 'mt-6',
    },
  ];

  const transformData = (apiResponse: any) => {
    const userData = apiResponse.data || apiResponse;
    return {
      name: userData.name || '',
      email: userData.email || '',
      birth_date: userData.birth_date ? userData.birth_date.split('T')[0] : '',
      gender: userData.gender || 'MALE',
      password: '', // Inicia sempre vazio
      password_confirm: '', 
    };
  };

  const transformPayload = (data: any) => {
    const payload = { ...data };
    
    delete payload.password_confirm;
    
    if (!payload.password || payload.password.trim() === '') {
      delete payload.password;
    }
    
    return payload;
  };

  return (
    <DynamicForm
      resource="users"
      title="Administrador"
      basePath="/dashboard/administradores"
      mode="edit"
      id={id}
      fields={fields}
      transformData={transformData}
      transformResponse={transformPayload} 
    />
  );
}