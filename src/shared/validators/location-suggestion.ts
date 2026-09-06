import { z } from 'zod';

export const locationSuggestionSchema = z.object({
  street: z.string().trim().min(3).max(200),
  number: z.string().trim().min(1).max(30),
  district: z.string().trim().max(120).optional().default(''),
  city: z.string().trim().min(2).max(120),
  state: z.string().trim().regex(/^[a-zA-Z]{2}$/).transform(s => s.toUpperCase()),
  zip_code: z.string().trim().max(10).optional().default(''),
  country: z.string().trim().max(60).optional().default('Brasil'),
});
export type SuggestionAddress = z.infer<typeof locationSuggestionSchema>;
export interface LocationSuggestion {
  latitude: number;
  longitude: number;
  precision: 'address' | 'approximate';
  label: string;
}
