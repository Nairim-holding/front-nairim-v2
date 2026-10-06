# Reparos e transferência de cadastros

## Ativação

A migração `20261006000000_repair_items_and_professionals` adiciona os múltiplos problemas, os profissionais e os itens. Ela mantém os campos antigos e preenche os vínculos dos reparos existentes. O backup completo também inclui os novos registros.

No ambiente de destino, aplique as migrações e gere o cliente antes de iniciar a aplicação:

```sh
npx prisma migrate deploy
npx prisma generate
npm run build
```

## Reparos

Marque os tipos de problema e adicione quantos profissionais forem necessários. Cada item tem descrição, tipo (mão de obra ou materiais), contato e valor. Os contatos dos itens são incluídos entre os responsáveis do reparo.

Com itens, os totais são calculados em centavos tanto na tela como no servidor. Sem itens, os campos de valores gerais continuam disponíveis para registros antigos ou lançamentos simplificados. Os contatos devem estar ativos e pertencer à empresa atual.

## Exportar e importar JSON

Os cabeçalhos das listagens de cadastros têm **Exportar JSON** e **Importar JSON**. Categorias e lançamentos têm um seletor para escolher a tabela. Relatórios calculados e dashboards não têm dados próprios a importar.

A exportação abrange todos os registros do cadastro, incluindo excluídos logicamente, sem aplicar a paginação ou os filtros da tela. Inclui detalhes vinculados, como endereços, canais de contato, meses de planejamento, valores de imóveis, documentos e itens dos reparos. Outros cadastros referenciados não são copiados automaticamente.

No destino, selecione a mesma tabela e o arquivo exportado. A prévia mostra a quantidade de registros antes da confirmação. A importação cria ou atualiza pelo ID, preserva registros ausentes do arquivo e ocorre em uma única transação: falhas não deixam gravações parciais.

A empresa de origem é substituída pela empresa da sessão no destino. IDs de negócio são preservados. Importe primeiro os cadastros de referência, por exemplo:

1. Tipos de imóvel, categorias, instituições, centros e índices de reajuste.
2. Proprietários, imobiliárias, inquilinos e contatos; subcategorias vão junto com categorias.
3. Imóveis, cartões e investimentos.
4. Locações, recorrências e faturas.
5. Lançamentos, planejamento, reparos e notificações de locações.

O sistema indica o cadastro e o ID que estão faltando quando encontra uma referência ausente. Conflitos de IDs/chaves únicas são recusados. Arquivos de outra tabela, tabelas extras, campos aninhados, tipos incompatíveis e filhos fora do cadastro também são recusados.

Exportar exige a permissão de exportação; importar exige criar e editar no recurso. Usuários e grupos exigem também um administrador. Empresas exigem um super administrador e são a exceção ao remapeamento: são transferidas com seus próprios IDs. A transferência de usuários remove acessos a outras empresas; usuários super administradores só podem ser importados ou alterados por outro super administrador.

O JSON suporta até 40 MB e 100.000 registros por arquivo. Documentos e mídias levam os metadados e URLs; os arquivos físicos precisam ser disponibilizados no armazenamento do destino separadamente.

Os metadados das colunas são gerados a partir de `prisma/schema.prisma` com `npm run generate:table-models`; a compilação também os gera automaticamente. O teste de consistência verifica se continuam atualizados.

## Verificação

`npx vitest run` executa os testes do projeto, incluindo validação, permissões, subtotais, dependências e isolamento por empresa. Depois de compilar, `npm run test:repair-ui` confere o formulário real em um navegador isolado, usando o exemplo das duas janelas. Este teste substitui a sessão e as ações do servidor por simulações e não grava dados no banco.
