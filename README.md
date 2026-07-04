# AI Interviewer

AI Interviewer is a production-grade foundation for an interview preparation SaaS platform. The repository is intentionally focused on structure, contracts, and developer experience before product features.

## Stack

- Frontend: React, TypeScript, Tailwind CSS, Vite
- Backend: Node.js, Express, TypeScript
- Database: PostgreSQL
- Shared: TypeScript package for cross-app contracts

## Project Structure

```text
frontend/  React application and user-facing routes
backend/   Express API, configuration, middleware, and feature modules
shared/    Shared TypeScript types and constants
docs/      Architecture and operating notes
```

## Getting Started

1. Install dependencies:

   ```bash
   npm install
   ```

2. Create local environment files:

   ```bash
   cp .env.example .env
   cp frontend/.env.example frontend/.env
   cp backend/.env.example backend/.env
   ```

3. Start both applications:

   ```bash
   npm run dev
   ```

The frontend runs on `http://localhost:5173` and the backend runs on `http://localhost:4000`.

## Useful Scripts

- `npm run dev` starts all workspace development servers.
- `npm run build` builds all workspaces.
- `npm run lint` runs ESLint across all workspaces.
- `npm run typecheck` runs TypeScript checks across all workspaces.
- `npm run eval:ai` runs deterministic AI behavior regression checks.
- `npm run verify` runs the full safety gate: AI evals, typecheck, lint, format check, and build.
- `npm run format` formats the repository with Prettier.

## Current Scope

This project has moved beyond the initial scaffold. It now includes authenticated interview sessions, PostgreSQL persistence, a live interview room, conversation mode, voice integration, adaptive interviewer behavior, scoring, coaching reports, progress history, and AI behavior regression evals.

See `docs/ai-development-loop.md` for the workflow used to keep improving the interviewer without breaking existing behavior.
