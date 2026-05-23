# Frontend Quick Start - Planning Routes

## 📋 TL;DR - Copy This Checklist

**Para não ter erro, sempre validar ANTES de enviar:**

- [ ] POST /planning?
  - ✅ `category_id` não-vazio (UUID string)
  - ✅ `year` entre 2000-2100
  - ✅ `type` = "FIXED" ou "VARIABLE"
  - ✅ Se FIXED: `default_amount` ≥ 0
  - ✅ Se VARIABLE: `monthly_values` com 12 meses (1-12), sem duplicatas, amounts ≥ 0
  - ✅ Authorization header com token válido

- [ ] GET /planning?year=YYYY
  - ✅ `year` entre 2000-2100
  - ✅ Authorization header

- [ ] GET /planning/:id
  - ✅ `id` é UUID válido
  - ✅ Planning existe
  - ✅ Authorization header

- [ ] DELETE /planning/:id
  - ✅ Confirmação do usuário
  - ✅ `id` é UUID válido
  - ✅ Authorization header

- [ ] GET /planning/dashboard?startDate=YYYY-MM-DD&endDate=YYYY-MM-DD
  - ✅ Formato YYYY-MM-DD em ambas
  - ✅ startDate ≤ endDate
  - ✅ Datas válidas
  - ✅ Authorization header

---

## 🚨 Common Errors & How to Fix

### Error: "category_id é obrigatório"
```javascript
❌ WRONG: { category_id: "" }
✅ RIGHT: { category_id: "550e8400-e29b-41d4-a716-446655440000" }
```

### Error: "year deve estar entre 2000 e 2100"
```javascript
❌ WRONG: { year: 2030 }
✅ RIGHT: { year: 2026 }
```

### Error: "type deve ser FIXED ou VARIABLE"
```javascript
❌ WRONG: { type: "fixed" } // lowercase
✅ RIGHT: { type: "FIXED" } // uppercase
```

### Error: "default_amount é obrigatório para planejamentos do tipo FIXED"
```javascript
// Type FIXED:
❌ WRONG: { type: "FIXED", monthly_values: [...] }
✅ RIGHT: { type: "FIXED", default_amount: 5000 }

// Type VARIABLE:
❌ WRONG: { type: "VARIABLE", default_amount: 5000 }
✅ RIGHT: { type: "VARIABLE", monthly_values: [...] }
```

### Error: "monthly_values não pode conter meses duplicados"
```javascript
❌ WRONG: [
  { month: 1, amount: 1500 },
  { month: 1, amount: 1600 } // Duplicated!
]

✅ RIGHT: [
  { month: 1, amount: 1500 },
  { month: 2, amount: 1600 },
  ...
]
```

### Error: "startDate não pode ser maior que endDate"
```javascript
❌ WRONG: startDate=2026-12-31&endDate=2026-01-01
✅ RIGHT: startDate=2026-01-01&endDate=2026-12-31
```

### Error: "startDate deve estar no formato YYYY-MM-DD"
```javascript
❌ WRONG: "01/01/2026" or "01-01-2026" or "2026/01/01"
✅ RIGHT: "2026-01-01"
```

---

## 📊 Response Structure - What You'll Get Back

### POST /planning Response
```javascript
{
  success: true,
  data: {
    id: "uuid",
    category_id: "uuid",
    subcategory_id: "uuid or null",
    year: 2026,
    type: "FIXED or VARIABLE",
    default_amount: "5000.00 or null",
    min_recommended: "4500.00 or null",      // Auto-calculated!
    max_recommended: "5800.00 or null",      // Auto-calculated!
    is_active: true,
    created_at: "2026-05-18T10:30:00Z",
    updated_at: "2026-05-18T10:30:00Z",
    monthly_values: [
      { id: "uuid", planning_id: "uuid", month: 1, amount: "5000.00" },
      { id: "uuid", planning_id: "uuid", month: 2, amount: "5000.00" },
      ...
    ]
  },
  message: "Planejamento salvo com sucesso"
}
```

### GET /planning Response
```javascript
{
  success: true,
  data: [
    {
      id: "cat-uuid",
      name: "Despesas",
      type: "EXPENSE",
      is_active: true,
      planning: { id, category_id, type, ... },  // Or null
      subcategories: [
        {
          id: "subcat-uuid",
          name: "Aluguel",
          is_active: true,
          planning: { id, category_id, ... }  // Or null
        }
      ]
    }
  ],
  message: "Planejamentos recuperados com sucesso"
}
```

### GET /planning/dashboard Response
```javascript
{
  success: true,
  data: {
    start_date: "2026-01-01",
    end_date: "2026-12-31",
    balances: {
      monthly: [
        { month: 1, year: 2026, realized_amount: 2500.00 },
        { month: 2, year: 2026, realized_amount: 2650.00 }
      ],
      accumulated: [
        { month: 1, year: 2026, realized_amount: 2500.00 },
        { month: 2, year: 2026, realized_amount: 5150.00 }
      ]
    },
    incomes: [
      {
        id: "uuid",
        name: "Total de Receitas",
        type: "INCOME",
        planned_amount: 48000.00,
        realized_amount: 48500.00,
        percentage: 101.04,
        min: 3800.00,
        med: 4041.67,
        max: 4200.00,
        monthly_data: [
          { month: 1, year: 2026, realized_amount: 4000.00 },
          { month: 2, year: 2026, realized_amount: 4100.00 }
        ],
        subcategories: [...]
      }
    ],
    expenses: [...]
  },
  message: "Dashboard de planejamento recuperado com sucesso"
}
```

