# Popular o banco do Teste 2 na VPS

Script: `scripts/seed-test2.mjs`. Usa o `pg` do container e inclui o `bcryptjs` empacotado no próprio arquivo. Não exige Prisma, bcryptjs instalado, npm install ou Node no host. Funciona no container atual, sem esperar a publicação de uma imagem nova.

## Executar

No terminal da VPS:

```bash
cd /var/www/front-nairim-v2
git pull --ff-only origin main
docker exec -i -w /app front-nairim-app-test node --input-type=module < scripts/seed-test2.mjs
```

O arquivo é lido do checkout da VPS e enviado ao Node dentro de **front-nairim-app-test**, que já possui a conexão do Teste 2. Não use o container principal. O script valida o nome na URL e confirma `current_database() = nairim_test2_db` antes de qualquer escrita. Outros bancos são recusados.

O ano padrão é o atual. Para escolher empresa e ano:

```bash
docker exec -i -w /app \
  -e SEED_COMPANY_SLUG=nairim \
  -e SEED_YEAR=2026 \
  front-nairim-app-test node --input-type=module < scripts/seed-test2.mjs
```

Use o **slug da empresa** que aparece na URL de acesso. Sem `SEED_COMPANY_SLUG`, o script tenta a empresa configurada no app; se não encontrar e houver uma única ativa, usa essa empresa. Com várias empresas e sem correspondência, ele para e lista os slugs disponíveis. Não cria uma empresa paralela em um banco já povoado.

## O que será criado

- 6 imóveis fictícios, 3 proprietários, 5 inquilinos, 1 imobiliária, 3 tipos de imóveis, endereços e valores de aquisição/mercado/aluguel. Há imóveis ocupados, disponível e vendido.
- 5 contratos com exemplos ativos, próximo do vencimento, vencido e cancelado. Não gera cobranças posteriores à data final/cancelamento.
- 2 contas, categorias, subcategorias e centros separados de receita/despesa por imóvel.
- Centenas de lançamentos, distribuídos nos 12 meses: aluguel, comissão, restituições e pagamentos de IPTU/condomínio, manutenção, seguro, ITBI e cartório. Inclui concluídos, pendentes, atrasados e previsões futuras.
- 2 cartões, 24 faturas e 72 compras fictícias; compras e faturas têm status/valores correspondentes.
- 5 linhas de planejamento com valores para os 12 meses.
- 3 investimentos (PGBL, VGBL e CDB), 36 saldos mensais e aportes em março. Nos dois fundos previdenciários, janeiro reproduz os valores-base do documento 51, adaptados ao ano escolhido; o CDB acrescenta seu próprio rendimento ao total da carteira.
- 6 reparos com profissionais e itens de serviço/material.
- Configurações iniciais de ROI, auditoria de IPTU e referência de investimentos, **somente se ainda não existirem**.

Os nomes e descrições usam **[DEMO TESTE2]**. Pessoas, endereços, valores e cadastros são fictícios; o CNPJ da imobiliária é um marcador inválido, não identifica uma empresa real. Não há documentos, fotos, envio de mensagens ou conexões externas. Endereços ficam sem confirmação de localização, portanto não aparecerão como pontos confirmados no mapa.

## Acesso e repetição

Usuários, senhas, configurações e registros já existentes são preservados. Se a empresa estiver sem usuários ativos, cria um administrador **apenas dessa empresa**, `demo-teste2@nairim.test`, com senha aleatória mostrada uma única vez no terminal. Guarde essa senha. Opcionalmente passe `SEED_ADMIN_PASSWORD` ao container (mínimo de 12 caracteres, máximo de 72 bytes); a variável não troca senha de conta existente.

Se o banco estiver completamente sem empresas, cria a empresa de demonstração com slug `nairim`. Em um banco já povoado, exige uma empresa existente/ativa. Depois do seed, entre em `teste.nairim.com.br` com o acesso habitual e selecione a mesma empresa e o ano informado.

Os IDs são determinísticos por empresa, versão e chave do registro. Executar novamente **no mesmo ano e na mesma empresa** não duplica registros nem desfaz edições manuais. Não há DELETE, TRUNCATE, UPDATE, reset ou restauração de banco. Uma falha reverte todos os inserts daquela execução. Configurações de ROI/IPTU existentes não são alteradas: se apontarem a outras categorias, ajuste os filtros/mapeamentos pela interface para incluir os cadastros DEMO.

O JSON final mostra banco, empresa, ano e quantidade de novos registros por tabela. `totalCreated: 0` indica que os dados já estavam presentes.

## Validação

```bash
npm run build:seed-test2 -- --check
npx vitest run src/infra/repositories/seed-test2.integration.test.ts
npx tsc --noEmit
# Após npm run build, conferir o runtime sem bcrypt instalado:
node --test scripts/seed-test2-runtime.test.mjs
```

Testes com PostgreSQL embarcado e schema real: destino proibido, relacionamentos, auditoria, sequência do extrato, repetição, preservação de senha/edições/configurações, empresa isolada e rollback. O seed não é executado pelo deploy e não foi aplicado na VPS por esta tarefa: a execução é o comando manual acima.

O arquivo executável é gerado a partir de `scripts/seed-test2.source.mjs` com `npm run build:seed-test2`. Registre também o arquivo gerado ao alterar a fonte. O CI verifica se ele está atualizado e testa via stdin num ambiente isolado que contém apenas pg e suas dependências, sem bcryptjs. A criação de senha é conferida com bcrypt compatível com o login do sistema. A licença da biblioteca acompanha o arquivo gerado.

O erro `Cannot find package 'bcryptjs' imported from /app/[eval1]` da primeira versão ocorria antes de conectar ao banco. A versão empacotada corrige esse caso; basta atualizar o checkout com git pull e repetir o comando de execução.
