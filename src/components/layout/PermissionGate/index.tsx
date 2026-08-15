"use client";

import type { ReactNode } from "react";
import { usePathname } from "next/navigation";
import { usePermissions } from "@/contexts/PermissionsContext";
import { useAuth } from "@/contexts";
import { resourceForPathname } from "@/utils/permissionResource";
import Section from "../PageSection";
import ForbiddenNotice from "./ForbiddenNotice";

/**
 * Bloqueia o CONTEÚDO da página quando o grupo do usuário não tem `view` no
 * recurso da rota atual — cobre quem navega direto pela URL (ou tem a página
 * em favoritos) e não passou pelo Sidebar, que já esconde o item do menu.
 * Não afeta o Sidebar em si: ele é renderizado como irmão, fora deste gate,
 * então o usuário sempre consegue abri-lo e navegar para outra seção.
 */
export default function PermissionGate({ children }: { children: ReactNode }) {
  const pathname = usePathname();
  const { can } = usePermissions();
  const { user } = useAuth();
  const resource = resourceForPathname(pathname);

  if (resource && !can(resource, 'view')) {
    return (
      <Section title="Acesso restrito" href="/dashboard" hrefText="Voltar ao início">
        <ForbiddenNotice />
      </Section>
    );
  }

  // `key` no company_id força o React a desmontar/remontar toda a árvore de
  // páginas ao trocar de empresa (CompanySwitcher muda o token sem navegar
  // para uma rota diferente) — sem isso, hooks com estado client-side
  // (useOptimizedTableData, caches locais, etc.) continuavam com os dados da
  // empresa anterior até alguma interação forçar um novo fetch.
  return <div key={user?.company_id ?? 'anon'}>{children}</div>;
}
