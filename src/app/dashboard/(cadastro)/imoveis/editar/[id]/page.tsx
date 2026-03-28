import { fetchPropertySelectOptions, fetchProperty } from '../../_lib/propertyTransform';
import PropertyEditForm from './PropertyEditForm';

interface Props {
  params: Promise<{ id: string }>;
}

export default async function EditarImovelPage({ params }: Props) {
  const { id } = await params;
  const [options, propertyData] = await Promise.all([
    fetchPropertySelectOptions(),
    fetchProperty(id),
  ]);

  return <PropertyEditForm id={id} propertyData={propertyData} {...options} />;
}
