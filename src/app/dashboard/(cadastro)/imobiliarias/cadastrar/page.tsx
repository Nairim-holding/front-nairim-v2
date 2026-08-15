import { fetchAgencyFinancialOptions } from '../_lib/agencyFinancialOptions';
import CadastrarImobiliariaForm from './CadastrarImobiliariaForm';

export default async function CadastrarImobiliariaPage() {
  const { categoryOptions, subcategoriesRaw } = await fetchAgencyFinancialOptions();

  return <CadastrarImobiliariaForm categoryOptions={categoryOptions} subcategoriesRaw={subcategoriesRaw} />;
}
