import { NextRequest, NextResponse } from 'next/server';
import { withTenant } from '@/infra/auth/session';
import { runAction } from '@/shared/actions/action-result';
import { locationSuggestionSchema } from '@/shared/validators/location-suggestion';
import { suggestPropertyLocation } from '@/infra/geocoding/property-suggestion';

export async function POST(request: NextRequest) {
  const result = await runAction(() => withTenant(async session => {
    const address = locationSuggestionSchema.parse(await request.json());
    return suggestPropertyLocation(address, session.company_id!);
  }));
  return NextResponse.json(result, { status: result.ok ? 200 : result.status, headers: { 'Cache-Control': 'no-store' } });
}
