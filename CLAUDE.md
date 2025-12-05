# Flickerify

Multi-tenant compatibility checker SaaS. Organizations create pages where users check if products are compatible (e.g., "Is this OBD device compatible with my vehicle?").

## Commands

```bash
bun run dev          # Start frontend + backend (Next.js + Convex)
bun run build        # Production build
bun run lint         # ESLint
bun run format       # Prettier
bun run db:push      # Push Drizzle schema to PlanetScale
```

## Stack

- **Frontend**: Next.js 16 (App Router), React 19, Tailwind CSS 4, shadcn/ui
- **Backend**: Convex (real-time, identity, billing), PlanetScale PostgreSQL (business data via Drizzle)
- **Auth**: WorkOS AuthKit
- **Billing**: Stripe
- **Runtime**: Bun

## Architecture

**Dual Database Pattern**: PlanetScale is system of record for business data. Convex caches data for real-time UI and stores identity/billing synced from WorkOS/Stripe.

```
Write: UI → API Routes → PlanetScale → (sync to Convex)
Read:  UI → Convex (cache) → (cache miss) → API → PlanetScale
```

## Key Patterns

### Convex Functions

Use custom builders from `convex/functions.ts`:

```ts
import { protectedQuery } from '../functions';

export const myQuery = protectedQuery({
  args: { id: v.id('users') },
  returns: v.string(),
  handler: async (ctx, args) => {
    // ctx.user is available (authenticated)
    return ctx.user.email;
  },
});
```

| Builder                               | Auth | Admin | Use Case            |
| ------------------------------------- | ---- | ----- | ------------------- |
| `publicQuery/Mutation/Action`         | No   | No    | Public APIs         |
| `protectedQuery/Mutation/Action`      | Yes  | No    | Authenticated users |
| `protectedAdminQuery/Mutation/Action` | Yes  | Yes   | Admin-only          |
| `internalQuery/Mutation/Action`       | N/A  | N/A   | Internal calls only |

### Directory Structure

- `app/(app)/` – Authenticated routes (dashboard)
- `app/(onboarding)/` – Onboarding flow
- `app/[domain]/` – Public tenant pages (subdomain routing)
- `convex/[domain]/` – Backend modules (internal/, query.ts, action.ts)
- `db/schema/` – Drizzle table definitions

### Code Style

- TypeScript strict mode
- Kebab-case files, PascalCase components, camelCase functions
- Readonly props: `{ readonly children: ReactNode }`
- Single quotes, trailing commas
- All Convex functions require `returns` validator

## Progressive Disclosure

For detailed context, read these files:

| Topic                  | File                  |
| ---------------------- | --------------------- |
| Full project spec      | `openspec/project.md` |
| UI/accessibility rules | `AGENTS.md`           |
| Change proposals       | `openspec/AGENTS.md`  |
| Convex schema          | `convex/schema.ts`    |
| API structure          | `convex/functions.ts` |

## External Services

- **WorkOS**: Auth, SSO, organizations (webhooks sync to Convex)
- **Stripe**: Subscriptions (webhooks sync to Convex)
- **PlanetScale**: PostgreSQL via `@neondatabase/serverless` + Drizzle
- **Convex**: Real-time backend at `convex.cloud`
