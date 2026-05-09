# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

Front-nairim-v2 is a real estate management application (imobiliária) built with **Next.js 16**, **React 19**, and **TypeScript**. It manages properties, owners, rentals, tenants, and financial operations through a comprehensive dashboard.

## Commands

```bash
# Development
npm run dev                # Start dev server at http://localhost:3000

# Build & Production
npm run build              # Production build to .next/
npm start                  # Run production server (requires build first)

# Linting
npm run lint              # Run ESLint on project (currently configured but no auto-fix)
```

No test runner is currently configured. For debugging, use browser DevTools or add console logs.

## Architecture

### SSR/CSC Boundary (Critical)

This project separates server and client rendering:
- **`src/app/layout.tsx`**: Pure Server Component (no "use client")
- **`src/app/providers.tsx`**: Single "use client" wrapper containing ALL providers (Auth, Theme, Message, Popup, Filter)

This pattern preserves Next.js SSR benefits. Never add "use client" to `layout.tsx` or the provider boundary will collapse, forcing client hydration of the entire app.

### Directory Structure

```
src/
├── app/                    # Next.js 16 App Router
│   ├── (auth)/            # Route group: login
│   ├── (cadastro)/        # Route group: CRUD pages (properties, owners, rentals, etc.)
│   ├── (financeiro)/      # Route group: financial features
│   ├── layout.tsx         # Root layout (Server Component)
│   ├── providers.tsx      # Providers wrapper ("use client")
│   └── api/               # API routes (e.g., CEP lookup)
├── components/            # React components by feature type
│   ├── ui/                # Reusable UI primitives (Input, Select, Form, etc.)
│   ├── form/              # Form-specific (MultiColumnManager, StepProgressBar, etc.)
│   ├── table/             # Table components (TableSkeleton)
│   ├── charts/            # ECharts & Leaflet visualizations
│   ├── filters/           # Dashboard filtering UI
│   ├── feedback/          # Toast, Notifications, ConfirmDialog
│   ├── domain/            # Feature-specific (ContactManager, PropertyRentals, etc.)
│   ├── layout/            # Sidebar, Logo, PageSection
│   ├── modals/            # Modal dialogs
│   ├── map/               # Map components
│   └── auth/              # Login components
├── contexts/              # React Context providers
│   ├── index.ts           # Central export point (all contexts)
│   ├── AuthContext.tsx
│   ├── ThemeContext.tsx
│   ├── MessageContext.tsx
│   ├── PopupContext.tsx
│   └── filter-context.tsx
├── hooks/                 # Custom React hooks
│   ├── usePopup.ts
│   ├── useMessage.ts
│   ├── useDynamicForm.ts
│   ├── useDynamicFilters.ts
│   ├── useTableData.ts
│   └── ... (others for forms, filters, data fetching)
├── services/              # API communication layer
│   └── property-service.ts
├── types/                 # TypeScript types (central export via index.ts)
│   ├── index.ts
│   ├── administrador.ts
│   ├── owner.ts
│   └── ...
├── utils/                 # Utility functions (central export via index.ts)
│   ├── index.ts
│   ├── formatters.ts      # Currency, date, phone, etc.
│   ├── masks.ts           # Input masks
│   ├── getThemeTokens.ts
│   └── ...
├── layout/                # Layout components (outside App Router)
│   └── DashboardLayout/
└── lib/                   # Re-exports of centralized modules (formatters, services)
```

### Central Export Points

Prefer importing from centralized locations to avoid scattered dependencies:

```typescript
// Contexts
import { useAuth, useTheme, useFilters, useMessageContext, usePopupContext } from "@/contexts"

// Types  
import type { Property, PropertyFilters, PaginatedResponse } from "@/types"

// Utils (formatters, helpers)
import { formatCurrency, formatDate, getThemeTokens, getDefaultDateRange } from "@/utils"

// Services
import { propertyService } from "@/services/property-service"
```

### Component Patterns

**UI Components** (`src/components/ui/`):
- Reusable, framework-agnostic inputs: Input, Select, TextArea, Toggle, Label, Form
- Unstyled or Tailwind-based, props-driven

**Feature Components** (`src/components/domain/`):
- Domain-specific like `ContactManager`, `HouseRentals`, `ApartmentRentals`
- Higher complexity, tied to app logic

**Form Handling**:
- Multi-step forms: `useDynamicForm` hook + `StepProgressBar` component
- Single-page forms: Direct form submission with error handling
- Dynamic fields: `useDynamicFilters` for filter UI generation

**Data Fetching**:
- `useTableData`: List/table queries with pagination, sorting
- `useOptimizedTableData`: Memo-optimized variant  
- `useFetchItem`: Single item fetching (create/edit flows)
- `useCepLookup`: CEP-to-address lookup (async with rate limiting)

**Navigation & State**:
- Auth state: `useAuth()` hook + `AuthContext`
- Theme: `useTheme()` from `ThemeContext`
- Messages/Toasts: `useMessageContext()` + `Toast` component
- Popups/Modals: `usePopupContext()` for programmatic control
- Filters: `useFilters()` for dashboard state persistence

### Key Dependencies

- **React 19** + **Next.js 16**: UI framework + meta-framework
- **TypeScript 5**: Type safety
- **Tailwind CSS 4**: Styling (via @tailwindcss/postcss plugin)
- **ECharts + echarts-for-react**: Data visualizations
- **Leaflet + react-leaflet**: Maps
- **Framer Motion**: Animations
- **next-pwa**: Progressive Web App support
- **Lucide React**: Icons
- **Swiper**: Carousels/sliders
- **react-countup**: Number animations

### Known Patterns to Maintain

1. **Always split SSR/CSC at the root provider**: Server layout → client providers wrapper
2. **Centralize re-exports**: New utils, types, or services go to central indexes
3. **Use path aliases**: `@/` prefix for all internal imports
4. **Typed contexts**: All context hooks are fully typed; extend via `type` exports in `contexts/index.ts`
5. **Services layer**: API calls live in `services/` with clean interfaces, not scattered in components
6. **Formatting**: All formatters in `utils/formatters.ts` (currency, date, phone, CPF/CNPJ, etc.)
