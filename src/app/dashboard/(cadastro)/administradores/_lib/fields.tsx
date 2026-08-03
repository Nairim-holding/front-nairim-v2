/* eslint-disable @typescript-eslint/no-explicit-any */
'use client';

import { Check, Circle, Phone, Hash, Globe, PhoneCall, Clock, Camera, Power, Wand2 } from 'lucide-react';
import type { FormFieldDef } from '@/types/types';
import Toggle from '@/components/ui/Toggle';
import UserPhotoField from '@/components/domain/users/UserPhotoField';
import AccessScheduleGrid from '@/components/domain/users/AccessScheduleGrid';
import { useMessageContext } from '@/contexts/MessageContext';

/** Selects não têm largura própria no DynamicForm: sem isso encolhem até o
 *  conteúdo e o label amassa. 300px alinha com a largura padrão do Input. */
export const SELECT_W = 'w-full md:w-[300px]';

/**
 * Exige minúscula, maiúscula, dígito e ao menos um caractere não alfanumérico
 * — sem restringir QUAIS caracteres podem aparecer no resto da senha.
 *
 * A versão anterior fechava a senha inteira num whitelist de símbolos
 * (`[A-Za-z\d@$!%*?#&\-_.]`): uma senha com vírgula, aspas ou qualquer símbolo
 * fora dessa lista batia em todos os 4 requisitos do checklist (tinha
 * maiúscula, minúscula, número e ATÉ um símbolo da lista) e MESMO ASSIM falhava
 * na validação final, porque o caractere "extra" não pertencia ao whitelist —
 * e nada no checklist avisava disso. Resultado: usuário via tudo verde e um
 * erro genérico de "senha inválida".
 */
export const PASSWORD_PATTERN = /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[^A-Za-z0-9]).{8,}$/;

