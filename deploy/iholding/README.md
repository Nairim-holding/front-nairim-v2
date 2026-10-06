# iholding.com.br — ambiente independente na mesma VPS

Esta configuracao instala o sistema com bancos e arquivos vazios. Cria apenas
a empresa inicial e um super administrador; nao importa dados da Nairim.
O nome de exibicao inicial e `I Holding`, editavel no arquivo de configuracao.

## Componentes confirmados no repositorio

| Componente | Servico / armazenamento | Endereco |
| --- | --- | --- |
| Next.js: front, Server Actions e logica principal | `iholding-front` | `https://iholding.com.br` |
| Banco principal PostgreSQL 16 | `iholding-postgres`, volume `iholding_postgres_data` | Rede interna, database `iholding_db` |
| Auditoria MongoDB 8 | `iholding-mongodb`, volume `iholding_mongodb_data` | Rede interna, database `iholding_logs` |
| Transferencia da fila de auditoria | `iholding-logs-worker` | PostgreSQL → MongoDB da iholding |
| Arquivos S3 e origem da CDN | `iholding-minio`, volume `iholding_minio_data` | `https://cdn.iholding.com.br` |
| Backups JSON produzidos pela interface | Volume `iholding_app_backups` | `/app/backup` no front |
| Agendador de indices de reajuste | `iholding-scheduler`, volume `iholding_scheduler_state` | Dia 5 a partir das 09h, America/Sao_Paulo |
| Dominio, HTTPS e redirecionamento HTTP | Traefik ja existente | Rede `traefik-public`, resolver `myresolver` |

O MinIO e a origem dos arquivos; distribuicao por pontos de presenca/cache de
CDN externa depende de um provedor, caso seja usado em producao. Bancos nao
publicam portas. O console MinIO nao tem rota publica nesta configuracao.
Os volumes sao novos, gerenciados pelo projeto Compose `iholding`.

Antes de publicar, conferir na VPS: capacidade livre de RAM/disco/CPU, versoes
reais das imagens, configuracao do Traefik, provedor DNS/CDN, rotinas de backup,
monitoramento, tarefas externas e integracoes que nao estejam no repositorio.
Este inventario identifica o codigo local; nao comprova todos os servicos
externos instalados na VPS. Nao ha Redis nem servidor de e-mail referenciado
pela configuracao de runtime atual.

## 1. Preparar um diretorio proprio

Use um checkout deste codigo em `/var/www/iholding`, separado do checkout da
Nairim em `/var/www/front-nairim-v2`. Assim o deploy automatico da Nairim nao
reescreve os arquivos desta instalacao. As instrucoes abaixo sao para Linux.
Copie/publice estas alteracoes no checkout novo antes de executar.

```bash
cd /var/www/iholding
bash deploy/iholding/create-env.sh
nano .env.iholding
```

O script cria `.env.iholding` com permissao privada e senhas distintas para
PostgreSQL, MongoDB, JWT, cron, MinIO root, MinIO app e administrador inicial.
Nao imprime os segredos e nao altera um arquivo ja existente. Use as
credenciais novas, nunca o `.env` da Nairim. Preencha nome, e-mail, data de
nascimento (`AAAA-MM-DD`) e genero do administrador; esses campos sao exigidos
pelo modelo atual de usuario. A senha inicial exige 16 caracteres e ate 72 bytes.
Nao registre o arquivo de segredos no Git.

### Qual usuario deve executar

Execute com o usuario Linux do checkout que tenha acesso ao Docker e permissao
de escrita em `/var/www/iholding`. O ideal e o usuario de deploy ja utilizado
na VPS e autorizado a operar Docker. Confira com `whoami` e `docker info`.
Se apenas root puder operar Docker, execute com root e mantenha o arquivo de
segredos pertencente a root; nao e necessario alterar os grupos dos usuarios
para este procedimento. Acesso ao Docker da controle administrativo da VPS.

O usuario de login **do sistema** e outro: o e-mail preenchido em
`BOOTSTRAP_ADMIN_EMAIL` e a senha gerada em `BOOTSTRAP_ADMIN_PASSWORD`.
Esse cadastro recebe `SUPER_ADMIN` somente no ambiente da iholding.

### O que preencher no arquivo

