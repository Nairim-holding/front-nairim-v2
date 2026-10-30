# Autenticação e sessão — Padrões de código

## Server Action (`src/server/actions/auth.ts`)
```ts
export async function loginAction(input: { email: string; password: string }): Promise<LoginActionResult> {
  const parsed = loginSchema.safeParse(input);
  if (!parsed.success) {
    return { ok: false, message: parsed.error.issues[0]?.message ?? 'Erro de validação' };
  }

  const emailKey = parsed.data.email.toLowerCase().trim();
  let ip = 'desconhecido';

  try {
    ip = await getRequestIp();

```

## Chamada no cliente (`src/app/(auth)/login/LoginFormWrapper.tsx`)
```tsx
    try {
      const data = await loginAction({ email, password });

      if (!data.ok) {
        // Se temos status de rate limit da action, usamos
```