export function PasswordChecklist({ value }: { value: any }) {
  const val = typeof value === 'string' ? value : '';
  if (!val) return null;

  const requirements = [
    { label: 'Pelo menos 8 caracteres', met: val.length >= 8 },
    { label: 'Letra maiúscula', met: /[A-Z]/.test(val) },
    { label: 'Letra minúscula', met: /[a-z]/.test(val) },
    { label: 'Número', met: /\d/.test(val) },
    { label: 'Símbolo (qualquer não alfanumérico)', met: /[^A-Za-z0-9]/.test(val) },
  ];

  return (
    <div className="mt-3 p-3 bg-page border border-ui-border rounded-lg max-w-[300px]">
      <p className="text-xs font-semibold text-content-secondary mb-2">
        Requisitos da senha:
      </p>
      <div className="flex flex-col gap-1.5">
        {requirements.map((req) => (
          <div
            key={req.label}
            className={`flex items-center gap-2 text-xs transition-colors ${
              req.met ? 'text-green-600 font-medium' : 'text-content-muted'
            }`}
          >
            {req.met ? (
              <Check size={14} className="text-green-600" />
            ) : (
              <Circle size={14} className="text-content-muted" />
            )}
            <span>{req.label}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

/**
 * Senha aleatória que sempre satisfaz PASSWORD_PATTERN. Usa
 * `crypto.getRandomValues` (não Math.random) e garante pelo menos um
 * caractere de cada classe exigida antes de embaralhar. Evita 0/O/1/l/I —
 * caracteres que se confundem visualmente quando alguém precisa digitar a
 * senha lida na tela.
 */
export function generateSecurePassword(length = 14): string {
  const LOWER = 'abcdefghjkmnpqrstuvwxyz';
  const UPPER = 'ABCDEFGHJKMNPQRSTUVWXYZ';
  const DIGITS = '23456789';
  const SYMBOLS = '!@#$%^&*-_+=?';
  const ALL = LOWER + UPPER + DIGITS + SYMBOLS;

  const randomIndex = (max: number) => {
    const buf = new Uint32Array(1);
    crypto.getRandomValues(buf);
    return buf[0] % max;
  };
  const pick = (pool: string) => pool[randomIndex(pool.length)];

  const chars = [pick(LOWER), pick(UPPER), pick(DIGITS), pick(SYMBOLS)];
  while (chars.length < length) chars.push(pick(ALL));

  // Fisher-Yates com índices criptográficos — sem isso, os 4 primeiros
  // caracteres ficariam sempre nas mesmas posições/classes.
  for (let i = chars.length - 1; i > 0; i--) {
    const j = randomIndex(i + 1);
    [chars[i], chars[j]] = [chars[j], chars[i]];
  }

  return chars.join('');
}

/**
 * Botão "gerar senha segura" + checklist, para o `renderBottom` do campo de
 * senha. `onGenerate` recebe a senha gerada — quem chama decide em quais
 * campos ela entra (normalmente senha + confirmação, ao mesmo tempo).
 */
export function PasswordHelpers({
  value,
  onGenerate,
}: {
  value: any;
  onGenerate: (password: string) => void;
}) {
  const { showMessage } = useMessageContext();

  const handleGenerate = async () => {
    const generated = generateSecurePassword();
    onGenerate(generated);

    try {
      await navigator.clipboard.writeText(generated);
      showMessage('Senha gerada e copiada para a área de transferência.', 'success');
    } catch {
      showMessage('Senha gerada. Clique no ícone de olho para revelar e copiar.', 'success');
    }
  };

  return (
    <div className="mt-3 flex flex-col gap-3">
      <button
        type="button"
        onClick={handleGenerate}
        className="self-start flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-lg bg-ui-border hover:bg-ui-border-muted text-content-secondary transition-colors"
      >
        <Wand2 size={14} />
        Gerar senha segura
      </button>
      <PasswordChecklist value={value} />
    </div>
  );
}

/** Só dígitos — espelha a validação do backend. Para DDI/Área/Ramal: números
 *  curtos sem separador natural, uma máscara com pontuação não ajudaria. */
const digitsOnly = (max: number) => ({
  pattern: new RegExp(`^\\d{0,${max}}$`),
  patternMessage: `Use apenas números (até ${max} dígitos)`,
});

/** Campo Foto. `userId` ausente = cadastro: o arquivo sobe depois de salvar. */
export function photoField(userId?: string, readOnly = false): FormFieldDef {
  return {
    field: 'photo',
    label: 'Foto',
    type: 'custom',
    className: 'w-full',
    icon: <Camera size={20} />,
    render: (value: any, _formValues: any, onChange: any) => (
      <UserPhotoField
        value={Array.isArray(value) ? null : value}
        onChange={onChange}
        userId={userId}
        disabled={readOnly}
      />
    ),
  } as any;
}

/** Passo "Contato" — DDI, Área, Telefone e Ramal. */
export function contactFields(readOnly = false): FormFieldDef[] {
  return [
    {
      field: 'phone_country_code',
      label: 'DDI',
      type: 'text',
      placeholder: '55',
      maxLength: 5,
      icon: <Globe size={20} />,
      readOnly,
      validation: digitsOnly(5),
    } as any,
    {
      field: 'phone_area_code',
      label: 'Área',
      type: 'text',
      placeholder: '11',
      maxLength: 5,
      icon: <Hash size={20} />,
      readOnly,
      validation: digitsOnly(5),
    } as any,
    {
      // Máscara "sem DDD" (existente no componente Input, ao lado de cpf/cnpj/
      // cep/telefone) — este campo guarda só o número local, já que a área vem
      // separada em phone_area_code.
      field: 'phone',
      label: 'Telefone',
      type: 'text',
      placeholder: '98888-7777',
      maxLength: 10,
      mask: 'telefoneSemDDD',
      icon: <Phone size={20} />,
      readOnly,
    } as any,
    {
      field: 'phone_extension',
      label: 'Ramal',
      type: 'text',
      placeholder: '1234',
      maxLength: 10,
      icon: <PhoneCall size={20} />,
      readOnly,
      validation: digitsOnly(10),
    } as any,
  ];
}

/** Toggle "Ativo". */
export function activeField(readOnly = false): FormFieldDef {
  return {
    field: 'is_active',
    label: 'Ativo',
    type: 'custom',
    className: 'w-full',
    icon: <Power size={20} />,
    render: (value: any, _formValues: any, onChange: any) => (
      <Toggle
        checked={value === true}
        onChange={(checked) => onChange(checked)}
        disabled={readOnly}
        label={value === true ? 'Usuário ativo' : 'Usuário inativo'}
      />
    ),
  } as any;
}

/**
 * Escolha binária "sem controle" / "horário restrito", como no print: dois
 * botões estilo rádio em vez do Toggle usado nas outras seções — aqui o
 * rótulo de cada opção é o próprio texto da regra, não um estado ligado/desligado.
 */
export function timeRestrictionToggleField(readOnly = false): FormFieldDef {
  const OPTIONS = [
    { on: false, text: 'Permitir o acesso em qualquer horário' },
    { on: true, text: 'Limitar o acesso em horários específicos' },
  ];

  return {
    field: 'has_time_restriction',
    label: 'Controle de horário',
    type: 'custom',
    className: 'w-full',
    icon: <Clock size={20} />,
    render: (value: any, _formValues: any, onChange: any) => (
      <div className="flex flex-col sm:flex-row gap-3">
        {OPTIONS.map((opt) => {
          const active = (value === true) === opt.on;
          return (
            <button
              key={String(opt.on)}
              type="button"
              disabled={readOnly}
              onClick={() => onChange(opt.on)}
              className={`flex items-center gap-2.5 px-4 py-2.5 rounded-lg border text-sm text-left transition-colors ${
                active
                  ? 'border-[var(--color-brand-primary)] bg-[var(--color-brand-primary)]/10 text-content'
                  : 'border-ui-border text-content-secondary hover:bg-surface-subtle'
              } ${readOnly ? 'cursor-default' : 'cursor-pointer'}`}
            >
              <span
                className={`w-4 h-4 rounded-full border-2 flex items-center justify-center shrink-0 ${
                  active ? 'border-[var(--color-brand-primary)]' : 'border-ui-border-strong'
                }`}
              >
                {active && <span className="w-2 h-2 rounded-full bg-[var(--color-brand-primary)]" />}
              </span>
              {opt.text}
            </button>
          );
        })}
      </div>
    ),
  } as any;
}

/**
 * Grade de jornada (dia × hora). Só aparece quando "horário restrito" está
 * selecionado — `hidden` aceita função.
 */
export function accessScheduleField(userId?: string, readOnly = false): FormFieldDef {
  return {
    field: 'access_schedules',
    label: '',
    type: 'custom',
    className: 'col-span-full',
    hidden: (formValues: any) => formValues?.has_time_restriction !== true,
    render: (value: any, _formValues: any, onChange: any) => (
      <AccessScheduleGrid
        value={Array.isArray(value) ? value : []}
        onChange={onChange}
        userId={userId}
        disabled={readOnly}
      />
    ),
  } as any;
}

/**
 * Campos de perfil vindos da API → valores do formulário.
 * `access_schedules` não entra aqui: o AccessScheduleGrid carrega a própria
 * jornada via `userId` (mesmo padrão da matriz de permissões do grupo).
 */
export function profileFormValues(userData: any) {
  return {
    photo: userData.photo_url || null,
    is_active: userData.is_active !== false,
    phone_country_code: userData.phone_country_code || '',
    phone_area_code: userData.phone_area_code || '',
    phone: userData.phone || '',
    phone_extension: userData.phone_extension || '',
    has_time_restriction: userData.has_time_restriction === true,
  };
}

/**
 * Valores do formulário → payload de PUT /users/:id. `photo` e
 * `access_schedules` são tratados à parte (upload / PUT .../schedule).
 */
export function profilePayload(data: any) {
  return {
    is_active: data.is_active === true,
    phone_country_code: data.phone_country_code || null,
    phone_area_code: data.phone_area_code || null,
    phone: data.phone || null,
    phone_extension: data.phone_extension || null,
    has_time_restriction: data.has_time_restriction === true,
  };
}

/** Payload de PUT /users/:id/schedule — vazio quando a restrição está desligada. */
export function schedulePayload(data: any) {
  return {
    schedules: data.has_time_restriction === true && Array.isArray(data.access_schedules)
      ? data.access_schedules
      : [],
  };
}