| Campos | Como configurar |
| --- | --- |
| `MINIO_IMAGE` | Padrao `iholding-minio:2025-10-15`, construido pelo up.sh |
| `MINIO_MC_IMAGE` | Padrao `iholding-mc:2025-08-13`, construido pelo up.sh |
| `BOOTSTRAP_ADMIN_NAME`, `BOOTSTRAP_ADMIN_EMAIL` | Nome e e-mail do responsavel pelo primeiro acesso |
| `BOOTSTRAP_ADMIN_BIRTH_DATE`, `BOOTSTRAP_ADMIN_GENDER` | Data `AAAA-MM-DD`; genero `MALE`, `FEMALE` ou `OTHER` |
| Sete senhas/segredos | Gerados automaticamente; mantenha-os diferentes dos da Nairim |
| `APP_DOMAIN`, `CDN_DOMAIN` | Ja definidos como `iholding.com.br` e `cdn.iholding.com.br` |
| `NEXT_PUBLIC_COMPANY_SLUG`, `NEXT_PUBLIC_COMPANY_NAME` | Padroes `iholding` e `I Holding`; personalize o nome se necessario |
| `TRAEFIK_NETWORK`, `TRAEFIK_CERTRESOLVER` | Confirme os padroes `traefik-public` e `myresolver` na VPS |
| `NEXT_PUBLIC_CARTO_API_KEY`, `GEOAPIFY_API_KEY` | Opcionais; necessarios para as integracoes correspondentes |

Nao e preciso preencher `DATABASE_URL`, `MONGODB_LOGS_URI`, `BASE_URL` ou
`MINIO_ENDPOINT`: o Compose monta os enderecos corretos dos servicos internos.
Guarde uma copia protegida do arquivo de configuracao para recuperacao futura.

### Imagens MinIO

