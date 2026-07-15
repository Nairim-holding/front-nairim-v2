/* eslint-disable @typescript-eslint/no-explicit-any */
'use client';

import DynamicForm from "@/components/form/DynamicForm";
import { FormFieldDef } from "@/types/types";
import { Check, Circle } from 'lucide-react'; // Ícones para o checklist

export default function CadastrarAdministradorPage() {
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
      // Nova propriedade customizada que criamos no DynamicFormManager
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

        // Evita mostrar idades negativas/absurdas enquanto o usuário digita (ex: ano "202")
        if (age < 0 || age > 130) return null;

        return (
          <span className="text-sm font-medium text-[#8B5CF6] mt-1.5 inline-block">
            Idade: {age} anos
          </span>
        );
      }
    } as any, // Cast necessário caso o renderBottom não esteja na interface original
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
      label: 'Senha',
      type: 'password',
      required: true,
      placeholder: 'Insira a senha',
      validation: {
        pattern: /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[@$!%*?#&\-_.])[A-Za-z\d@$!%*?#&\-_.]{8,}$/,
        patternMessage: 'A senha não atende aos requisitos mínimos.'
      },
      className: 'mt-6',
      // Checklist de Validação Visual
      renderBottom: (value: any) => {
        const val = typeof value === 'string' ? value : '';
        const requirements = [
          { label: 'Pelo menos 8 caracteres', met: val.length >= 8 },
          { label: 'Letra maiúscula', met: /[A-Z]/.test(val) },
          { label: 'Letra minúscula', met: /[a-z]/.test(val) },
          { label: 'Número', met: /\d/.test(val) },
          { label: 'Símbolo (@$!%*?#&-_.)', met: /[@$!%*?#&\-_.]/.test(val) },
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
      label: 'Confirmar Senha',
      type: 'password',
      required: true,
      placeholder: 'Confirme sua senha',
      validation: {
        custom: (value: any, formValues: { password: any; }) => {
          if (value !== formValues.password) {
            return 'As senhas não coincidem';
          }
          return null;
        }
      },
      className: 'mt-6',
    },
  ];

  const transformResponse = (data: any) => {
    return {
      ...data,
      role: 'ADMIN'
    };
  };

  return (
    <DynamicForm
      resource="users"
      title="Administrador"
      basePath="/dashboard/administradores"
      mode="create"
      draftKey="form:users:create"
      fields={fields}
      transformResponse={transformResponse}
    />
  );
}