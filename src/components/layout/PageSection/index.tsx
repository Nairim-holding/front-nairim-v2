import type { ReactNode } from "react";
import Link from "next/link";

export interface SectionProps {
  children: ReactNode;
  title: string;
  href?: string;
  hrefText?: string;
  action?: ReactNode;
  /**
   * Quando true, a seção ocupa exatamente a altura da viewport (`h-[100dvh]`) e
   * esconde seu overflow, permitindo que um container interno com `overflow-y-auto`
   * role de forma independente (ex.: grid de Lançamentos com cabeçalho fixo).
   * Default (false) mantém o comportamento `min-h-screen` das demais telas.
   */
  fill?: boolean;
}

export default function Section({ children, title, href, hrefText, action, fill = false }: SectionProps) {
  return (
    <section
      className={`font-poppins bg-page flex flex-col px-3 pt-2 pb-2 sm:px-4 ${
        fill ? 'h-[100dvh] overflow-hidden' : 'min-h-screen'
      }`}
    >
      <div className="flex justify-between items-center mb-2 pl-10 sm:pl-11">
        <h1 className="text-xl sm:text-2xl font-semibold text-content">{title}</h1>
        <div className="flex items-center gap-2">
          {action}
          {href && hrefText && (
            <Link
              href={href}
              className="bg-ui-border px-3 sm:px-5 py-2 sm:py-3 rounded-xl hover:bg-ui-border-muted transition-colors font-medium text-content-secondary text-sm"
            >
              {hrefText}
            </Link>
          )}
        </div>
      </div>
      <div className={`flex flex-col flex-1 ${fill ? 'min-h-0' : ''}`}>
        {children}
      </div>
    </section>
  );
}
