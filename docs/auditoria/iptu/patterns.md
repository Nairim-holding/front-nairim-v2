# Auditoria de IPTU — Padrões de código

## Server Action (`src/server/actions/iptu-audit.ts`)
```ts
export async function saveIptuAuditSettingsAction(input: Record<string, unknown>): Promise<ActionResult<IptuAuditSettings>> {
  return runAction(async () => {
    const data = iptuAuditSettingsSchema.parse(input);
    return withPermissionInput('financial-audit', 'edit', input, (session) => iptuAuditUseCases.saveSettings.execute(session.company_id, data));
  });
}
```

## Chamada no cliente (`src/app/dashboard/(financeiro)/financeiro-auditoria/_components/IptuAuditSettingsModal.tsx`)
```tsx
      const result = await saveIptuAuditSettingsAction({ ...payload });
      if (!result.ok) throw new Error(result.error ?? 'Erro ao salvar configuração.');

      showMessage('Configuração da Auditoria de IPTU salva com sucesso', 'success', 2500);
```
