export interface CompanyBranding {
  company_name: string | null;
  logo_url: string | null;
  favicon_url: string | null;
  primary_color: string | null;
  secondary_color: string | null;
  company_info: Record<string, unknown> | null;

  trade_name: string | null;
  app_title: string | null;
  app_description: string | null;
  logo_sidebar_url: string | null;
  logo_dark_url: string | null;
  og_image_url: string | null;

  accent_color: string | null;
  success_color: string | null;
  warning_color: string | null;
  error_color: string | null;
  info_color: string | null;
  bg_color: string | null;
  card_color: string | null;
  border_color: string | null;
  text_color: string | null;

  primary_color_dark: string | null;
  secondary_color_dark: string | null;
  accent_color_dark: string | null;
  success_color_dark: string | null;
  warning_color_dark: string | null;
  error_color_dark: string | null;
  info_color_dark: string | null;
  bg_color_dark: string | null;
  card_color_dark: string | null;
  border_color_dark: string | null;
  text_color_dark: string | null;
}

export interface CompanyPublicData {
  company: { id: string; name: string; slug: string };
  branding: CompanyBranding | null;
}
