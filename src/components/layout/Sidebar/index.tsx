"use client";
import { useState, useEffect, useRef, useMemo } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  Menu,
  Pin,
  Home,
  Moon,
  Sun,
  PlusCircle,
  Settings,
  LogOut,
  Key,
  UserPlus,
  ChevronDown,
  House,
  Building2,
  UserCheck,
  UserCircle,
  Tag,
  PiggyBank,
  Landmark,
  CreditCard,
  ChartColumnStacked,
  HandCoins,
  Users,
  FolderInput,
  BarChart2,
  Briefcase,
  FileClock,
  FileBarChart2,
  SearchCheck,
  TrendingUp,
  Percent
} from "lucide-react";
import Logo from "../Logo";
import CompanySwitcher from "../CompanySwitcher";
import { useAuth } from "@/contexts/AuthContext";
import { usePermissions } from "@/contexts/PermissionsContext";
import { normalizeDashboardPathname, resourceForHref } from "@/utils/permissionResource";
import { useTheme } from "@/contexts/ThemeContext";
import type { LucideIcon } from "lucide-react";

interface SubmenuItem {
  href: string;
  icon: LucideIcon;
  label: string;
  resource?: string;
  disabled?: boolean;
  isSeparatorBefore?: boolean;
}

interface NavItem {
  href: string;
  label: string;
  submenu?: SubmenuItem[];
}

/**
 * Item de menu que cobre a rota atual, com a seção (accordion) que o contém.
 *
 * Casa por prefixo para que subpáginas fiquem marcadas — `/dashboard/imoveis/
 * editar/123` acende "Imóvel" —, e escolhe o prefixo MAIS LONGO para que
 * `/dashboard/locacoes/relatorios` não caia no item `/dashboard/locacoes`.
 */
function findActiveEntry(
  items: NavItem[],
  currentPath: string,
): { href: string; parentLabel: string | null } | null {
  let best: { href: string; parentLabel: string | null } | null = null;

  const consider = (href: string, parentLabel: string | null) => {
    if (!href || href === '#') return;
    if (currentPath !== href && !currentPath.startsWith(`${href}/`)) return;
    if (!best || href.length > best.href.length) best = { href, parentLabel };
  };

  for (const item of items) {
    if (item.submenu) item.submenu.forEach((sub) => consider(sub.href, item.label));
    else consider(item.href, null);
  }

  return best;
}

interface AsideProps {
  isOpen?: boolean;
  onToggle?: () => void;
  isPinned?: boolean;
  onTogglePin?: () => void;
}

