import { ReactNode } from "react";
import Link from "next/link";

export interface SectionProps {
  children: ReactNode;
  title: string;
  href?: string;
  hrefText?: string;
}

export default function Section({ children, title, href, hrefText }: SectionProps) {
  return (
    <section className="font-poppins bg-page flex flex-col p-2">
      <div className="flex justify-between items-center mb-2">
        <h1 className="text-2xl font-semibold text-content ml-12">{title}</h1>
        {href && hrefText && (
          <Link 
            href={href} 
            className="bg-ui-border px-5 py-3 rounded-xl hover:bg-ui-border-muted transition-colors font-medium text-content-secondary"
          >
            {hrefText}
          </Link>
        )}
      </div>
      {children}
    </section>
  );
}
