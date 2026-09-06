# Confirmação da localização dos imóveis

A consulta de CEP preenche somente o endereço. Separadamente, após 1,2 segundo sem mudanças no endereço completo, o editor consulta a Geoapify e pré-posiciona um pin sugerido. O mapa continua usando Leaflet e a camada OpenStreetMap já existente.

Configure `GEOAPIFY_API_KEY` somente no servidor e reinicie a aplicação. A chave gratuita pode ser criada em https://myprojects.geoapify.com/; não use prefixo NEXT_PUBLIC. Sem chave, a interface informa que a busca não está configurada e mantém a marcação manual. O plano gratuito possui limites de utilização; acompanhe o consumo no provedor. A atribuição Geoapify aparece no editor.

Sugestões não equivalem a confirmação. Resultados de rua ou bairro são identificados como aproximados; centros de cidade, resultados de outra cidade/estado e números divergentes são descartados. O usuário pode ajustar o ponto a qualquer momento. Ajustes manuais, remoção e confirmação cancelam a busca pendente. Respostas antigas não substituem a escolha do usuário. Nova busca automática ocorre quando o endereço muda. O endpoint exige sessão e empresa; consultas idênticas têm cache em memória por empresa, limitado a 250 entradas por processo durante 24 horas.

Na etapa Endereço do cadastro, o usuário posiciona o pin por clique/arraste ou informa latitude e longitude. O botão de confirmação associa o ponto ao endereço atual. É necessário salvar o cadastro. É possível salvar um imóvel pendente, mas ele não aparece como pin na dashboard.

A dashboard lista os imóveis pendentes com links para revisão. Os pontos antigos permanecem disponíveis no editor como referência; não são considerados corretos automaticamente. A confirmação atesta a revisão pelo usuário, não uma certificação de precisão pelo fornecedor.

## Publicação

1. Aplicar a migração `20260906000000_property_location_confirmation` com o processo de migração do ambiente, antes de iniciar a versão nova da aplicação.
2. Gerar o cliente Prisma e publicar a aplicação.
3. Revisar os imóveis na aba de mapas. A migração deixa todos os endereços antigos sem confirmação e preserva as coordenadas existentes.

A migração adiciona apenas uma coluna anulável em Address. Não corrige coordenadas em massa nem importa o backup de produção. Nenhuma migração foi executada em produção durante a implementação.

## Regras de persistência

`location_confirmation` registra uma identidade normalizada do endereço e das coordenadas. Não é um token de autenticação. O servidor compara seu conteúdo com os dados recebidos; só aceita nova confirmação com `location_update: true`, usado pelo editor de localização. Alterações automáticas sem esse indicador preservam um ponto confirmado quando o endereço permanece igual.

Mudanças na rua, número, bairro, cidade, estado, país, CEP, quadra, lote ou complemento exigem nova confirmação. Uma mudança de endereço sem confirmação válida limpa o ponto na persistência. Alterações no pin exigem confirmação novamente. Coordenadas incompletas, não numéricas ou fora dos limites geográficos são rejeitadas.

Backups novos incluem a confirmação. Ao restaurar backups antigos, a ausência desse campo deixa os endereços pendentes, inclusive quando o endereço já existe no banco.