export default function Aside({
  isOpen: propIsOpen,
  onToggle: propOnToggle,
  isPinned = false,
  onTogglePin,
}: AsideProps) {
  const [internalIsOpen, setInternalIsOpen] = useState(true);
  const isOpen = propIsOpen ?? internalIsOpen;
  const handleToggle = propOnToggle ?? (() => setInternalIsOpen((prev) => !prev));

  /**
   * Seção aberta manualmente, presa à rota em que o clique aconteceu.
   *
   * Guardar o `path` junto é o que faz o accordion "seguir" a navegação sem
   * `useEffect`: assim que a rota muda, a escolha manual deixa de valer e a
   * seção da nova página assume (ver `openSubmenu` abaixo).
   */
  const [manualSubmenu, setManualSubmenu] = useState<{ path: string; label: string | null } | null>(null);
  const [isDarkModeAnimating, setIsDarkModeAnimating] = useState(false);
  const submenuRef = useRef<HTMLDivElement>(null);

  // Rota atual sem o `/{slug}` — os href do menu são sempre `/dashboard/...`.
  const currentPath = normalizeDashboardPathname(usePathname());

  const { logout, user } = useAuth();
  const { can } = usePermissions();
  const { isDark, toggleTheme } = useTheme();
  const isSuperAdmin = user?.role === 'SUPER_ADMIN';

  const handleItemClick = (href: string) => {
    if (href !== "#") {
      // Sem alfinete: navegar e ocultar o menu, dando foco à página aberta.
      // Com o alfinete fixado: o menu permanece sempre visível.
      // O accordion NÃO é fechado aqui: quem manda nele é a rota (ver
      // `openSubmenu`), senão o menu voltaria vazio na página recém-aberta.
      if (!isPinned) {
        handleToggle();
      }
    }
  };

  const handleSubmenuClick = (e: React.MouseEvent, label: string) => {
    e.stopPropagation();
    setManualSubmenu({ path: currentPath, label: openSubmenu === label ? null : label });
  };

  const handleDarkModeToggle = () => {
    setIsDarkModeAnimating(true);
    toggleTheme();
    setTimeout(() => {
      setIsDarkModeAnimating(false);
    }, 300);
  };

  const menuItems = useMemo(() => {
    const raw = [
      { href: "/dashboard", icon: Home, label: "Resumo", resource: resourceForHref("/dashboard") },
      {
        href: "#",
        icon: PlusCircle,
        label: "Cadastrar",
        submenu: ([
          { href: "/dashboard/administradores", icon: UserPlus, label: "Administrador", resource: resourceForHref("/dashboard/administradores") },
          { href: "/dashboard/grupos-usuario", icon: Users, label: "Grupo de Usuário", resource: resourceForHref("/dashboard/grupos-usuario") },
          ...(isSuperAdmin ? [{ href: "/dashboard/empresas", icon: Briefcase, label: "Empresa", resource: resourceForHref("/dashboard/empresas") }] : []),
          { href: "/dashboard/imoveis", icon: House, label: "Imóvel", resource: resourceForHref("/dashboard/imoveis") },
          { href: "/dashboard/imobiliarias", icon: Building2, label: "Imobiliária", resource: resourceForHref("/dashboard/imobiliarias") },
          { href: "/dashboard/inquilinos", icon: UserCheck, label: "Inquilinos", resource: resourceForHref("/dashboard/inquilinos") },
          { href: "/dashboard/proprietarios", icon: UserCircle, label: "Proprietários", resource: resourceForHref("/dashboard/proprietarios") },
          { href: "/dashboard/tipo-imovel", icon: Tag, label: "Tipo Imóvel", resource: resourceForHref("/dashboard/tipo-imovel") },
          { href: "/dashboard/indices-reajuste", icon: Percent, label: "Índices de Reajuste", resource: resourceForHref("/dashboard/indices-reajuste") },
        ] as SubmenuItem[]).filter((sub) => can(sub.resource, 'view')),
      },
      {
        href: "#",
        icon: Key,
        label: "Locações",
        submenu: ([
          { href: "/dashboard/locacoes", icon: Key, label: "Locações", resource: resourceForHref("/dashboard/locacoes") },
          { href: "/dashboard/locacoes/relatorios", icon: FileBarChart2, label: "Relatórios", resource: resourceForHref("/dashboard/locacoes/relatorios"), isSeparatorBefore: true },
        ] as SubmenuItem[]).filter((sub) => can(sub.resource, 'view')),
      },
      {
        href: "#",
        icon: PiggyBank,
        label: "Financeiro",
        submenu: ([
          { href: "/dashboard/instituicoes-financeiras", icon: Landmark, label: "Instituições Financeiras", resource: resourceForHref("/dashboard/instituicoes-financeiras") },
          { href: "/dashboard/categorias", icon: ChartColumnStacked, label: "Categorias/Subcategorias", resource: resourceForHref("/dashboard/categorias") },
          { href: "/dashboard/cartoes", icon: CreditCard, label: "Cartões de Crédito", resource: resourceForHref("/dashboard/cartoes") },
          { href: "/dashboard/centros", icon: HandCoins, label: "Centros", resource: resourceForHref("/dashboard/centros") },
          { href: "/dashboard/fornecedores", icon: Users, label: "Contatos", resource: resourceForHref("/dashboard/fornecedores") },
          { href: "/dashboard/lancamentos", icon: FolderInput, label: "Lançamentos", resource: resourceForHref("/dashboard/lancamentos") },
          { href: "/dashboard/planejamento", icon: BarChart2, label: "Planejamento e Controle", resource: resourceForHref("/dashboard/planejamento") },
          { href: "/dashboard/investimentos", icon: TrendingUp, label: "Meus Investimentos", resource: resourceForHref("/dashboard/investimentos") },
          { href: "/dashboard/relatorios", icon: FileBarChart2, label: "Relatórios", resource: resourceForHref("/dashboard/relatorios"), isSeparatorBefore: true },
        ] as SubmenuItem[]).filter((sub) => can(sub.resource, 'view')),
      },
      { href: "/dashboard/configuracoes", icon: Settings, label: "Configurações", resource: resourceForHref("/dashboard/configuracoes") },
      {
        href: "#",
        icon: FileClock,
        label: "Auditoria",
        submenu: ([
          { href: "/dashboard/financeiro-auditoria", icon: SearchCheck, label: "IPTU", resource: resourceForHref("/dashboard/financeiro-auditoria") },
          { href: "#", icon: TrendingUp, label: "ROI", disabled: true },
          { href: "/dashboard/auditoria", icon: FileClock, label: "Logs", resource: resourceForHref("/dashboard/auditoria") },
        ] as SubmenuItem[]).filter((sub) => sub.disabled === true || can(sub.resource, 'view')),
      },
    ];

    return raw.filter((item) => (item.submenu ? item.submenu.length > 0 : can(item.resource, 'view')));
  }, [isSuperAdmin, can]);

  // Sem `useMemo`: são poucas dezenas de comparações de string por render,
  // barato o bastante para não valer o custo de memoizar.
  const activeEntry = findActiveEntry(menuItems as NavItem[], currentPath);
  const activeItem = activeEntry?.href ?? null;
  const routeSubmenuLabel = activeEntry?.parentLabel ?? null;

  // Estado derivado, sem efeito: numa subpágina (inclusive chegando por
  // redirect ou link direto) a seção que a contém já vem aberta e marcada; a
  // escolha manual só prevalece enquanto o usuário continuar na mesma rota.
  const openSubmenu =
    manualSubmenu && manualSubmenu.path === currentPath ? manualSubmenu.label : routeSubmenuLabel;

  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (submenuRef.current && !submenuRef.current.contains(event.target as Node)) {
        // Descarta só a escolha manual: a seção da rota atual continua aberta,
        // porque fechá-la esconderia a página em que o usuário está.
        setManualSubmenu(null);
      }
    }
    if (openSubmenu) {
      document.addEventListener("mousedown", handleClickOutside);
    }
    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
    };
  }, [openSubmenu]);

  const handleLogout = async () => {
    logout();
    setManualSubmenu(null);
  };

  return (
    <>
      {/* Overlay Mobile */}
      {isOpen && (
        <div
          className="fixed inset-0 bg-black/40 backdrop-blur-xs z-[990] md:hidden transition-opacity duration-300"
          onClick={handleToggle}
        />
      )}

      {/* Painel do Sidebar — Moldura com borda visível e cor interna clara (Modelo de Referência) */}
      <aside
        className={`fixed top-3 left-3 bottom-3 z-[1000] w-[260px] bg-surface border border-ui-border-soft rounded-2xl shadow-xl flex flex-col transition-all duration-300 ease-in-out ${
          isOpen ? "translate-x-0 opacity-100 pointer-events-auto" : "-translate-x-[290px] opacity-0 pointer-events-none"
        }`}
      >
        {/* Topo: Seletor de Encolher/Abrir + Logo + Alfinete (Pin) para manter sempre fixado/expandido */}
        <div className="flex items-center justify-between px-4 py-4 border-b border-ui-border-soft">
          <div className="flex items-center gap-2 min-w-0">
            <button
              onClick={handleToggle}
              className="p-1.5 rounded-lg text-content-secondary hover:text-content hover:bg-surface-subtle transition-colors focus:outline-none shrink-0"
              title="Encolher menu"
            >
              <Menu size={20} />
            </button>

            <Link href="/dashboard" className="flex items-center truncate">
              <Logo className="text-brand-logo" variant="sidebar" />
            </Link>
          </div>

          {onTogglePin && (
            <button
              onClick={onTogglePin}
              className={`p-1.5 rounded-lg transition-colors focus:outline-none shrink-0 ${
                isPinned
                  ? "bg-brand/10 text-brand font-semibold border border-brand/30"
                  : "text-content-muted hover:text-content hover:bg-surface-subtle"
              }`}
              title={isPinned ? "Menu fixado (sempre expandido)" : "Fixar menu sempre expandido"}
            >
              <Pin size={18} className={isPinned ? "rotate-45 text-brand" : ""} />
            </button>
          )}
        </div>

        {isSuperAdmin && (
          <div className="px-3 pt-3">
            <CompanySwitcher isOpen={isOpen} onNavigate={() => { if (!isPinned) handleToggle(); }} />
          </div>
        )}

        {/* Lista de Navegação */}
        <div className="flex-1 w-full overflow-hidden py-3 px-3">
          <nav className="h-full" ref={submenuRef}>
            <ul className="space-y-1.5 h-full overflow-y-auto pr-1 custom-scrollbar">
              {menuItems.map((item) => {
                const isSubmenuOpen = openSubmenu === item.label;
                const isActive = activeItem === item.href;

                return (
                  <li key={item.label} className="relative">
                    {item.submenu ? (
                      <>
                        <button
                          onClick={(e) => handleSubmenuClick(e, item.label)}
                          className={`flex items-center w-full px-3 py-2.5 rounded-xl text-sm font-medium transition-all duration-200 ${
                            isSubmenuOpen
                              ? "bg-surface-subtle text-content"
                              : "text-content-secondary hover:bg-surface-subtle hover:text-content"
                          }`}
                        >
                          <item.icon size={18} className="min-w-[20px] text-content-muted" />
                          <span className="ml-3 flex-1 text-left">{item.label}</span>
                          <ChevronDown
                            size={15}
                            className={`transition-transform duration-200 text-content-muted ${
                              isSubmenuOpen ? "rotate-180" : ""
                            }`}
                          />
                        </button>

                        {isSubmenuOpen && (
                          <div className="mt-1 ml-4 pl-2 border-l border-ui-border-soft space-y-1">
                            {item.submenu.map((subItem) => {
                              const isSubActive = activeItem === subItem.href;
                              return (
                                <div
                                  key={subItem.label}
                                  className={subItem.isSeparatorBefore ? "border-t border-ui-border-soft pt-1 mt-1" : ""}
                                >
                                  {subItem.disabled ? (
                                    <span
                                      title="Em breve"
                                      className="flex items-center px-3 py-2 rounded-lg text-xs text-content-muted opacity-50 cursor-not-allowed"
                                    >
                                      <subItem.icon size={16} className="mr-2.5" />
                                      {subItem.label}
                                      <span className="ml-auto text-[9px] font-semibold uppercase tracking-wide">Em breve</span>
                                    </span>
                                  ) : (
                                    <Link
                                      href={subItem.href}
                                      onClick={() => handleItemClick(subItem.href)}
                                      className={`flex items-center px-3 py-2 rounded-lg text-xs font-medium transition-colors ${
                                        isSubActive
                                          ? "bg-brand/10 text-brand font-semibold border border-brand/20"
                                          : "text-content-secondary hover:bg-surface-subtle hover:text-content"
                                      }`}
                                    >
                                      <subItem.icon size={16} className="mr-2.5 text-brand" />
                                      {subItem.label}
                                    </Link>
                                  )}
                                </div>
                              );
                            })}
                          </div>
                        )}
                      </>
                    ) : (
                      <Link
                        href={item.href}
                        onClick={() => handleItemClick(item.href)}
                        className={`flex items-center w-full px-3 py-2.5 rounded-xl text-sm font-medium transition-all duration-200 ${
                          isActive
                            ? "bg-brand/10 text-brand font-semibold border border-brand/20"
                            : "text-content-secondary hover:bg-surface-subtle hover:text-content"
                        }`}
                      >
                        <item.icon size={18} className="min-w-[20px] text-content-muted" />
                        <span className="ml-3">{item.label}</span>
                      </Link>
                    )}
                  </li>
                );
              })}
            </ul>
          </nav>
        </div>

        {/* Rodapé: Dark Mode & Sair */}
        <div className="p-3 border-t border-ui-border-soft flex flex-col gap-2">
          <div className="flex items-center justify-between px-2 py-1.5 rounded-xl bg-surface-subtle/50">
            <div className="flex items-center gap-2 text-xs text-content-secondary">
              {isDark ? <Moon size={16} className="text-brand" /> : <Sun size={16} className="text-brand" />}
              <span>{isDark ? "Modo Escuro" : "Modo Claro"}</span>
            </div>
            <button
              onClick={handleDarkModeToggle}
              className="relative w-10 h-5 rounded-full bg-ui-border-soft transition-all duration-300 hover:opacity-80"
              title="Alternar tema"
            >
              <div
                className={`absolute top-0.5 w-4 h-4 rounded-full bg-surface shadow-xs transition-all duration-300 flex items-center justify-center ${
                  isDark ? "left-5" : "left-0.5"
                }`}
              />
            </button>
          </div>

          <button
            onClick={handleLogout}
            className="flex items-center w-full px-3 py-2 rounded-xl text-xs font-medium text-content-muted hover:text-state-error hover:bg-red-50 dark:hover:bg-red-950/30 transition-colors"
          >
            <LogOut size={16} className="mr-2.5" />
            <span>Sair da conta</span>
          </button>
        </div>

        <style jsx>{`
          .custom-scrollbar {
            scrollbar-width: thin;
            scrollbar-color: var(--color-scrollbar-thumb) var(--color-scrollbar-track);
          }
          .custom-scrollbar::-webkit-scrollbar {
            width: 4px;
          }
          .custom-scrollbar::-webkit-scrollbar-track {
            background: transparent;
          }
          .custom-scrollbar::-webkit-scrollbar-thumb {
            background: var(--color-scrollbar-thumb);
            border-radius: 4px;
          }
        `}</style>
      </aside>
    </>
  );
}