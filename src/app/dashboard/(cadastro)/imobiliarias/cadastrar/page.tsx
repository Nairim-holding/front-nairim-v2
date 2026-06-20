import { cookies } from 'next/headers';
import { fetchAgencyFinancialOptions } from '../_lib/agencyFinancialOptions';
import CadastrarImobiliariaForm from './CadastrarImobiliariaForm';

export default async function CadastrarImobiliariaPage() {
  const token = (await cookies()).get('authToken')?.value;
  const { categoryOptions, subcategoriesRaw } = await fetchAgencyFinancialOptions(token);

  return <CadastrarImobiliariaForm categoryOptions={categoryOptions} subcategoriesRaw={subcategoriesRaw} />;
}
