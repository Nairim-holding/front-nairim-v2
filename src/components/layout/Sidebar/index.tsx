"use client";
import { useState, useEffect, useRef, useMemo } from "react";
import Link from "next/link";
import {
  Menu,
  X,
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
  SearchCheck
} from "lucide-react";
import Logo from "../Logo";
import CompanySwitcher from "../CompanySwitcher";
import { useAuth } from "@/contexts/AuthContext";
import { usePermissions } from "@/contexts/PermissionsContext";
import { resourceForHref } from "@/utils/permissionResource";
import { useTheme } from "@/contexts/ThemeContext";

export default function Aside() {
  const [openAside, setOpenAside] = useState(false);
  // Mudamos de booleano para string, para saber QUAL menu está aberto
  const [openSubmenu, setOpenSubmenu] = useState<string | null>(null);
  const [isDarkModeAnimating, setIsDarkModeAnimating] = useState(false);
  const [activeItem, setActiveItem] = useState("/dashboard");
  const submenuRef = useRef<HTMLDivElement>(null);
  const menuItemsRef = useRef<HTMLUListElement>(null);

  const { logout, user } = useAuth();
  const { can } = usePermissions();
  const { isDark, toggleTheme } = useTheme();
  const isSuperAdmin = user?.role === 'SUPER_ADMIN';

  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (submenuRef.current && !submenuRef.current.contains(event.target as Node)) {
        setOpenSubmenu(null); // Fecha todos ao clicar fora
      }
    }

    if (openSubmenu) {
      document.addEventListener("mousedown", handleClickOutside);
    }

    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
    };
  }, [openSubmenu]);

  useEffect(() => {
    const currentPath = window.location.pathname;
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setActiveItem(currentPath);
  }, []);

  const handleItemClick = (href: string) => {
    setActiveItem(href);
    if (href !== "#") {
      setOpenAside(false);
      setOpenSubmenu(null);
    }
  };

  // Nova função de clique que recebe o nome do menu
  const handleSubmenuClick = (e: React.MouseEvent, label: string) => {
    e.stopPropagation();
    // Se clicar no menu que já está aberto, ele fecha. Se clicar em outro, ele abre e fecha o anterior.
    setOpenSubmenu(openSubmenu === label ? null : label);
  };

  const handleDarkModeToggle = () => {
    setIsDarkModeAnimating(true);
    toggleTheme();
    
    setTimeout(() => {
      setIsDarkModeAnimating(false);
    }, 300);
  };

  // `resource` vem de RESOURCE_ROUTES (utils/permissionResource.ts) — mesma
  // tabela usada pelo PermissionGate para bloquear acesso direto por URL, para
  // as duas features nunca divergirem sobre "que rota cobre que recurso".
  // Item sem `resource` (os "guarda-chuva" Cadastrar/Financeiro) não é
  // filtrado direto: fica visível se sobrar ao menos 1 item no submenu.
  const menuItems = useMemo(() => {
    const raw = [
      { href: "/dashboard", icon: Home, label: "Resumo", resource: resourceForHref("/dashboard") },
      {
        href: "#",
        icon: PlusCircle,
        label: "Cadastrar",
        submenu: [
          { href: "/dashboard/administradores", icon: UserPlus, label: "Administrador", resource: resourceForHref("/dashboard/administradores") },
          { href: "/dashboard/grupos-usuario", icon: Users, label: "Grupo de Usuário", resource: resourceForHref("/dashboard/grupos-usuario") },
          ...(isSuperAdmin ? [{ href: "/dashboard/empresas", icon: Briefcase, label: "Empresa", resource: resourceForHref("/dashboard/empresas") }] : []),
          { href: "/dashboard/imoveis", icon: House, label: "Imóvel", resource: resourceForHref("/dashboard/imoveis") },
          { href: "/dashboard/imobiliarias", icon: Building2, label: "Imobiliária", resource: resourceForHref("/dashboard/imobiliarias") },
          { href: "/dashboard/inquilinos", icon: UserCheck, label: "Inquilinos", resource: resourceForHref("/dashboard/inquilinos") },
          { href: "/dashboard/proprietarios", icon: UserCircle, label: "Proprietários", resource: resourceForHref("/dashboard/proprietarios") },
          { href: "/dashboard/tipo-imovel", icon: Tag, label: "Tipo Imóvel", resource: resourceForHref("/dashboard/tipo-imovel") },
        ].filter((sub) => can(sub.resource, 'view')),
      },
      { href: "/dashboard/locacoes", icon: Key, label: "Locações", resource: resourceForHref("/dashboard/locacoes") },
      {
        href: "#",
        icon: PiggyBank,
        label: "Financeiro",
        submenu: [
          { href: "/dashboard/instituicoes-financeiras", icon: Landmark, label: "Instituições Financeiras", resource: resourceForHref("/dashboard/instituicoes-financeiras") },
          { href: "/dashboard/categorias", icon: ChartColumnStacked, label: "Categorias/Subcategorias", resource: resourceForHref("/dashboard/categorias") },
          { href: "/dashboard/cartoes", icon: CreditCard, label: "Cartões de Crédito", resource: resourceForHref("/dashboard/cartoes") },
          { href: "/dashboard/centros", icon: HandCoins, label: "Centros", resource: resourceForHref("/dashboard/centros") },
          { href: "/dashboard/fornecedores", icon: Users, label: "Contatos", resource: resourceForHref("/dashboard/fornecedores") },
          { href: "/dashboard/lancamentos", icon: FolderInput, label: "Lançamentos", resource: resourceForHref("/dashboard/lancamentos") },
          { href: "/dashboard/planejamento", icon: BarChart2, label: "Planejamento e Controle", resource: resourceForHref("/dashboard/planejamento") },
          { href: "/dashboard/relatorios", icon: FileBarChart2, label: "Relatórios", resource: resourceForHref("/dashboard/relatorios") },
          { href: "/dashboard/financeiro-auditoria", icon: SearchCheck, label: "Auditoria", resource: resourceForHref("/dashboard/financeiro-auditoria") },
        ].filter((sub) => can(sub.resource, 'view')),
      },
      { href: "/dashboard/configuracoes", icon: Settings, label: "Configurações", resource: resourceForHref("/dashboard/configuracoes") },
      { href: "/dashboard/auditoria", icon: FileClock, label: "Auditoria", resource: resourceForHref("/dashboard/auditoria") },
    ];

    return raw.filter((item) => (item.submenu ? item.submenu.length > 0 : can(item.resource, 'view')));
  }, [isSuperAdmin, can]);

  const handleLogout = async () => {
    logout();
    setOpenAside(false);
  };

  return (
    <>
      <button
        className={`fixed top-[8px] left-[10px] z-[1100] bg-page p-2 rounded-md shadow-md transition-all duration-300 hover:opacity-100 text-content ${openAside ? "left-[14.25rem]" : "left-[10px]"}`}
        onClick={() => setOpenAside(!openAside)}
      >
        {openAside ? (
          <X size={25} />
        ) : (
          <Menu size={25} />
        )}
      </button>

      {/* Overlay */}
      {openAside && (
        <div
          className="fixed inset-0 bg-layer-overlay z-[999] transition-opacity duration-300"
          onClick={() => {
            setOpenAside(false);
            setOpenSubmenu(null);
          }}
        />
      )}

      {/* Aside */}
      <aside
        className={`fixed top-0 left-0 h-full w-[300px] z-[1000] shadow-lg transform transition-transform duration-300 ease-in-out bg-page ${openAside ? "translate-x-0" : "-translate-x-full"}`}
      >
        <div className="flex flex-col h-full pt-5 px-5 pb-3 items-start">
          <div className="mb-4">
            <Link href="/dashboard">
              <Logo className="text-brand-logo" variant="sidebar" />
            </Link>
          </div>

          {isSuperAdmin && <CompanySwitcher isOpen={openAside} onNavigate={() => setOpenAside(false)} />}

          <div className="flex-1 w-full overflow-hidden">
            <nav className="h-full" ref={submenuRef}>
              <ul 
                ref={menuItemsRef}
                className="space-y-2 h-full overflow-y-auto pr-2 custom-scrollbar"
                style={{ maxHeight: "calc(100vh - 200px)" }}
              >
                {menuItems.map((item) => {
                  const isOpen = openSubmenu === item.label;

                  return (
                    <li key={item.label} className="relative">
                      {item.submenu ? (
                        <>
                          <button
                            onClick={(e) => handleSubmenuClick(e, item.label)}
                            className={`flex items-center w-full p-3 rounded-lg transition-all duration-200 ${
                              isOpen
                                ? "bg-gradient-to-r from-brand to-brand-hover text-content-inverse"
                                : "text-content-muted hover:bg-gradient-to-r hover:from-brand hover:to-brand-hover hover:text-content-inverse"
                            }`}
                          >
                            <item.icon size={22} className="min-w-[25px]" />
                            {openAside && (
                              <>
                                <span className="ml-3 flex-1 text-left">{item.label}</span>
                                <ChevronDown 
                                  size={16} 
                                  className={`transition-transform duration-200 ${isOpen ? "rotate-180" : ""}`}
                                />
                              </>
                            )}
                          </button>

                          {isOpen && openAside && (
                            <div className="mt-1 bg-surface-muted rounded-lg shadow-lg overflow-hidden">
                              <ul className="space-y-1">
                                {item.submenu.map((subItem) => (
                                  <li key={subItem.label}>
                                    <Link
                                      href={subItem.href}
                                      onClick={() => {
                                        setActiveItem(subItem.href);
                                        setOpenAside(false);
                                        setOpenSubmenu(null);
                                      }}
                                      className={`flex items-center p-3 rounded text-sm transition-colors ${
                                        activeItem === subItem.href
                                          ? "bg-surface-subtle text-content"
                                          : "text-content-secondary hover:bg-surface-subtle hover:text-content"
                                      }`}
                                    >
                                      <subItem.icon size={18} className="mr-3" />
                                      {subItem.label}
                                    </Link>
                                  </li>
                                ))}
                              </ul>
                            </div>
                          )}
                        </>
                      ) : (
                        <Link
                          href={item.href}
                          onClick={() => handleItemClick(item.href)}
                          className={`flex items-center w-full p-3 rounded-lg transition-all duration-200 ${
                            activeItem === item.href
                              ? "bg-gradient-to-r from-brand to-brand-hover text-content-inverse"
                              : "text-content-muted hover:bg-gradient-to-r hover:from-brand hover:to-brand-hover hover:text-content-inverse"
                          }`}
                        >
                          <item.icon size={22} className="min-w-[25px]" />
                          {openAside && <span className="ml-3">{item.label}</span>}
                        </Link>
                      )}
                    </li>
                  );
                })}

                {/* Logout */}
                <li>
                  <button
                    onClick={handleLogout}
                    className="flex items-center w-full p-3 rounded-lg transition-all duration-200 text-content-muted hover:bg-gradient-to-r hover:from-brand hover:to-brand-hover hover:text-content-inverse"
                  >
                    <LogOut size={22} className="min-w-[25px]" />
                    {openAside && <span className="ml-3">Sair</span>}
                  </button>
                </li>
              </ul>
            </nav>
          </div>

          {/* Dark Mode Toggle - Fixo na parte inferior */}
          <div className="w-full pt-4 border-t border-ui-border-soft mt-4">
            <div className="flex items-center justify-between">
              {openAside && (
                <>
                  <div className="flex items-center gap-3">
                    {isDark ? (
                      <Moon size={20} className="text-content-inverse" />
                    ) : (
                      <Sun size={20} className="text-content-secondary" />
                    )}
                    <span className="text-content-secondary">
                      {isDark ? "Dark Mode" : "Light Mode"}
                    </span>
                  </div>
                  <button
                    onClick={handleDarkModeToggle}
                    className="relative w-12 h-6 rounded-full bg-surface-strong transition-all duration-300 hover:opacity-80"
                  >
                    <div
                      className={`absolute top-1 w-4 h-4 rounded-full bg-surface transition-all duration-300 flex items-center justify-center ${
                        isDark ? "left-7" : "left-1"
                      } ${
                        isDarkModeAnimating ? "scale-110" : "scale-100"
                      }`}
                    >
                      {isDark ? (
                        <Moon size={10} className="text-content transition-all duration-300" />
                      ) : (
                        <Sun size={10} className="text-yellow-500 transition-all duration-300" />
                      )}
                    </div>
                  </button>
                </>
              )}
            </div>
          </div>
        </div>

        {/* Estilos para o scrollbar */}
        <style jsx>{`
          .custom-scrollbar {
            scrollbar-width: thin;
            scrollbar-color: var(--color-scrollbar-thumb) var(--color-scrollbar-track);
          }
          
          .custom-scrollbar::-webkit-scrollbar {
            width: 6px;
          }
          
          .custom-scrollbar::-webkit-scrollbar-track {
            background: var(--color-scrollbar-track);
            border-radius: 3px;
          }
          
          .custom-scrollbar::-webkit-scrollbar-thumb {
            background: var(--color-scrollbar-thumb);
            border-radius: 3px;
          }
          
          .custom-scrollbar::-webkit-scrollbar-thumb:hover {
            background: var(--color-scrollbar-thumb-hover);
          }
        `}</style>
      </aside>
    </>
  );
}