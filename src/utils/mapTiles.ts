/**
 * URLs dos basemaps do CARTO, centralizadas.
 *
 * Desde 2025 o CARTO passou a exigir API key nos basemaps raster: sem a chave
 * os tiles voltam com a marca d'água "API KEY REQUIRED" estampada por cima do
 * mapa (não é erro de código, vem pronto do servidor deles).
 *
 * A chave é NEXT_PUBLIC_ porque tile é requisição feita pelo navegador: não há
 * como escondê-la no front. Trate-a como pública e restrinja por domínio no
 * painel do CARTO (https://carto.com/basemaps/apikey) em vez de tentar ocultá-la.
 * Se a variável não estiver definida, caímos no OpenStreetMap, que não pede
 * chave — o mapa perde o visual escuro, mas continua utilizável.
 */

const CARTO_API_KEY = process.env.NEXT_PUBLIC_CARTO_API_KEY ?? "";

const OSM_URL = "https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png";

export const OSM_ATTRIBUTION =
  '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors';

export const CARTO_ATTRIBUTION =
  '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors &copy; <a href="https://carto.com/attributions">CARTO</a>';

/** Estilos raster do CARTO usados no projeto. */
export type CartoBasemap =
  | "light_all"
  | "dark_all"
  | "light_nolabels"
  | "dark_nolabels"
  | "rastertiles/voyager";

export const hasCartoKey = CARTO_API_KEY.length > 0;

/**
 * Monta a URL do tile para um estilo do CARTO, ou devolve o OSM como fallback
 * quando não há chave configurada.
 */
export function getTileUrl(basemap: CartoBasemap): string {
  if (!hasCartoKey) return OSM_URL;
  // O parametro e `key`, nao `api_key`: com o nome errado o servidor ignora a
  // autenticacao em silencio (responde 200) e devolve o tile com a marca d'agua.
  return `https://{s}.basemaps.cartocdn.com/${basemap}/{z}/{x}/{y}{r}.png?key=${CARTO_API_KEY}`;
}

/** Atribuição correspondente ao provedor que `getTileUrl` acabou usando. */
export function getTileAttribution(): string {
  return hasCartoKey ? CARTO_ATTRIBUTION : OSM_ATTRIBUTION;
}

/** Atalho para os mapas que só alternam entre claro e escuro conforme o tema. */
export function getThemedTileUrl(isDark: boolean): string {
  return getTileUrl(isDark ? "dark_all" : "light_all");
}
