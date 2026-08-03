import { ShieldOff } from "lucide-react";

/**
 * Conteúdo da mensagem de "sem permissão" — extraído para ser reaproveitado
 * tanto pelo PermissionGate (bloqueio de página inteira, por rota) quanto por
 * widgets que fazem fetch próprio e podem levar um 403 independente da rota
 * (ex.: as abas do Dashboard, que buscam cada uma seu próprio recurso).
 */
export default function ForbiddenNotice() {
  return (
    <div className="flex flex-col items-center justify-center gap-3 text-center py-16">
      <ShieldOff size={48} className="text-content-muted" />
      <p className="text-lg font-medium text-content">
        Você não tem permissão para visualizar este conteúdo.
      </p>
      <p className="text-sm text-content-secondary max-w-md">
        Seu grupo de usuário não tem acesso a este recurso. Se acha que isso é um engano,
        fale com um administrador para revisar as diretivas de acesso do seu grupo.
      </p>
    </div>
  );
}
