# Project Context

## Purpose

A full-stack application built with modern web technologies, providing authentication, payments, observability, and admin capabilities. The project serves as a production-ready starter for building scalable web applications with TypeScript, Next.js, Convex, and WorkOS.

## Tech Stack

### Core Technologies

- **Runtime**: Node.js >=22
- **Package Manager**: Bun 1.3.1
- **Language**: TypeScript 5.9.3 (strict mode)

### Frontend

- **Framework**: Next.js 16 (App Router)
- **UI Library**: React 19.2.0
- **Styling**: Tailwind CSS 4.1.16
- **Components**: shadcn/ui design system
- **Theming**: next-themes for dark/light mode

### Backend

- **Serverless Backend**: Convex (real-time database and functions)
- **API Routes**: Next.js Route Handlers / Hono
- **Database**: Drizzle ORM with PlanetScale (serverless MySQL)
- **Authentication**: WorkOS AuthKit

### Infrastructure & Tools

- **Observability**: Sentry for error tracking and monitoring
- **Payments**: Stripe with webhook support
- **Email**: React Email templates
- **Analytics**: Custom analytics
- **Environment Validation**: Zod

### Testing

- **Test Framework**: Vitest 4.0.8
- **React Testing**: @testing-library/react

### Code Quality

- **Linting**: ESLint
- **Formatting**: Prettier
- **Type Checking**: TypeScript strict mode

## Project Conventions

### Code Style

- **TypeScript**: Strict mode enabled, ES2022 target
- **Formatting**: Prettier for `.ts`, `.tsx`, and `.md` files
- **Naming**:
  - Files: kebab-case for components, camelCase for utilities
  - Components: PascalCase
  - Functions/variables: camelCase
- **Server/Client Separation**: Use `"use server"` and `"use client"` directives

### Architecture

- **Single Application Structure**:
  - `app/` - Next.js App Router pages and layouts
  - `components/` - React components
    - `ui/` - shadcn/ui primitives
  - `convex/` - Backend functions and schema
  - `lib/` - Shared utilities
  - `hooks/` - Custom React hooks
  - `public/` - Static assets

### Testing Strategy

- **Unit Tests**: Vitest
- **Test Location**: Co-located `__tests__/` directories or `.test.ts` files
- **Command**: `bun test`

## Domain Context

- **User Management**: Users stored in Convex with WorkOS external IDs
- **Roles**: Admin and User roles supported (syncing from WorkOS)
- **Localization**: Multi-language support (DE, FR, IT, RM, EN)
- **Authentication Flow**: WorkOS AuthKit handles sign-in/sign-up
- **Real-time**: Convex provides real-time subscriptions

## External Dependencies

### Services

- **Convex**: Serverless backend and real-time database
- **WorkOS**: Authentication and user management
- **Stripe**: Payment processing
- **Sentry**: Error tracking
- **PlanetScale**: Serverless MySQL database (via Drizzle ORM)

### Key Integrations

- **WorkOS Webhooks**: Handled in `convex/workos/webhooks/`
- **Stripe Webhooks**: Forwarded in development
