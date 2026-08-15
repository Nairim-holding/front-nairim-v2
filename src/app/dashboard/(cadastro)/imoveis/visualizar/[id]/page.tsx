import { cookies } from 'next/headers';
import { fetchPropertySelectOptions, fetchProperty } from '../../_lib/propertyData';
import PropertyViewForm from './PropertyViewForm';

interface Props {
  params: Promise<{ id: string }>;
}

export default async function VisualizarImovelPage({ params }: Props) {
  const { id } = await params;
  const token = (await cookies()).get('authToken')?.value;
  const [options, propertyData] = await Promise.all([
    fetchPropertySelectOptions(token),
    fetchProperty(id, token),
  ]);

  return <PropertyViewForm id={id} propertyData={propertyData} {...options} />;
}
