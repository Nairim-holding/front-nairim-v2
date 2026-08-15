import { fetchAgencyFinancialOptions } from '../../_lib/agencyFinancialOptions';
import EditarImobiliariaForm from './EditarImobiliariaForm';

interface Props {
  params: Promise<{ id: string }>;
}

export default async function EditarImobiliariaPage({ params }: Props) {
  const { id } = await params;
  const { categoryOptions, subcategoriesRaw } = await fetchAgencyFinancialOptions();

  return <EditarImobiliariaForm id={id} categoryOptions={categoryOptions} subcategoriesRaw={subcategoriesRaw} />;
}
