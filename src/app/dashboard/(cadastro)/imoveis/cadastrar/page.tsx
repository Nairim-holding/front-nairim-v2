import { cookies } from 'next/headers';
import { fetchPropertySelectOptions } from '../_lib/propertyData';
import PropertyCreateForm from './PropertyCreateForm';

export default async function CadastrarImovelPage() {
  const token = (await cookies()).get('authToken')?.value;
  const options = await fetchPropertySelectOptions(token);
  return <PropertyCreateForm {...options} />;
}
