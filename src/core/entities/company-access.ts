export interface CompanyAccess {
  role: string;
  company_id?: string;
  all_companies_access?: boolean;
  allowed_company_ids?: readonly string[];
}

/** Grants expand company scope only; they never grant resource permissions. */
export function canAccessCompany(user: CompanyAccess, companyId: string): boolean {
  return user.role === 'SUPER_ADMIN' || user.all_companies_access === true ||
    user.company_id === companyId || user.allowed_company_ids?.includes(companyId) === true;
}
