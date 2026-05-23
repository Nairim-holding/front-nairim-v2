# Planning & Financial Control - Refactoring Summary

## 📋 Alterações Realizadas

### 1. **Documentação de Contratos** ✅
**Arquivo:** `.claude/frontend/planning_contracts.md`
- ✅ Documentado o novo contrato de API (REQUEST/RESPONSE)
- ✅ Clarificada a REGRA DE OURO: `min_recommended` e `max_recommended` são READ-ONLY
- ✅ Adicionadas regras de implementação e checklist para conversas futuras

---

### 2. **Atualização de Tipos TypeScript** ✅
**Arquivo:** `src/components/planejamento/types.ts`

**Alterações:**
- ✅ Adicionado `min_recommended: number | null` a `DashboardItem`
- ✅ Adicionado `max_recommended: number | null` a `DashboardItem`
- ✅ Criado tipo `PlanType = 'FIXED' | 'VARIABLE'`
- ✅ Criado tipo `MonthlyValue` com estrutura `{ month, amount }`
- ✅ Criado tipo `PlanningPayloadFixed` para payloads FIXED (contém `default_amount`)
- ✅ Criado tipo `PlanningPayloadVariable` para payloads VARIABLE (contém `monthly_values`)
- ✅ Criado tipo union `PlanningPayload = PlanningPayloadFixed | PlanningPayloadVariable`

**Resultado:** Tipagem clara separando o que é enviado (payload) do que é recebido (response).

---

### 3. **Camada de Serviço (API)** ✅
**Arquivos:**
- `src/app/dashboard/(financeiro)/planejamento/content.tsx` - `handleSaveInline()`
- `src/components/planejamento/PlanningEditModal.tsx` - `handleSave()`

**Status:** ✅ JÁ COMPLIANT
- ✅ Payload em `handleSaveInline()`: envia apenas `category_id`, `subcategory_id`, `year`, `type`, `default_amount`
- ✅ Payload em `handleSave()`: envia apenas `category_id`, `subcategory_id`, `year`, `type`, `default_amount` ou `monthly_values`
- ✅ Nenhum lugar envia `min_recommended` ou `max_recommended`
- ✅ DELETE preservado em `handleDelete()` para remover planejamentos

---

### 4. **Formulários/UI** ✅
**Arquivo:** `src/components/planejamento/PlanningEditModal.tsx`

**Alterações Anteriores (já realizadas):**
- ✅ Removido input de "Mínimo recomendado (R$)"
- ✅ Removido input de "Máximo recomendado (R$)"
- ✅ Removida validação `if (minRecommended > 0 && maxRecommended > 0 && ...)`
- ✅ Removidas linhas de payload: `if (minRecommended > 0) payload.min_recommended = ...`
- ✅ Removidas linhas de payload: `if (maxRecommended > 0) payload.max_recommended = ...`
- ✅ Removidos estados: `minRecommended`, `minRecommendedInput`, `maxRecommended`, `maxRecommendedInput`

**Nova Alteração (this session):**
- ✅ Removido o título do modal (que mostrava "IPTU" ou outro nome)

**Resultado:** Modal exibe apenas:
- Seleção entre FIXED e VARIABLE
- Campos de valor (fixo ou 12 meses)
- Botões de ação (Cancelar, Salvar, Remover)

---

### 5. **Dashboard/Tabela de Planejamento** ✅
**Arquivo:** `src/components/planejamento/PlanningTable.tsx`

**Status:** ✅ JÁ CORRETO
- ✅ Renderiza `min`, `med`, `max` como colunas read-only (estatísticas)
- ✅ Não há inputs para editar esses valores
- ✅ Edição inline permite apenas `planned_amount`
- ✅ Calcula `percentage` automaticamente baseado na resposta

---

## 📊 Consumo Correto da API

### GET /plannings/dashboard
- ✅ Estrutura hierárquica respeitada: `incomes[]` → `subcategories[]`
- ✅ Cada item tem: `id`, `name`, `planned_amount`, `realized_amount`, `percentage`, `min`, `med`, `max`, `min_recommended`, `max_recommended`, `monthly_data[]`
- ✅ Cálculo de `percentage` já vem do back-end
- ✅ `monthly_data` usado para histórico de valores realizados

### POST /plannings
- ✅ Payload contém: `category_id`, `year`, `type`, `default_amount` (FIXED) ou `monthly_values` (VARIABLE)
- ✅ Opcional: `subcategory_id`
- ✅ ❌ NUNCA envia: `min_recommended`, `max_recommended`, `min`, `med`, `max`

---

## ✅ Checklist Final

- [x] Documentação de contratos criada em `.claude/frontend/planning_contracts.md`
- [x] Tipos TypeScript atualizados com `min_recommended` e `max_recommended`
- [x] Tipos de payload criados (`PlanningPayloadFixed`, `PlanningPayloadVariable`)
- [x] Verificado que nenhum lugar envia `min_recommended` ou `max_recommended`
- [x] Inputs de mínimo/máximo removidos do modal
- [x] Dashboard renderiza valores read-only corretamente
- [x] `monthly_data` sendo consumido para histórico

---

## 🚀 Próximas Conversas

Use `.claude/frontend/planning_contracts.md` como referência:
1. Antes de modificar qualquer campo de planejamento
2. Ao investigar erros de validação ou salvamento
3. Ao adicionar novos gráficos ou visualizações
4. Para garantir que payloads estão corretos

**NUNCA envie `min_recommended` ou `max_recommended` no POST/PUT!**
