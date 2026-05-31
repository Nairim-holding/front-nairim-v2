export interface CompanyBranding {
  company_name: string | null;
  logo_url: string | null;
  favicon_url: string | null;
  primary_color: string | null;
  secondary_color: string | null;
  company_info: Record<string, unknown> | null;
}

export interface CompanyPublicData {
  company: { id: string; name: string; slug: string };
  branding: CompanyBranding | null;
}
