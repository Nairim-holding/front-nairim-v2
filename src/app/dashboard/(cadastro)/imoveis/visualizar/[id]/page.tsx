import { fetchPropertySelectOptions, fetchProperty } from '../../_lib/propertyTransform';
import PropertyViewForm from './PropertyViewForm';

interface Props {
  params: Promise<{ id: string }>;
}

export default async function VisualizarImovelPage({ params }: Props) {
  const { id } = await params;
  const [options, propertyData] = await Promise.all([
    fetchPropertySelectOptions(),
    fetchProperty(id),
  ]);

  return <PropertyViewForm id={id} propertyData={propertyData} {...options} />;
}
