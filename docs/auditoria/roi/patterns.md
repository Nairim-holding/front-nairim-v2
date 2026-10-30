# ROI por imóvel — Padrões de código

## Server Action (`src/server/actions/property-roi.ts`)
```ts
export async function saveRoiSettingsAction(input: Record<string, unknown>): Promise<ActionResult<RoiSettingsView>> {
  return runAction(async () => {
    const { lines } = roiSettingsSchema.parse(input);
    // O repositório confere que cada categoria/subcategoria é da própria empresa.
    return withPermission('financial-audit', 'edit', (session) => prismaPropertyRoiRepository.saveSettings(session.company_id, lines));
  });
}
```

## Chamada no cliente (`src/app/dashboard/(financeiro)/roi/_components/RoiSettingsModal.tsx`)
```tsx
    try {
      const result = await saveRoiSettingsAction({ lines });
      if (!result.ok) throw new Error(result.error ?? 'Erro ao salvar configuração.');
      showMessage('Configuração do ROI salva com sucesso', 'success', 2500);
      onSaved();
```
