# Vitrine pública de imóveis — Padrões de código

## Server Action (`src/server/actions/public.ts`)
```ts
export async function getPublicPropertiesAction(
  slug: string,
  raw?: Record<string, unknown>,
  opts?: { availableOnly?: boolean },
): Promise<ActionResult<PublicPaginated<PublicProperty>>> {
  return runAction(() => getPublicPropertiesData(slug, raw ?? {}, opts));
}
```

## Chamada no cliente (`src/components/filters/PropertyFilter/index.tsx`)
```tsx
      try {
        const result = await getPublicPropertiesAction(slug, { limit: 100 });
        if (!result.ok || !Array.isArray(result.data?.items)) throw new Error("empty");
        const seen = new Set<string>();
        const types: PropertyTypeOption[] = [];
```
