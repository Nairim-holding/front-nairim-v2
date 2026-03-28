import { fetchPropertySelectOptions } from '../_lib/propertyTransform';
import PropertyCreateForm from './PropertyCreateForm';

export default async function CadastrarImovelPage() {
  const options = await fetchPropertySelectOptions();
  return <PropertyCreateForm {...options} />;
}
