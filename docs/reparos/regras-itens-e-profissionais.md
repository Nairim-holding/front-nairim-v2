# Reparos — itens, profissionais e ativação

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

