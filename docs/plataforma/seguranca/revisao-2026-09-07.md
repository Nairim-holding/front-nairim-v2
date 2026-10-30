# Revisão de segurança — 7 de setembro de 2026

Revisão do código disponível neste repositório, com correções locais e testes de regressão. Não foi feito deploy, alteração de dados de produção ou varredura de serviços externos. As conclusões não equivalem a certificar ausência de outras vulnerabilidades.

## Falhas corrigidas

1. **Troca de empresa sem autorização (crítica).** `SwitchCompanyUseCase` emitia um JWT para qualquer empresa a pedido de qualquer usuário autenticado. Agora exige SUPER_ADMIN. As operações globais de consulta, alteração e exclusão de empresas também exigem esse papel; o branding da própria empresa continua acessível ao administrador local.
2. **Escalada de privilégios por gestão de usuários (crítica).** Era possível solicitar SUPER_ADMIN na criação de uma conta e alterar credenciais de contas privilegiadas sem proteção equivalente. Escritas de usuários/grupos agora exigem administrador e permissão do recurso; somente SUPER_ADMIN atribui papéis administrativos ou modifica contas SUPER_ADMIN. Grupos atribuídos precisam pertencer à empresa atual. Troca de senha com senha anterior é limitada à própria conta.
3. **Backups expunham e restauravam credenciais e papéis (crítica).** Exportação, download e restauração completos agora exigem SUPER_ADMIN, pois o formato contém hashes de senha e dados de controle de acesso.
4. **Isolamento incompleto no Prisma (alta).** O filtro de empresa podia ser sobrescrito; buscas únicas e operações de alteração/exclusão não recebiam a proteção central. Agora leituras, gravações em lote e upserts são limitados à empresa atual. Criações recebem a empresa do contexto e atualizações não transferem a propriedade do registro. `UserDashboardLayout` entrou na lista protegida. O caminho de atualização do IPTU também exige o imóvel pai correto.
5. **Vínculos entre registros de empresas diferentes (alta).** As ações de escrita cadastrais, financeiras, de imóveis e locações validam os identificadores de proprietários, contas, categorias e outros registros relacionados antes da operação. A autoria de anexos de imóveis vem da sessão, não do formulário.
6. **Permissões verificadas apenas parcialmente no servidor (alta).** As ações e consultas dos módulos revisados agora verificam o recurso e a operação. Usuários comuns sem grupo não recebem acesso irrestrito. Grupos ausentes, excluídos ou de outra empresa negam acesso. Permissões não ficam mais em cache entre requisições, evitando manter autorizações revogadas. As estatísticas de banco não revelam outras empresas a usuários locais.
7. **Sessões confiavam somente nos dados antigos do JWT (alta).** A validação agora exige estrutura de sessão, rejeita tokens de redefinição de senha, restringe o algoritmo a HS256 e consulta o usuário/empresa atuais. Contas desativadas ou excluídas, empresas indisponíveis e mudanças de papel são respeitadas também na renovação. Os horários configurados são aplicados no servidor, no fuso de São Paulo.
8. **Injeção de HTML/CSS pelo branding (alta).** Cores arbitrárias chegavam a uma tag `style` renderizada sem escape. A entrada e a renderização agora aceitam apenas cores hexadecimais, inclusive para dados antigos. O campo de destino do upload de branding também é validado em tempo de execução.
9. **Envio de tokens para destinos indevidos (alta).** A comparação por prefixo de URL foi substituída por comparação de origem e limite de caminho. O helper de requisições também restringe a inclusão automática da credencial. Logs com partes de tokens/cookies foram removidos.
10. **Cache persistente de respostas privadas (alta).** O PWA deixa de armazenar páginas e respostas dinâmicas. Um worker limpa os caches dinâmicos antigos identificados pelo nome. O build usa webpack para executar o plugin PWA e gerar essa atualização. A navegação sem conexão de páginas privadas deixa de estar disponível.
11. **Contorno do bloqueio de login com troca de IP informado (média).** O contador de falhas agora é por conta, independentemente de cabeçalhos de proxy. O cookie recebe `Secure` em produção e o cliente não o regrava removendo essa proteção.

## Compatibilidade e atualização

- Atribuir um grupo com as permissões necessárias às contas DEFAULT antes de atualizar o ambiente em uso. Administradores sem grupo continuam administrando a própria empresa; quando possuem grupo, sua matriz é respeitada.
- Gestão global de empresas e backups completos exigem SUPER_ADMIN. Contas administrativas não podem criar outros administradores sem esse papel.
- Contas com `is_active = false` e restrições de horário passam a ter essas condições efetivamente verificadas.
- Produção deve usar HTTPS devido ao cookie Secure. Reiniciar o processo após publicar, para substituir os singletons de desenvolvimento e carregar a extensão Prisma atualizada.
- Executar `npm run build` ao publicar. O novo service worker precisa ser servido para remover os caches legados; instalações antigas só recebem a correção quando atualizadas.
- Nenhuma migração de banco é necessária para estas correções; a mudança no schema Prisma é de comentários.
- A proteção central do Prisma é aplicada às operações de primeiro nível. SQL bruto e relações aninhadas continuam exigindo revisão explícita; não se deve tratá-la como substituta de restrições no banco.

## Validação

- 625 testes passaram em 54 arquivos. Cobrem chamadas diretas às ações sensíveis, isolamento, referências entre empresas, revogação, finalidade do JWT, horários, branding e limites de destino de credenciais, além da suíte existente.
- Verificação TypeScript completa sem ignorar erros; a opção que ignorava falhas de tipos no build foi desativada.
- A compilação de produção concluiu com código 0. Durante a geração de páginas, a consulta pública ao banco registrou timeout P1008; isso limita a validação funcional com dados reais, embora não tenha impedido o build.
- O núcleo novo de segurança passou no ESLint. O lint amplo ainda encontra problemas anteriores em outros trechos, como uso de `any` em `next.config.ts` e `AuthContext.tsx`; não se declara o lint global limpo.
- O service worker gerado foi inspecionado: não contém estratégias de cache de respostas dinâmicas e importa o worker de limpeza dos caches legados.

## Pendências e limites

- **Dependências:** a execução de `npm audit` foi bloqueada pela revisão automática de aprovação porque envia nomes/versões dos pacotes a `registry.npmjs.org`. Foi solicitada autorização específica. Nenhuma alegação de dependências livres de vulnerabilidades é feita, e nenhuma atualização de pacote foi aplicada sem essa verificação.
- **Integração legada:** `authToken` continua legível por JavaScript porque o frontend ainda envia Bearer à API Express e usa o token para restaurar a sessão. Converter para HttpOnly requer concluir a migração dessas chamadas e da restauração/renovação da sessão. Secure e as correções de XSS não substituem HttpOnly.
- **Revogação por senha/logout:** o JWT continua sem identificador persistido de sessão. Desativação, exclusão e rebaixamento são revalidados, mas logout e troca de senha não invalidam imediatamente uma cópia já obtida de um JWT válido. Uma versão de sessão ou armazenamento de sessões é necessário para revogação completa.
- **Recuperação de senha:** o envio de e-mail não está implementado; a action pública não expõe o token de reset. A integração de envio e a garantia de uso único do token precisam ser concluídas antes de habilitar esse fluxo real.
- **Limitação de login:** o contador permanece em memória de cada processo. Um ambiente com múltiplas instâncias precisa de um armazenamento compartilhado e de limites também no proxy.
- O backend Express separado, políticas do MinIO, TLS/proxy, infraestrutura, histórico de segredos e testes autenticados contra um banco de homologação não foram auditados nesta execução.
