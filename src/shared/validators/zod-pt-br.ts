import { z, ZodIssueCode } from 'zod';

/**
 * Traduz as mensagens automáticas do Zod (tipo/limites sem `.min(n, 'msg')`
 * explícito) para pt-BR. Schemas que já passam mensagem customizada continuam
 * usando essa mensagem — este mapa só cobre o fallback padrão do Zod, que sai
 * em inglês ("Number must be less than or equal to 100") e vazava cru para
 * `ActionFailure.errors` (ver `describeActionError`).
 *
 * Registrado uma única vez, no import deste módulo (efeito colateral
 * intencional) — `shared/actions/action-result.ts` importa isto para garantir
 * que rode antes de qualquer `.parse()` em Server Actions.
 */
const ptBRErrorMap: z.ZodErrorMap = (issue, ctx) => {
  switch (issue.code) {
    case ZodIssueCode.invalid_type:
      if (issue.received === 'undefined') return { message: 'Campo obrigatório' };
      return { message: `Tipo inválido: esperado ${issue.expected}, recebido ${issue.received}` };
    case ZodIssueCode.too_small:
      if (issue.type === 'string') {
        return issue.exact
          ? { message: `Deve ter exatamente ${issue.minimum} caractere(s)` }
          : { message: `Deve ter no mínimo ${issue.minimum} caractere(s)` };
      }
      if (issue.type === 'number' || issue.type === 'bigint') {
        return { message: `Deve ser maior ou igual a ${issue.minimum}` };
      }
      if (issue.type === 'array') {
        return { message: `Deve conter no mínimo ${issue.minimum} item(ns)` };
      }
      return { message: `Valor abaixo do mínimo permitido (${issue.minimum})` };
    case ZodIssueCode.too_big:
      if (issue.type === 'string') {
        return issue.exact
          ? { message: `Deve ter exatamente ${issue.maximum} caractere(s)` }
          : { message: `Deve ter no máximo ${issue.maximum} caractere(s)` };
      }
      if (issue.type === 'number' || issue.type === 'bigint') {
        return { message: `Deve ser menor ou igual a ${issue.maximum}` };
      }
      if (issue.type === 'array') {
        return { message: `Deve conter no máximo ${issue.maximum} item(ns)` };
      }
      return { message: `Valor acima do máximo permitido (${issue.maximum})` };
    case ZodIssueCode.invalid_string:
      if (issue.validation === 'email') return { message: 'E-mail inválido' };
      if (issue.validation === 'url') return { message: 'URL inválida' };
      if (issue.validation === 'uuid') return { message: 'Identificador inválido' };
      return { message: 'Formato inválido' };
    case ZodIssueCode.invalid_enum_value:
      return { message: `Valor inválido — opções aceitas: ${issue.options.join(', ')}` };
    case ZodIssueCode.invalid_date:
      return { message: 'Data inválida' };
    case ZodIssueCode.custom:
      return { message: ctx.defaultError };
    default:
      return { message: ctx.defaultError };
  }
};

z.setErrorMap(ptBRErrorMap);