---

## 🛠️ Code Examples - Copy & Paste Ready

### 1️⃣ POST /planning - Create/Update FIXED Type

```javascript
async function createFixedPlanning() {
  const payload = {
    category_id: "550e8400-e29b-41d4-a716-446655440000",
    subcategory_id: null,
    year: 2026,
    type: "FIXED",
    default_amount: 5000
  };

  try {
    const response = await fetch("http://localhost:5000/planning", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${localStorage.getItem("token")}`
      },
      body: JSON.stringify(payload)
    });

    const result = await response.json();

    if (!response.ok) {
      console.error("Validation errors:", result.errors);
      return;
    }

    console.log("✅ Planning created:", result.data);
  } catch (error) {
    console.error("❌ Request failed:", error);
  }
}
```

### 2️⃣ POST /planning - Create/Update VARIABLE Type

```javascript
async function createVariablePlanning() {
  const payload = {
    category_id: "550e8400-e29b-41d4-a716-446655440000",
    subcategory_id: "660e8400-e29b-41d4-a716-446655440001",
    year: 2026,
    type: "VARIABLE",
    monthly_values: [
      { month: 1, amount: 1500 },
      { month: 2, amount: 1600 },
      { month: 3, amount: 1550 },
      { month: 4, amount: 1700 },
      { month: 5, amount: 1650 },
      { month: 6, amount: 1800 },
      { month: 7, amount: 1750 },
      { month: 8, amount: 1900 },
      { month: 9, amount: 1850 },
      { month: 10, amount: 2000 },
      { month: 11, amount: 1950 },
      { month: 12, amount: 2100 }
    ]
  };

  try {
    const response = await fetch("http://localhost:5000/planning", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${localStorage.getItem("token")}`
      },
      body: JSON.stringify(payload)
    });

    const result = await response.json();

    if (!response.ok) {
      console.error("❌ Validation errors:");
      result.errors.forEach(error => console.error(`  - ${error}`));
      return;
    }

    console.log("✅ Planning created/updated:", result.data);
  } catch (error) {
    console.error("❌ Request failed:", error);
  }
}
```

### 3️⃣ GET /planning - List by Year

```javascript
async function getPlanningsByYear(year) {
  if (!year || year < 2000 || year > 2100) {
    console.error("❌ Year must be between 2000 and 2100");
    return;
  }

  try {
    const response = await fetch(
      `http://localhost:5000/planning?year=${year}`,
      {
        headers: {
          "Authorization": `Bearer ${localStorage.getItem("token")}`
        }
      }
    );

    const result = await response.json();

    if (!response.ok) {
      console.error("❌ Error:", result.errors);
      return;
    }

    console.log("✅ Plannings fetched:");
    result.data.forEach(category => {
      console.log(`📁 ${category.name} (${category.type})`);
      if (category.planning) {
        console.log(`  Planning: type=${category.planning.type}`);
      }
    });

    return result.data;
  } catch (error) {
    console.error("❌ Request failed:", error);
  }
}
```

### 4️⃣ GET /planning/dashboard - Dashboard

```javascript
async function getDashboard(startDate, endDate) {
  const dateRegex = /^\d{4}-\d{2}-\d{2}$/;
  
  if (!dateRegex.test(startDate) || !dateRegex.test(endDate)) {
    console.error("❌ Dates must be YYYY-MM-DD format");
    return;
  }

  const start = new Date(startDate);
  const end = new Date(endDate);
  
  if (start > end) {
    console.error("❌ startDate cannot be greater than endDate");
    return;
  }

  try {
    const url = new URL("http://localhost:5000/planning/dashboard");
    url.searchParams.append("startDate", startDate);
    url.searchParams.append("endDate", endDate);

    const response = await fetch(url.toString(), {
      headers: {
        "Authorization": `Bearer ${localStorage.getItem("token")}`
      }
    });

    const result = await response.json();

    if (!response.ok) {
      console.error("❌ Validation errors:", result.errors);
      return;
    }

    console.log("✅ Dashboard fetched:");
    console.log(`Period: ${result.data.start_date} to ${result.data.end_date}`);

    return result.data;
  } catch (error) {
    console.error("❌ Request failed:", error);
  }
}
```

---

## 🔒 Token Management

```javascript
const token = localStorage.getItem("token");

if (!token) {
  console.error("❌ No authentication token found. Please login first.");
  window.location.href = "/login";
}

const headers = {
  "Content-Type": "application/json",
  "Authorization": `Bearer ${token}`
};
```
