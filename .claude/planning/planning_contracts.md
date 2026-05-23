# Planning & Financial Control - API Contracts & Frontend Rules

## 🔴 REGRA DE OURO

**Os campos `min_recommended` e `max_recommended` são estritamente READ-ONLY.**

- ❌ O Front-end NUNCA deve enviá-los em POST ou PUT
- ✅ Eles vêm calculados do Back-end na resposta
- ✅ Devem ser apenas exibidos (display-only) na interface

---

## API Endpoints

### POST /plannings (Criar/Atualizar Planejamento)

**REQUEST:**
```json
{
  "category_id": "550e8400-e29b-41d4-a716-446655440000",
  "subcategory_id": "550e8400-e29b-41d4-a716-446655440001",
  "year": 2026,
  "type": "FIXED",
  "default_amount": 1500.00
}
```

**OR (tipo VARIABLE):**
```json
{
  "category_id": "550e8400-e29b-41d4-a716-446655440000",
  "year": 2026,
  "type": "VARIABLE",
  "monthly_values": [
    { "month": 1, "amount": 1500.00 },
    { "month": 2, "amount": 1600.00 },
    { "month": 3, "amount": 1500.00 }
  ]
}
```

**Notas:**
- `subcategory_id` é opcional (apenas se planejamento é para uma subcategoria)
- Para FIXED: usar `default_amount` (número)
- Para VARIABLE: usar `monthly_values` (array de meses com amounts)
- Nunca incluir `min_recommended`, `max_recommended` ou `min`, `med`, `max` no payload

---

### GET /plannings/dashboard

**RESPONSE:**
```json
{
  "start_date": "2026-01-01",
  "end_date": "2026-05-18",
  "balances": {
    "monthly": [
      { "month": 1, "year": 2026, "realized_amount": 5000.00 }
    ],
    "accumulated": [
      { "month": 1, "year": 2026, "realized_amount": 5000.00 }
    ]
  },
  "incomes": [
    {
      "id": "uuid",
      "name": "Total Rendas",
      "planned_amount": 15000.00,
      "realized_amount": 14500.00,
      "percentage": 96.67,
      "min": 12000.00,
      "med": 15000.00,
      "max": 18000.00,
      "min_recommended": null,
      "max_recommended": null,
      "type": "INCOME",
      "monthly_data": [
        { "month": 1, "year": 2026, "realized_amount": 5000.00 }
      ],
      "subcategories": [
        {
          "id": "uuid",
          "name": "Salário",
          "planned_amount": 10000.00,
          "realized_amount": 10000.00,
          "percentage": 100.00,
          "min": 10000.00,
          "med": 10000.00,
          "max": 10000.00,
          "min_recommended": null,
          "max_recommended": null,
          "monthly_data": [
            { "month": 1, "year": 2026, "realized_amount": 10000.00 }
          ],
          "planning_id": "uuid"
        }
      ],
      "planning_id": "uuid"
    }
  ],
  "expenses": [ /* similar structure */ ]
}
```

**Notas sobre a Response:**
- Estrutura hierárquica: `incomes` e `expenses` são arrays de categorias
- Cada categoria tem `subcategories` (array de itens)
- `min_recommended` e `max_recommended` sempre vêm da API (calculados)
- `min`, `med`, `max` são estatísticas (mínimo, mediana, máximo)
- `monthly_data` contém histórico de valores realizados por mês
- `planning_id` identifica qual planejamento foi criado

---

## Frontend Types & Interfaces

### Request Payloads (o que enviamos)

```typescript
export interface PlanningPayloadFixed {
  category_id: string;
  subcategory_id?: string;
  year: number;
  type: 'FIXED';
  default_amount: number;
}

export interface PlanningPayloadVariable {
  category_id: string;
  subcategory_id?: string;
  year: number;
  type: 'VARIABLE';
  monthly_values: Array<{ month: number; amount: number }>;
}

export type PlanningPayload = PlanningPayloadFixed | PlanningPayloadVariable;
```

### Response Types (o que a API retorna)

```typescript
export interface MonthlyData {
  month: number;
  year: number;
  realized_amount: number;
}

export interface DashboardItem {
  id: string;
  name: string;
  planned_amount: number;
  realized_amount: number;
  percentage: number;
  min: number | null;
  med: number;
  max: number | null;
  min_recommended: number | null;  // READ-ONLY
  max_recommended: number | null;   // READ-ONLY
  monthly_data: MonthlyData[];
  planning_id?: string;
}

export interface CategoryDashboard extends DashboardItem {
  type: 'INCOME' | 'EXPENSE';
  subcategories: DashboardItem[];
}

export interface DashboardResponse {
  start_date: string;
  end_date: string;
  balances: {
    monthly: MonthlyData[];
    accumulated: MonthlyData[];
  };
  incomes: CategoryDashboard[];
  expenses: CategoryDashboard[];
}
```

---

## Frontend Implementation Rules

### 1. Quando criar novo planejamento
- Coletar: `category_id`, `year`, `type`, e `default_amount` (FIXED) ou `monthly_values` (VARIABLE)
- Coletar: `subcategory_id` se for subcategoria
- ❌ Nunca pedir/enviar: `min_recommended`, `max_recommended`
- ✅ Após sucesso, refetch dashboard para obter valores calculados

### 2. Quando exibir planejamento existente
- Exibir `min`, `med`, `max` como estatísticas (read-only)
- Exibir `min_recommended`, `max_recommended` como referência (read-only)
- ❌ Nunca permitir edição desses campos

### 3. Camada de Serviço
- Função `createPlanning(payload: PlanningPayload)` → POST /plannings
- Função `updatePlanning(id: string, payload: PlanningPayload)` → PUT /plannings/:id
- Função `deletePlanning(id: string)` → DELETE /plannings/:id
- Função `fetchDashboard(startDate, endDate)` → GET /plannings/dashboard

### 4. Validação no Frontend
- **FIXED:** `default_amount > 0`
- **VARIABLE:** ao menos 1 mês com `amount > 0`
- ❌ Nunca validar `min_recommended` ou `max_recommended` (vêm do back-end)

---

## Checklist de Conversas Futuras

Ao trabalhar com planejamento, sempre verificar:
- [ ] Payload está sem `min_recommended` e `max_recommended`?
- [ ] Resposta está sendo consumida corretamente (estrutura hierárquica)?
- [ ] `monthly_data` está sendo usado para histórico?
- [ ] Inputs de mín/máx estão desabilitados/ocultos?
- [ ] Dashboard mostra `min`, `med`, `max` como read-only?
