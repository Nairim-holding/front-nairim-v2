/**
 * Erros de domínio da aplicação.
 *
 * Substituem o tratamento ad-hoc de erros que o backend Express fazia via
 * `throw new Error('mensagem')` + inspeção de string no `middlewares/error.ts`.
 * Aqui cada erro carrega o seu próprio `statusCode`, o que permite às Server
 * Actions (shared/actions) mapear a falha sem adivinhar pelo texto da mensagem.
 *
 * Camada: core (não depende de HTTP nem de Prisma).
 *
 * Origem: api-nairim-v2/src/middlewares/error.ts e os `throw new Error(...)`
 * espalhados pelos Services (ex: AuthService 'Credenciais inválidas').
 */

/**
 * Erro base do domínio. Toda falha esperada de regra de negócio deve estender
 * esta classe para que o handler HTTP produza o status e o corpo corretos.
 */
export abstract class DomainError extends Error {
  /** Status HTTP sugerido para este erro. */
  abstract readonly statusCode: number;

  /** Lista opcional de mensagens de detalhe (ex: erros de validação de campos). */
  readonly errors?: string[];

  constructor(message: string, errors?: string[]) {
    super(message);
    this.name = new.target.name;
    this.errors = errors;
    // Mantém a cadeia de protótipos correta ao estender Error em TS.
    Object.setPrototypeOf(this, new.target.prototype);
  }
}

/** 400 — entrada inválida (falha de schema/validação de negócio). */
export class ValidationError extends DomainError {
  readonly statusCode = 400;
}

/** 401 — não autenticado (token ausente, inválido ou expirado). */
export class UnauthorizedError extends DomainError {
  readonly statusCode = 401;
  constructor(message = 'Não autorizado', errors?: string[]) {
    super(message, errors);
  }
}

/** 401 — credenciais de login inválidas (e-mail/senha). Genérico por segurança. */
export class InvalidCredentialsError extends DomainError {
  readonly statusCode = 401;
  constructor(message = 'Credenciais inválidas') {
    super(message);
  }
}

/** 403 — autenticado, mas sem permissão para a operação. */
export class ForbiddenError extends DomainError {
  readonly statusCode = 403;
  constructor(message = 'Acesso negado', errors?: string[]) {
    super(message, errors);
  }
}

/** 404 — recurso não encontrado. */
export class NotFoundError extends DomainError {
  readonly statusCode = 404;
  constructor(message = 'Recurso não encontrado') {
    super(message);
  }
}

/** 409 — conflito (ex: violação de unicidade). */
export class ConflictError extends DomainError {
  readonly statusCode = 409;
  constructor(message = 'Conflito de dados', errors?: string[]) {
    super(message, errors);
  }
}

/** 429 — excesso de requisições (ex: rate limit de login). */
export class TooManyRequestsError extends DomainError {
  readonly statusCode = 429;
  constructor(message = 'Muitas requisições. Tente novamente mais tarde.') {
    super(message);
  }
}