O padrao `MINIO_IMAGE=iholding-minio:2025-10-15` e construido automaticamente
pelo `up.sh` a partir da release oficial `RELEASE.2025-10-15T17-29-55Z`.
Essa release corrige CVE-2025-62506, que nao esta corrigida na imagem
`RELEASE.2025-09-07T16-13-09Z` identificada na VPS. O container novo roda com
UID 1001. A compilacao usa ate dois processos Go e pode levar varios minutos.
Esse build precisa de internet para baixar Go e as dependencias do MinIO.
Ver [aviso oficial de seguranca](https://github.com/minio/minio/security/advisories/GHSA-jjjj-jwhf-8rgr).

O padrao `MINIO_MC_IMAGE=iholding-mc:2025-08-13` tambem e construido pelo
`up.sh`, usando o codigo oficial `github.com/minio/mc` na release
`RELEASE.2025-08-13T08-35-41Z`. Nao e necessario baixar imagens `minio/mc`
do Docker Hub ou Quay, nem autenticar nesses repositorios. O cliente inclui
shell e certificados para inicializacao e backups. Os builds usam contexto
vazio, sem enviar o `.env.iholding` ao Docker.
Ver [release oficial do cliente](https://github.com/minio/mc/releases/tag/RELEASE.2025-08-13T08-35-41Z).

Se o arquivo `.env.iholding` foi criado antes desta alteracao, ajuste apenas:

```dotenv
MINIO_IMAGE=iholding-minio:2025-10-15
MINIO_MC_IMAGE=iholding-mc:2025-08-13
```

Se optar por outras imagens homologadas, configure `MINIO_IMAGE` e/ou
`MINIO_MC_IMAGE` com tag fixa ou digest; o up.sh so compila os padroes acima.
Confira a versao/digest da instancia atual da VPS para avaliar compatibilidade,
sem reutilizar seu volume:

```bash
docker inspect --format '{{.Config.Image}} / {{.Image}}' nairim-minio
docker image inspect --format '{{json .RepoDigests}}' IMAGEM_IDENTIFICADA
```

Nao assumir que `minio/minio:latest` atende uma instalacao nova: a ultima
release de seguranca publicada no projeto comunitario orienta construir a
imagem a partir do codigo, e o repositorio esta arquivado. A escolha de imagem
mantida/homologada precisa ser resolvida antes da subida. Ver
[releases oficiais do MinIO](https://github.com/minio/minio/releases).
O cliente `mc` precisa oferecer `admin user add`, `admin policy create/attach`
e `anonymous set-json`. Validar os comandos com a versao escolhida.

## 2. Conferir Traefik e DNS

Este Compose usa o proxy ja existente na mesma VPS; nao inicia outro Traefik.
Confirme que `TRAEFIK_NETWORK`, `TRAEFIK_CERTRESOLVER` e os entrypoints `web`
e `websecure` correspondem a configuracao real. A rede deve estar anexada ao
Traefik e as portas 80/443 devem estar acessiveis conforme seu desafio ACME.

```bash
docker network inspect traefik-public
docker compose version
```

Configure no provedor DNS:

| Registro | Tipo | Destino |
| --- | --- | --- |
| `iholding.com.br` (`@`) | A | IPv4 publico da VPS atual |
| `cdn.iholding.com.br` (`cdn`) | A | Mesmo IPv4 publico |

Se houver registros AAAA, eles devem chegar ao mesmo proxy por IPv6. Ajuste
eventuais registros CAA para permitir a autoridade usada pelo resolver. As
regras do Compose atendem os dois nomes acima; `www` nao foi configurado.
Com CDN/proxy DNS externo, validar o desafio ACME e a conexao TLS com a origem.
Nao aplicar cache compartilhado ao dashboard, API ou respostas autenticadas.

## 3. Validar, construir e inicializar

Depois de preencher o arquivo e conferir o DNS/Traefik, **um unico comando**
executa a instalacao completa:

```bash
cd /var/www/iholding && bash deploy/iholding/up.sh
```

O comando para na primeira falha, cria o administrador apenas se nao houver
usuarios e aguarda a aplicacao ficar saudavel. Pode ser repetido sem trocar
os acessos existentes. Em uma atualizacao com usuarios ativos, siga a janela
de manutencao descrita na secao 6 antes de executa-lo.

Abaixo estao os passos equivalentes para diagnosticar uma etapa isoladamente.

Use **sempre** os argumentos abaixo. O arquivo de ambiente explicito controla
a interpolacao; as credenciais dos servicos sao passadas pelo proprio Compose.
`config --quiet` verifica sem imprimir os segredos. Ver
[interpolacao no Docker Compose](https://docs.docker.com/compose/how-tos/environment-variables/variable-interpolation/).

```bash
cd /var/www/iholding
dc() { docker compose --env-file .env.iholding -f docker-compose.iholding.yml "$@"; }
dc config --quiet
# Para as imagens locais padrao, construir antes de iniciar os servicos.
docker build --tag iholding-minio:2025-10-15 - < deploy/iholding/Minio.Dockerfile
docker build --tag iholding-mc:2025-08-13 - < deploy/iholding/Mc.Dockerfile
dc build iholding-front iholding-migrate
dc up -d iholding-postgres iholding-mongodb iholding-minio
dc run --rm iholding-migrate
dc run --rm iholding-storage-init
dc --profile setup run --rm iholding-bootstrap
dc up -d
dc ps -a
```

O banco vazio usa SQL gerado a partir de `prisma/schema.prisma` durante o build,
mais as funcoes/gatilhos de auditoria e as constraints SQL de reparos. O
historico antigo sozinho nao cria uma instalacao vazia: faltam, por exemplo,
as tabelas de grupos de usuarios antes da migration que cria seus gatilhos.
A inicializacao faz um baseline do schema atual e registra os checksums das
migrations existentes na mesma transacao. Em atualizacoes, nao recria o schema:
segue para `prisma migrate deploy` e aplica apenas as migrations novas.
Esse caminho e restrito a `iholding-postgres/iholding_db` com usuario `iholding`.

O bootstrap se recusa a inserir usuarios se houver outros cadastros no banco.
Reexecutar para o mesmo cadastro inicial nao altera senhas. Depois de confirmar
o primeiro login, remova o valor de `BOOTSTRAP_ADMIN_PASSWORD` do arquivo.
Novos usuarios e alteracoes da empresa devem ser feitos pela interface.

O bucket e configurado para leitura publica por URL, igual ao modelo atual
de arquivos do sistema. A aplicacao recebe um usuario MinIO limitado ao bucket;
escrita e listagem nao sao anonimas. Documentos seguem esse modelo de URLs
publicas; uma exigencia de arquivos privados precisaria de mudanca no app.

## 4. Validacao funcional na VPS

O cabecalho publico usa a logo cadastrada no White Label da empresa. Sem logo,
o espaco permanece vazio; nenhuma marca Nairim e exibida como fallback. Em
Empresas > Editar > Branding, configure a logo principal, a versao para modo
escuro e o favicon. O nome e o icone do aplicativo instalado tambem seguem
a identidade da empresa; sem favicon, usa-se um icone neutro.

Para aplicar apenas uma alteracao de interface, sem migrations:

```bash
git pull --ff-only origin iholding
docker compose --env-file .env.iholding -f docker-compose.iholding.yml up -d --no-deps --build iholding-front
```

```bash
curl -I https://iholding.com.br/login
curl -I http://iholding.com.br/login
curl -f https://cdn.iholding.com.br/minio/health/live
dc logs --tail 50 iholding-migrate iholding-storage-init iholding-logs-worker iholding-scheduler
```

Confirme: certificado HTTPS valido; HTTP redireciona para HTTPS; login do
administrador; empresa `iholding`; cadastros vazios; criacao de um cadastro de
teste; upload, abertura e exclusao de imagem/documento; auditoria chegando ao
MongoDB; exportacao de backup JSON e persistencia depois de recriar o front.
Remova os cadastros de teste pela interface.

O agendador sincroniza os indices mensais a partir do dia 5, 09h no fuso de Sao
Paulo. Recupera execucao perdida no mesmo mes, guarda o mes concluido em volume
e repete em caso de falha, inclusive erro de uma empresa com HTTP 200.

Dependencias externas identificadas: CEP (ViaCEP/OpenCEP/BrasilAPI), indices
do Banco Central e mapas/geocodificacao (CARTO/Geoapify, conforme chaves).
Revisar restricoes de dominio/cotas das chaves para a iholding.

Pendencia preexistente: `/api/lead` tenta enviar para `${NEXT_PUBLIC_URL_API}/leads`,
mas nao existe um endpoint de leads implementado neste repositorio. O novo
build aponta para a propria iholding, sem enviar contatos para a Nairim. O
formulario de contato da vitrine precisa de implementacao especifica para
funcionar; nao exige copiar o antigo backend Express para os modulos migrados.

## 5. Backup e recuperacao

```bash
bash deploy/iholding/backup.sh
```

O script pausa somente front/worker/agendador da iholding que estejam rodando,
exporta PostgreSQL e MongoDB, copia objetos MinIO e backups JSON da interface,
gera checksums e retoma os servicos mesmo em caso de falha. O processo causa
uma janela de indisponibilidade nesta instalacao. O dump do PostgreSQL preserva
tambem a fila `AuditLogOutbox`, que nao deve ser descartada.

Configure periodicidade e retencao conforme a operacao e copie o resultado
para fora da VPS. O script nao habilita agenda nem retencao automatica. O
backup JSON da interface sozinho nao inclui MongoDB nem os arquivos MinIO.

Uma recuperacao completa precisa, em uma instancia isolada com os escritores
parados: `pg_restore` do dump no `iholding_db`, `mongorestore` do arquivo gzip
no `iholding_logs`, copia dos objetos para o mesmo bucket e restauracao dos
backups JSON em `/app/backup` com dono UID/GID 1001. Depois, valide quantidades,
objetos, login e auditoria antes de retomar. Teste a recuperacao antes de
considerar o backup operacional validado.

## 6. Atualizacao e reversao

O workflow `.github/workflows/deploy.yml` atual continua publicando apenas a
Nairim/teste/homologacao. A iholding usa inicialmente deploy manual no checkout
proprio. Para cada atualizacao: registrar a revisao Git e as imagens anteriores,
fazer backup, atualizar o checkout, construir as imagens, parar front/worker/
agendador, executar `dc run --rm iholding-migrate`, e subir com `dc up -d`.
Se a migration falhar, interrompa a publicacao e investigue antes de retomar.
Nao reiniciar automaticamente a versao antiga contra uma migration incompleta.

Uma reversao de codigo deve usar a revisao/imagem anterior compativel com o
schema. Mudancas incompativeis de banco exigem recuperar o conjunto de backup.
`dc down` preserva volumes; `dc down -v` apaga os dados deste ambiente.

## Segredos depois da instalacao

As senhas reais ficam em `.env.iholding` na VPS, com permissao privada, fora do
Git e do contexto de build. Os arquivos `.env.*` sao ignorados pelo Git,
exceto os dois modelos sem credenciais. O valor JWT usado durante o build e
apenas um placeholder; a aplicacao recebe o segredo real no runtime.

Depois de confirmar o primeiro login e guardar a senha em um local protegido,
remova apenas sua copia de inicializacao:

```bash
sed -i 's/^BOOTSTRAP_ADMIN_PASSWORD=.*/BOOTSTRAP_ADMIN_PASSWORD=/' .env.iholding
```

Isso nao altera a senha de login ja cadastrada. As outras senhas do arquivo
continuam necessarias para operar o ambiente.

Arquivos legados da Nairim continham senha fixa de PostgreSQL e um script de
verificacao continha credenciais de login. Nesta branch, os valores foram
substituidos por variaveis obrigatorias. O Compose legado agora exige
`POSTGRES_PASSWORD`, `POSTGRES_TEST2_PASSWORD` e `POSTGRES_HOMOLOG_PASSWORD`.
O script `scripts/test-sticky-planning.mjs` exige `STICKY_TEST_EMAIL` e
`STICKY_TEST_PASSWORD`.

A remocao dos arquivos atuais nao elimina os valores de commits antigos nem
de outras branches. Se essas credenciais ainda forem usadas, troque-as nos
servicos e em todos os consumidores. Em bancos ja existentes, alterar
`POSTGRES_PASSWORD` no .env nao muda a senha da role PostgreSQL. A rotacao e
separada do deploy da iholding e requer atualizacao coordenada dos acessos.

## Validacoes locais

### Deploy pelo GitHub Actions

O workflow `.github/workflows/deploy-iholding.yml` roda a cada push na branch
`iholding` e tambem pode ser iniciado manualmente na aba Actions dessa branch.
Ele constroi as imagens `runner` (front) e `operations` (migrations, worker e
agendador) no GitHub e publica no GHCR com o SHA do commit. A VPS nao faz build.
PostgreSQL, MongoDB e MinIO continuam na VPS com seus volumes existentes.

Em Settings > Secrets and variables > Actions, confira os secrets ja utilizados
pelo workflow da Nairim: `HOST_IP` deve ser a VPS `187.77.236.241`,
`HOST_USERNAME` deve ser o usuario SSH com acesso a Docker e `/var/www/iholding`
(atualmente `root`), e `HOST_SSH_KEY_2` deve ser sua chave privada de acesso SSH.
Nao adicione o arquivo `.env.iholding` ao GitHub: ele permanece somente na VPS.
O `GITHUB_TOKEN` e fornecido automaticamente e usado para publicar/baixar as
imagens; o login na VPS usa um diretorio Docker temporario e nao altera o login
Docker utilizado pelos outros ambientes.

A conexao SSH na porta 22 e o `git fetch origin iholding` devem funcionar para
esse usuario na VPS. O checkout existente deve estar na branch `iholding`, sem
alteracoes locais em arquivos rastreados. O workflow atualiza por fast-forward,
sem apagar alteracoes ou executar reset. So aplica o commit que gerou as imagens.

O deploy baixa ambas as imagens, aplica migrations pendentes e atualiza somente
front, worker de logs e agendador da iholding. Confere a saude dos servicos e
salva as referencias das imagens em `.env.iholding` depois do sucesso. Nao
executa bootstrap, nao recria bancos e nao apaga volumes. Se a migration falhar,
o front anterior permanece em execucao. Se a atualizacao da aplicacao falhar,
o Actions reporta a falha; nao ha reversao automatica das migrations.

Para acompanhar, abra Actions > Deploy iholding no repositorio. Os dois jobs
de imagem precisam terminar antes do job de deploy. A empresa da vitrine deve
ser selecionada em Configuracoes > Pagina principal depois do primeiro deploy.

Teste local do workflow e do deploy com Docker simulado:

```bash
node --test deploy/iholding/actions.test.mjs deploy/iholding/compose.test.mjs
```

### Empresa da pagina principal

Como SUPER_ADMIN, abra Configuracoes > Pagina principal, selecione uma empresa
ativa e salve. A selecao e global nesta instalacao, armazenada por ID no banco,
e controla os imoveis, detalhes e identidade visual da vitrine publica.
Trocar o slug da empresa nao perde a selecao. Empresas desativadas ou excluidas
nao sao publicadas. Enquanto nao houver selecao, permanece o fallback do .env.

Ao atualizar uma instalacao existente, aplique a migration antes do novo front:

```bash
git pull --ff-only origin iholding
docker compose --env-file .env.iholding -f docker-compose.iholding.yml build iholding-front iholding-migrate
docker compose --env-file .env.iholding -f docker-compose.iholding.yml run --rm iholding-migrate
docker compose --env-file .env.iholding -f docker-compose.iholding.yml up -d --no-deps iholding-front
```

Esses comandos preservam os dados existentes. O script up.sh tambem aplica a
migration durante a atualizacao completa do ambiente.

```bash
node --test deploy/iholding/operations.test.mjs deploy/iholding/compose.test.mjs deploy/iholding/schema.test.mjs deploy/iholding/startup.test.mjs
npx tsc --noEmit
```

O teste de schema usa PostgreSQL embarcado (PGlite ja presente no lockfile via
Prisma) e valida baseline, auditoria, criacao do administrador, hash da senha
e preservacao dos cadastros vazios. Os outros testes conferem isolamento
do Compose, validacao de credenciais e agendamento. Esses testes nao substituem
build das imagens, subida, TLS, DNS, upload e recuperacao reais na VPS.
