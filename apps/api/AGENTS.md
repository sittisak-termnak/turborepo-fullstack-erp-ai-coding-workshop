# AGENTS.md (apps/api)

Rules for `@erp/api` (NestJS 12, native ESM, oRPC via `@orpc/nest`, Prisma via `@erp/database`). The [root AGENTS.md](../../AGENTS.md) still applies.

- **One Nest module per feature** in `src/<feature>/` (`<feature>.module.ts`, `<feature>.controller.ts`), registered in `src/app.module.ts`.
- **Implement contract routes, don't declare your own.** Every handler is `@Implement(contract.<feature>.<route>)` returning `implement(contract.<feature>.<route>).handler(...)`. Reference: `src/health/health.controller.ts`.
- **No `class-validator` DTOs.** Input is already validated and typed by the contract's Zod schemas.
- **Database access** only through the injected `PrismaService` (`src/database`, global). Never create a `PrismaClient` yourself.
- **Every route requires a signed-in user** (global `AuthGuard`). Opt out with `@Public()`, restrict with `@Roles('MANAGER')`, and read the user with a `@CurrentUser() user: User` parameter on the `@Implement` method. All three live in `src/auth/auth.decorators.ts`.
- **Reject requests with an error the contract declares**, never a hand-written `ORPCError`. Declare it on the route with `.errors({ CODE: routeError('CODE', status) })` so the Thai message from `APP_ERRORS` in `@erp/contracts` is part of the published contract, then throw it from the handler's `errors` map: `throw errors.CODE({ data: { action } })`. That is what keeps NFR-04 true. Anything else a handler throws is caught by `publicErrorInterceptor` (`src/common/app-error.ts`) and replaced with the catalogue's retry message, so a stack trace or database detail never reaches a client.
- The global prefix is `/api`. Contract paths don't repeat it.
- Tests are colocated `*.spec.ts` files. See the `write-tests` skill.
