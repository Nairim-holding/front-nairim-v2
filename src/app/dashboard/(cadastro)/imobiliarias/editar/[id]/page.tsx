import { cookies } from 'next/headers';
import { fetchAgencyFinancialOptions } from '../../_lib/agencyFinancialOptions';
import EditarImobiliariaForm from './EditarImobiliariaForm';

interface Props {
  params: Promise<{ id: string }>;
}

export default async function EditarImobiliariaPage({ params }: Props) {
  const { id } = await params;
  const token = (await cookies()).get('authToken')?.value;
  const { categoryOptions, subcategoriesRaw } = await fetchAgencyFinancialOptions(token);

  return <EditarImobiliariaForm id={id} categoryOptions={categoryOptions} subcategoriesRaw={subcategoriesRaw} />;
}
