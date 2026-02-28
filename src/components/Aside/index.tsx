"use client";
import { useState, useEffect, useRef } from "react";
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
  Tag
} from "lucide-react";
import Logo from "../Logo";
import { useAuth } from "@/contexts/AuthContext";
import { useTheme } from "@/contexts/ThemeContext";

export default function Aside() {
  const [openAside, setOpenAside] = useState(false);
  const [openSubmenu, setOpenSubmenu] = useState(false);
  const [isDarkModeAnimating, setIsDarkModeAnimating] = useState(false);
  const [activeItem, setActiveItem] = useState("/dashboard");
  const submenuRef = useRef<HTMLDivElement>(null);
  const menuItemsRef = useRef<HTMLUListElement>(null);

  const { logout } = useAuth();
  const { isDark, toggleTheme } = useTheme();

  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (submenuRef.current && !submenuRef.current.contains(event.target as Node)) {
        setOpenSubmenu(false);
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
      setOpenSubmenu(false);
    }
  };

  const handleCadastroClick = (e: React.MouseEvent) => {
    e.stopPropagation(); // Impede que o clique se propague
    setOpenSubmenu(!openSubmenu);
  };

  const handleDarkModeToggle = () => {
    setIsDarkModeAnimating(true);
    toggleTheme();
    
    setTimeout(() => {
      setIsDarkModeAnimating(false);
    }, 300);
  };

  const menuItems = [
    { href: "/dashboard", icon: Home, label: "Resumo" },
    { 
      href: "#",
      icon: PlusCircle, 
      label: "Cadastrar",
      submenu: [
        { href: "/dashboard/administradores", icon: UserPlus, label: "Administrador" },
        { href: "/dashboard/imoveis", icon: House, label: "Imóvel" },
        { href: "/dashboard/imobiliarias", icon: Building2, label: "Imobiliária" },
        { href: "/dashboard/inquilinos", icon: UserCheck, label: "Inquilinos" },
        { href: "/dashboard/proprietarios", icon: UserCircle, label: "Proprietários" },
        { href: "/dashboard/tipo-imovel", icon: Tag, label: "Tipo Imóvel" },
      ]
    },
    { href: "/dashboard/locacoes", icon: Key, label: "Locações" },
    { href: "/dashboard/configuracoes", icon: Settings, label: "Configurações" },
  ];

  const handleLogout = async () => {
    logout();

    setOpenAside(false);
  };

  return (
    <>
      <button
        className={`fixed top-[8px] left-[10px] z-[1100] bg-page p-2 rounded-md shadow-md transition-all duration-300 hover:opacity-100 ${
          isDark ? "bg-surface text-content-inverse" : "text-content"
        } ${openAside ? "left-[14.25rem]" : "left-[10px]"}`}
        onClick={() => setOpenAside(!openAside)}
      >
        {openAside ? (
          <X size={25} className={isDark ? "text-content-inverse" : ""} />
        ) : (
          <Menu size={25} className={isDark ? "text-content-inverse" : ""} />
        )}
      </button>

      {/* Overlay */}
      {openAside && (
        <div
          className="fixed inset-0 bg-layer-overlay z-[999] transition-opacity duration-300"
          onClick={() => {
            setOpenAside(false);
            setOpenSubmenu(false);
          }}
        />
      )}

      {/* Aside */}
      <aside
        className={`fixed top-0 left-0 h-full w-[300px] z-[1000] shadow-lg transform transition-transform duration-300 ease-in-out ${
          isDark ? "bg-surface" : "bg-page"
        } ${openAside ? "translate-x-0" : "-translate-x-full"}`}
      >
        <div className="flex flex-col h-full pt-5 px-5 pb-3 items-start">
          <div className="mb-4">
            <Link href="/dashboard">
              <Logo className={isDark ? "text-content-inverse" : "text-brand-logo"} />
            </Link>
          </div>

          <div className="flex-1 w-full overflow-hidden">
            <nav className="h-full" ref={submenuRef}>
              <ul 
                ref={menuItemsRef}
                className="space-y-2 h-full overflow-y-auto pr-2 custom-scrollbar"
                style={{ maxHeight: "calc(100vh - 200px)" }}
              >
                {menuItems.map((item) => (
                  <li key={item.label} className="relative">
                    {item.submenu ? (
                      <>
                        <button
                          onClick={handleCadastroClick}
                          className={`flex items-center w-full p-3 rounded-lg transition-all duration-200 ${
                            openSubmenu
                              ? isDark 
                                ? "bg-brand text-content-inverse" 
                                : "bg-gradient-to-r from-brand to-brand-hover text-content-inverse"
                              : isDark
                              ? "text-content-muted hover:bg-surface-strong hover:text-content-inverse"
                              : "text-content-muted hover:bg-gradient-to-r hover:from-brand hover:to-brand-hover hover:text-content-inverse"
                          }`}
                        >
                          <item.icon size={22} className="min-w-[25px]" />
                          {openAside && (
                            <>
                              <span className="ml-3 flex-1 text-left">{item.label}</span>
                              <ChevronDown 
                                size={16} 
                                className={`transition-transform duration-200 ${openSubmenu ? "rotate-180" : ""}`}
                              />
                            </>
                          )}
                        </button>

                        {openSubmenu && openAside && (
                          <div className={`mt-1 ${
                            isDark ? "bg-surface-strong" : "bg-surface-muted"
                          } rounded-lg shadow-lg overflow-hidden`}>
                            <ul className="space-y-1">
                              {item.submenu.map((subItem) => (
                                <li key={subItem.label}>
                                  <Link
                                    href={subItem.href}
                                    onClick={() => {
                                      setActiveItem(subItem.href);
                                      setOpenAside(false);
                                      setOpenSubmenu(false);
                                    }}
                                    className={`flex items-center p-3 rounded text-sm transition-colors ${
                                      activeItem === subItem.href
                                        ? isDark
                                          ? "bg-surface-muted text-content-inverse"
                                          : "bg-surface-subtle text-content"
                                        : isDark
                                        ? "text-content-muted hover:bg-surface-muted hover:text-content-inverse"
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
                            ? isDark 
                              ? "bg-brand text-content-inverse" 
                              : "bg-gradient-to-r from-brand to-brand-hover text-content-inverse"
                            : isDark
                            ? "text-content-muted hover:bg-surface-strong hover:text-content-inverse"
                            : "text-content-muted hover:bg-gradient-to-r hover:from-brand hover:to-brand-hover hover:text-content-inverse"
                        }`}
                      >
                        <item.icon size={22} className="min-w-[25px]" />
                        {openAside && <span className="ml-3">{item.label}</span>}
                      </Link>
                    )}
                  </li>
                ))}

                {/* Logout */}
                <li>
                  <button
                    onClick={handleLogout}
                    className={`flex items-center w-full p-3 rounded-lg transition-all duration-200 ${
                      isDark
                        ? "text-content-muted hover:bg-surface-strong hover:text-content-inverse"
                        : "text-content-muted hover:bg-gradient-to-r hover:from-brand hover:to-brand-hover hover:text-content-inverse"
                    }`}
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
                    <span className={isDark ? "text-content-inverse" : "text-content-secondary"}>
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
