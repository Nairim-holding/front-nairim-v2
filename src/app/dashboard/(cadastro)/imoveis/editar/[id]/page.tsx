import { cookies } from 'next/headers';
import { fetchPropertySelectOptions, fetchProperty } from '../../_lib/propertyTransform';
import PropertyEditForm from './PropertyEditForm';

interface Props {
  params: Promise<{ id: string }>;
}

export default async function EditarImovelPage({ params }: Props) {
  const { id } = await params;
  const token = (await cookies()).get('authToken')?.value;
  const [options, propertyData] = await Promise.all([
    fetchPropertySelectOptions(token),
    fetchProperty(id, token),
  ]);

  return <PropertyEditForm id={id} propertyData={propertyData} {...options} />;
}
